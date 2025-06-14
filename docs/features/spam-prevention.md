# Spam Prevention & Email Deliverability

## Overview

hasteCRM implements a comprehensive spam prevention system to ensure high email deliverability rates and protect the platform from abuse. This document covers anti-spam measures, email authentication protocols, content filtering, reputation management, and best practices for maintaining excellent deliverability.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Email Authentication](#email-authentication)
3. [Content Filtering](#content-filtering)
4. [Sender Reputation Management](#sender-reputation-management)
5. [Rate Limiting & Throttling](#rate-limiting--throttling)
6. [Bounce & Complaint Handling](#bounce--complaint-handling)
7. [AI-Powered Spam Detection](#ai-powered-spam-detection)
8. [Monitoring & Analytics](#monitoring--analytics)
9. [Implementation Guide](#implementation-guide)
10. [Best Practices](#best-practices)

## Architecture Overview

### System Components

```
                     
   Email Composer    
  (User Interface)   
          ,          
           
          �          
     Content Filter  �    
       & Validator        
          ,               
                           
          �                                    
      Spam Scoring   �    <    $   AI Model      
         Engine                 (ML Scoring)   
          ,                                    
                           
          �                                    
     Rate Limiter &           $ Reputation DB   
        Throttle                 (Redis/PG)     
          ,                                     
           
          �          
     Authentication  
      (SPF/DKIM)    
          ,          
           
          �                                     
      Email Service  �         $ Feedback Loop   
       (SendGrid)                 Processor     
                                                
```

### Data Flow

1. **Composition** � User creates email
2. **Validation** � Content and recipient validation
3. **Scoring** � Spam probability calculation
4. **Rate Check** � Sending limits verification
5. **Authentication** � SPF/DKIM signing
6. **Delivery** � Send via ESP
7. **Feedback** � Process bounces/complaints

## Email Authentication

### SPF (Sender Policy Framework)

SPF prevents email spoofing by specifying which servers can send emails for your domain.

#### DNS Configuration
```dns
; SPF record for hastecrm.com
hastecrm.com.  IN  TXT  "v=spf1 include:_spf.sendgrid.net include:_spf.google.com ~all"

; Subdomain SPF
mail.hastecrm.com.  IN  TXT  "v=spf1 a mx include:_spf.sendgrid.net ~all"
```

#### Implementation
```typescript
// SPF validation service
export class SPFValidator {
  async validateSender(email: string, ipAddress: string): Promise<boolean> {
    const domain = email.split('@')[1];
    const spfRecord = await this.getSPFRecord(domain);
    
    if (!spfRecord) {
      logger.warn(`No SPF record found for domain: ${domain}`);
      return false;
    }
    
    return this.checkIPAgainstSPF(ipAddress, spfRecord);
  }
  
  private async getSPFRecord(domain: string): Promise<string | null> {
    try {
      const records = await dns.resolveTxt(domain);
      const spfRecord = records
        .flat()
        .find(record => record.startsWith('v=spf1'));
      
      return spfRecord || null;
    } catch (error) {
      logger.error(`SPF lookup failed for ${domain}:`, error);
      return null;
    }
  }
  
  private checkIPAgainstSPF(ip: string, spfRecord: string): boolean {
    // Parse SPF record and validate IP
    const mechanisms = this.parseSPFRecord(spfRecord);
    
    for (const mechanism of mechanisms) {
      if (this.ipMatchesMechanism(ip, mechanism)) {
        return true;
      }
    }
    
    return false;
  }
}
```

### DKIM (DomainKeys Identified Mail)

DKIM adds a digital signature to emails to verify they haven't been tampered with.

#### Key Generation
```typescript
// Generate DKIM keys
import { generateKeyPair } from 'crypto';

export async function generateDKIMKeys(): Promise<DKIMKeyPair> {
  return new Promise((resolve, reject) => {
    generateKeyPair('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: {
        type: 'spki',
        format: 'pem'
      },
      privateKeyEncoding: {
        type: 'pkcs8',
        format: 'pem'
      }
    }, (err, publicKey, privateKey) => {
      if (err) reject(err);
      else resolve({ publicKey, privateKey });
    });
  });
}

// DNS record format
export function formatDKIMRecord(publicKey: string): string {
  const key = publicKey
    .replace(/-----BEGIN PUBLIC KEY-----/, '')
    .replace(/-----END PUBLIC KEY-----/, '')
    .replace(/\n/g, '');
  
  return `v=DKIM1; k=rsa; p=${key}`;
}
```

#### Email Signing
```typescript
// DKIM signing implementation
import { createSign } from 'crypto';

export class DKIMSigner {
  constructor(
    private selector: string,
    private domain: string,
    private privateKey: string
  ) {}
  
  signEmail(email: EmailMessage): string {
    const headers = this.canonicalizeHeaders(email.headers);
    const body = this.canonicalizeBody(email.body);
    
    const signature = this.createSignature(headers, body);
    
    return this.formatDKIMHeader(signature);
  }
  
  private createSignature(headers: string, body: string): string {
    const bodyHash = this.hash(body);
    
    const signatureData = [
      `v=1`,
      `a=rsa-sha256`,
      `c=relaxed/relaxed`,
      `d=${this.domain}`,
      `s=${this.selector}`,
      `t=${Math.floor(Date.now() / 1000)}`,
      `bh=${bodyHash}`,
      `h=from:to:subject:date:message-id`,
      `b=`
    ].join('; ');
    
    const sign = createSign('SHA256');
    sign.update(headers + '\r\n' + signatureData);
    
    return sign.sign(this.privateKey, 'base64');
  }
  
  private formatDKIMHeader(signature: string): string {
    return `DKIM-Signature: v=1; a=rsa-sha256; c=relaxed/relaxed; ` +
           `d=${this.domain}; s=${this.selector}; ` +
           `h=from:to:subject:date:message-id; ` +
           `bh=${this.bodyHash}; b=${signature}`;
  }
}
```

### DMARC (Domain-based Message Authentication)

DMARC builds on SPF and DKIM to provide instructions on handling unauthenticated emails.

#### DNS Configuration
```dns
_dmarc.hastecrm.com.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@hastecrm.com; ruf=mailto:forensics@hastecrm.com; fo=1; pct=100"
```

#### DMARC Report Processing
```typescript
// DMARC report processor
export class DMARCReportProcessor {
  async processReport(report: string): Promise<void> {
    const parsed = await this.parseXMLReport(report);
    
    // Extract key metrics
    const metrics = {
      domain: parsed.policy_published.domain,
      totalMessages: parsed.record.reduce((sum, r) => sum + r.count, 0),
      passingMessages: parsed.record
        .filter(r => r.policy_evaluated.dkim === 'pass' || r.policy_evaluated.spf === 'pass')
        .reduce((sum, r) => sum + r.count, 0),
      failingMessages: parsed.record
        .filter(r => r.policy_evaluated.dkim === 'fail' && r.policy_evaluated.spf === 'fail')
        .reduce((sum, r) => sum + r.count, 0)
    };
    
    // Store metrics
    await this.storeMetrics(metrics);
    
    // Alert on failures
    if (metrics.failingMessages > 0) {
      await this.alertOnFailures(parsed);
    }
  }
  
  private async alertOnFailures(report: DMARCReport): Promise<void> {
    const failures = report.record.filter(r => 
      r.policy_evaluated.disposition !== 'none'
    );
    
    for (const failure of failures) {
      await this.notificationService.send({
        type: 'dmarc_failure',
        severity: 'warning',
        data: {
          sourceIP: failure.source_ip,
          count: failure.count,
          disposition: failure.policy_evaluated.disposition
        }
      });
    }
  }
}
```

## Content Filtering

### Spam Keywords Detection

```typescript
// Spam keyword analyzer
export class SpamKeywordAnalyzer {
  private readonly spamKeywords = {
    high: [
      'free money', 'act now', 'limited time', 'winner', 'congratulations',
      'click here', 'buy now', 'order now', 'special promotion', 'guarantee'
    ],
    medium: [
      'amazing', 'certified', 'exclusive', 'extra income', 'lowest price',
      'risk free', 'satisfaction', 'urgent', 'best price', 'bonus'
    ],
    low: [
      'offer', 'sale', 'discount', 'save', 'deal', 'new', 'important',
      'reminder', 'update', 'available'
    ]
  };
  
  private readonly spamPatterns = [
    /\b(?:viagra|cialis|pharmacy)\b/i,
    /\b(?:casino|gambling|lottery)\b/i,
    /\b(?:weight.?loss|diet.?pills)\b/i,
    /\$\d+(?:,\d{3})*(?:\.\d{2})?/g, // Money amounts
    /[A-Z\s]{10,}/g, // Excessive capitals
    /[!?]{3,}/g, // Excessive punctuation
    /https?:\/\/bit\.ly|tinyurl|short\.link/i // URL shorteners
  ];
  
  analyzeContent(content: string): SpamAnalysis {
    const analysis: SpamAnalysis = {
      score: 0,
      flags: [],
      suggestions: []
    };
    
    // Check keywords
    for (const [severity, keywords] of Object.entries(this.spamKeywords)) {
      const weight = severity === 'high' ? 3 : severity === 'medium' ? 2 : 1;
      
      for (const keyword of keywords) {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        const matches = content.match(regex);
        
        if (matches) {
          analysis.score += weight * matches.length;
          analysis.flags.push({
            type: 'keyword',
            severity,
            value: keyword,
            count: matches.length
          });
        }
      }
    }
    
    // Check patterns
    for (const pattern of this.spamPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        analysis.score += 5 * matches.length;
        analysis.flags.push({
          type: 'pattern',
          severity: 'high',
          value: pattern.toString(),
          count: matches.length
        });
      }
    }
    
    // Generate suggestions
    if (analysis.score > 10) {
      analysis.suggestions = this.generateSuggestions(analysis.flags);
    }
    
    return analysis;
  }
  
  private generateSuggestions(flags: SpamFlag[]): string[] {
    const suggestions: string[] = [];
    
    const keywordFlags = flags.filter(f => f.type === 'keyword');
    if (keywordFlags.length > 0) {
      suggestions.push(
        `Consider rephrasing to avoid spam trigger words: ${
          keywordFlags.map(f => f.value).join(', ')
        }`
      );
    }
    
    const capsFlag = flags.find(f => f.value.includes('[A-Z\\s]{10,}'));
    if (capsFlag) {
      suggestions.push('Reduce the use of ALL CAPS text');
    }
    
    const punctuationFlag = flags.find(f => f.value.includes('[!?]{3,}'));
    if (punctuationFlag) {
      suggestions.push('Avoid excessive punctuation marks');
    }
    
    return suggestions;
  }
}
```

### HTML Content Analysis

```typescript
// HTML email analyzer
export class HTMLEmailAnalyzer {
  analyzeHTML(html: string): HTMLAnalysis {
    const $ = cheerio.load(html);
    const analysis: HTMLAnalysis = {
      score: 0,
      issues: [],
      warnings: []
    };
    
    // Check text-to-image ratio
    const textLength = $('body').text().length;
    const imageCount = $('img').length;
    const textToImageRatio = imageCount > 0 ? textLength / imageCount : textLength;
    
    if (textToImageRatio < 100) {
      analysis.score += 5;
      analysis.issues.push({
        type: 'text_image_ratio',
        message: 'Low text-to-image ratio detected',
        severity: 'medium'
      });
    }
    
    // Check for hidden text
    const hiddenElements = $('[style*="display:none"], [style*="visibility:hidden"]');
    if (hiddenElements.length > 0) {
      analysis.score += 10;
      analysis.issues.push({
        type: 'hidden_text',
        message: `${hiddenElements.length} hidden elements detected`,
        severity: 'high'
      });
    }
    
    // Check for suspicious links
    $('a').each((_, element) => {
      const href = $(element).attr('href');
      const text = $(element).text();
      
      if (href && text) {
        // Check for URL shorteners
        if (/bit\.ly|tinyurl|short\.link/i.test(href)) {
          analysis.score += 5;
          analysis.issues.push({
            type: 'url_shortener',
            message: `URL shortener detected: ${href}`,
            severity: 'medium'
          });
        }
        
        // Check for misleading links
        if (text.includes('http') && !href.includes(text)) {
          analysis.score += 8;
          analysis.issues.push({
            type: 'misleading_link',
            message: `Misleading link text: "${text}" � ${href}`,
            severity: 'high'
          });
        }
      }
    });
    
    // Check for forms
    if ($('form').length > 0) {
      analysis.score += 10;
      analysis.warnings.push({
        type: 'form_detected',
        message: 'Email contains forms which may trigger spam filters',
        severity: 'medium'
      });
    }
    
    // Check for JavaScript
    if ($('script').length > 0) {
      analysis.score += 15;
      analysis.issues.push({
        type: 'javascript',
        message: 'JavaScript detected in email',
        severity: 'high'
      });
    }
    
    return analysis;
  }
}
```

### Subject Line Analysis

```typescript
// Subject line analyzer
export class SubjectLineAnalyzer {
  private readonly rules = [
    {
      pattern: /^RE:|^FW:/i,
      score: 3,
      message: 'Avoid fake reply/forward prefixes'
    },
    {
      pattern: /[A-Z\s]{10,}/,
      score: 5,
      message: 'Reduce excessive capitalization'
    },
    {
      pattern: /[!?]{2,}/,
      score: 4,
      message: 'Avoid multiple exclamation/question marks'
    },
    {
      pattern: /\$\d+|\d+%\s*off/i,
      score: 3,
      message: 'Monetary values may trigger spam filters'
    },
    {
      pattern: /free|winner|urgent|act now/i,
      score: 5,
      message: 'Contains common spam trigger words'
    },
    {
      pattern: /.{100,}/,
      score: 3,
      message: 'Subject line too long (keep under 50 characters)'
    }
  ];
  
  analyzeSubject(subject: string): SubjectAnalysis {
    const analysis: SubjectAnalysis = {
      score: 0,
      issues: [],
      suggestions: [],
      characterCount: subject.length
    };
    
    // Check against rules
    for (const rule of this.rules) {
      if (rule.pattern.test(subject)) {
        analysis.score += rule.score;
        analysis.issues.push({
          rule: rule.pattern.toString(),
          message: rule.message,
          score: rule.score
        });
      }
    }
    
    // Check emoji usage
    const emojiCount = (subject.match(/[\u{1F300}-\u{1F9FF}]/gu) || []).length;
    if (emojiCount > 2) {
      analysis.score += 2;
      analysis.suggestions.push('Limit emoji usage to 1-2 per subject line');
    }
    
    // Check for personalization
    if (!/{{\s*\w+\s*}}/g.test(subject)) {
      analysis.suggestions.push('Consider adding personalization tokens');
    }
    
    // Provide rewrite suggestions
    if (analysis.score > 5) {
      analysis.suggestions.push(...this.generateRewriteSuggestions(subject));
    }
    
    return analysis;
  }
  
  private generateRewriteSuggestions(subject: string): string[] {
    const suggestions: string[] = [];
    
    // Remove excessive caps
    if (/[A-Z\s]{10,}/.test(subject)) {
      suggestions.push(
        'Rewrite in sentence case: ' +
        subject.replace(/\b[A-Z\s]+\b/g, match => 
          match.charAt(0) + match.slice(1).toLowerCase()
        )
      );
    }
    
    // Remove excessive punctuation
    if (/[!?]{2,}/.test(subject)) {
      suggestions.push(
        'Use single punctuation: ' +
        subject.replace(/[!?]+/g, match => match.charAt(0))
      );
    }
    
    return suggestions;
  }
}
```

## Sender Reputation Management

### Domain Reputation Tracking

```typescript
// Domain reputation service
export class DomainReputationService {
  private readonly providers = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'aol.com'
  ];
  
  async checkReputation(domain: string): Promise<ReputationScore> {
    const scores = await Promise.all([
      this.checkSenderScore(domain),
      this.checkBarracuda(domain),
      this.checkTalos(domain),
      this.checkMXToolbox(domain)
    ]);
    
    const aggregateScore = this.calculateAggregateScore(scores);
    
    // Store reputation history
    await this.storeReputationHistory(domain, aggregateScore);
    
    return {
      domain,
      score: aggregateScore,
      providers: scores,
      recommendations: this.generateRecommendations(aggregateScore)
    };
  }
  
  private async checkSenderScore(domain: string): Promise<ProviderScore> {
    try {
      // Query SenderScore API
      const response = await this.httpClient.get(
        `https://api.senderscore.com/v1/domain/${domain}`
      );
      
      return {
        provider: 'SenderScore',
        score: response.data.score,
        details: response.data.details
      };
    } catch (error) {
      logger.error(`SenderScore check failed for ${domain}:`, error);
      return { provider: 'SenderScore', score: null, error: error.message };
    }
  }
  
  private generateRecommendations(score: number): string[] {
    const recommendations: string[] = [];
    
    if (score < 70) {
      recommendations.push('Implement email authentication (SPF, DKIM, DMARC)');
      recommendations.push('Review and clean your email list');
      recommendations.push('Monitor bounce and complaint rates');
    }
    
    if (score < 50) {
      recommendations.push('Consider using a dedicated IP address');
      recommendations.push('Implement gradual volume increase (IP warming)');
      recommendations.push('Review email content for spam triggers');
    }
    
    return recommendations;
  }
}
```

### IP Reputation Management

```typescript
// IP reputation manager
export class IPReputationManager {
  async monitorIPReputation(ipAddress: string): Promise<void> {
    // Check blacklists
    const blacklistStatus = await this.checkBlacklists(ipAddress);
    
    if (blacklistStatus.listed.length > 0) {
      await this.handleBlacklisting(ipAddress, blacklistStatus);
    }
    
    // Monitor sending patterns
    const sendingMetrics = await this.getSendingMetrics(ipAddress);
    
    if (this.detectAnomalies(sendingMetrics)) {
      await this.adjustSendingLimits(ipAddress, sendingMetrics);
    }
  }
  
  private async checkBlacklists(ip: string): Promise<BlacklistStatus> {
    const blacklists = [
      'zen.spamhaus.org',
      'bl.spamcop.net',
      'b.barracudacentral.org',
      'dnsbl.sorbs.net',
      'spam.dnsbl.sorbs.net'
    ];
    
    const results = await Promise.all(
      blacklists.map(bl => this.checkSingleBlacklist(ip, bl))
    );
    
    return {
      ip,
      checked: blacklists.length,
      listed: results.filter(r => r.listed).map(r => r.blacklist)
    };
  }
  
  private async handleBlacklisting(
    ip: string, 
    status: BlacklistStatus
  ): Promise<void> {
    // Immediate actions
    await this.pauseSendingFromIP(ip);
    
    // Notify administrators
    await this.notificationService.sendAlert({
      type: 'ip_blacklisted',
      severity: 'critical',
      data: {
        ip,
        blacklists: status.listed
      }
    });
    
    // Initiate delisting process
    for (const blacklist of status.listed) {
      await this.initiateDelisting(ip, blacklist);
    }
  }
}
```

## Rate Limiting & Throttling

### Sending Rate Limiter

```typescript
// Advanced rate limiting system
export class EmailRateLimiter {
  private readonly limits = {
    user: {
      hourly: 100,
      daily: 1000,
      monthly: 20000
    },
    workspace: {
      hourly: 1000,
      daily: 10000,
      monthly: 200000
    },
    recipient: {
      hourly: 5,
      daily: 10,
      weekly: 20
    }
  };
  
  async checkLimits(
    userId: string,
    workspaceId: string,
    recipients: string[]
  ): Promise<RateLimitResult> {
    const checks = await Promise.all([
      this.checkUserLimits(userId),
      this.checkWorkspaceLimits(workspaceId),
      this.checkRecipientLimits(recipients)
    ]);
    
    const failed = checks.filter(c => !c.allowed);
    
    if (failed.length > 0) {
      return {
        allowed: false,
        reason: failed[0].reason,
        resetAt: failed[0].resetAt,
        suggestions: this.generateThrottlingSuggestions(failed)
      };
    }
    
    return { allowed: true };
  }
  
  private async checkUserLimits(userId: string): Promise<LimitCheck> {
    const keys = {
      hourly: `rate:user:${userId}:hour:${this.getCurrentHour()}`,
      daily: `rate:user:${userId}:day:${this.getCurrentDay()}`,
      monthly: `rate:user:${userId}:month:${this.getCurrentMonth()}`
    };
    
    for (const [period, key] of Object.entries(keys)) {
      const count = await redis.incr(key);
      
      if (count === 1) {
        // Set expiration
        const ttl = period === 'hourly' ? 3600 : 
                   period === 'daily' ? 86400 : 2592000;
        await redis.expire(key, ttl);
      }
      
      if (count > this.limits.user[period]) {
        return {
          allowed: false,
          reason: `User ${period} limit exceeded`,
          current: count,
          limit: this.limits.user[period],
          resetAt: this.getResetTime(period)
        };
      }
    }
    
    return { allowed: true };
  }
  
  private generateThrottlingSuggestions(failed: LimitCheck[]): string[] {
    const suggestions: string[] = [];
    
    if (failed.some(f => f.reason.includes('hourly'))) {
      suggestions.push('Schedule emails to send gradually throughout the day');
    }
    
    if (failed.some(f => f.reason.includes('recipient'))) {
      suggestions.push('Avoid sending multiple emails to the same recipient in short succession');
    }
    
    suggestions.push('Consider upgrading your plan for higher sending limits');
    
    return suggestions;
  }
}
```

### Adaptive Throttling

```typescript
// Adaptive throttling based on engagement
export class AdaptiveThrottler {
  async calculateSendingRate(
    workspaceId: string,
    baseRate: number
  ): Promise<number> {
    const metrics = await this.getEngagementMetrics(workspaceId);
    
    // Calculate reputation score (0-100)
    const reputationScore = this.calculateReputationScore(metrics);
    
    // Adjust rate based on reputation
    let adjustedRate = baseRate;
    
    if (reputationScore < 50) {
      adjustedRate = Math.floor(baseRate * 0.5); // 50% reduction
    } else if (reputationScore < 70) {
      adjustedRate = Math.floor(baseRate * 0.75); // 25% reduction
    } else if (reputationScore > 90) {
      adjustedRate = Math.floor(baseRate * 1.2); // 20% increase
    }
    
    // Apply time-based adjustments
    const hourOfDay = new Date().getHours();
    if (hourOfDay >= 9 && hourOfDay <= 17) {
      // Business hours - allow higher rate
      adjustedRate = Math.floor(adjustedRate * 1.1);
    } else if (hourOfDay >= 22 || hourOfDay <= 6) {
      // Night hours - reduce rate
      adjustedRate = Math.floor(adjustedRate * 0.7);
    }
    
    return adjustedRate;
  }
  
  private calculateReputationScore(metrics: EngagementMetrics): number {
    const weights = {
      deliveryRate: 0.3,
      openRate: 0.2,
      clickRate: 0.1,
      bounceRate: -0.2,
      complaintRate: -0.3,
      unsubscribeRate: -0.1
    };
    
    let score = 50; // Base score
    
    score += metrics.deliveryRate * weights.deliveryRate;
    score += metrics.openRate * weights.openRate;
    score += metrics.clickRate * weights.clickRate;
    score += (1 - metrics.bounceRate) * Math.abs(weights.bounceRate);
    score += (1 - metrics.complaintRate) * Math.abs(weights.complaintRate);
    score += (1 - metrics.unsubscribeRate) * Math.abs(weights.unsubscribeRate);
    
    return Math.max(0, Math.min(100, score));
  }
}
```

## Bounce & Complaint Handling

### Bounce Processing

```typescript
// Bounce handler
export class BounceHandler {
  private readonly bounceCategories = {
    hard: [
      'bad-mailbox',
      'no-such-user',
      'invalid-domain',
      'message-expired'
    ],
    soft: [
      'mailbox-full',
      'message-too-large',
      'timeout',
      'dns-failure'
    ],
    block: [
      'spam-block',
      'reputation-block',
      'content-block',
      'blacklisted'
    ]
  };
  
  async processBounce(bounceNotification: BounceNotification): Promise<void> {
    const category = this.categorizeBounce(bounceNotification);
    
    // Update contact status
    await this.updateContactStatus(
      bounceNotification.recipient,
      category
    );
    
    // Update metrics
    await this.updateBounceMetrics(
      bounceNotification.workspaceId,
      category
    );
    
    // Take action based on category
    switch (category) {
      case 'hard':
        await this.handleHardBounce(bounceNotification);
        break;
      case 'soft':
        await this.handleSoftBounce(bounceNotification);
        break;
      case 'block':
        await this.handleBlockBounce(bounceNotification);
        break;
    }
  }
  
  private async handleHardBounce(bounce: BounceNotification): Promise<void> {
    // Mark email as invalid
    await this.contactService.markEmailInvalid(bounce.recipient, {
      reason: 'hard_bounce',
      code: bounce.diagnosticCode,
      timestamp: new Date()
    });
    
    // Remove from all lists
    await this.listService.removeEmailFromAllLists(bounce.recipient);
    
    // Log for compliance
    await this.auditLogger.log({
      action: 'email_invalidated',
      reason: 'hard_bounce',
      email: bounce.recipient,
      details: bounce
    });
  }
  
  private async handleSoftBounce(bounce: BounceNotification): Promise<void> {
    const bounceCount = await this.incrementSoftBounceCount(bounce.recipient);
    
    if (bounceCount >= 3) {
      // Treat as hard bounce after 3 soft bounces
      await this.handleHardBounce(bounce);
    } else {
      // Schedule retry
      await this.queueService.scheduleRetry({
        emailId: bounce.emailId,
        recipient: bounce.recipient,
        attemptNumber: bounceCount + 1,
        retryAfter: this.calculateRetryDelay(bounceCount)
      });
    }
  }
  
  private async handleBlockBounce(bounce: BounceNotification): Promise<void> {
    // Analyze block reason
    const analysis = await this.analyzeBlockReason(bounce.diagnosticCode);
    
    // Take corrective action
    if (analysis.type === 'content') {
      await this.flagContentIssue(bounce.emailId, analysis);
    } else if (analysis.type === 'reputation') {
      await this.reputationService.investigateBlock(bounce);
    }
    
    // Notify administrators
    await this.notificationService.sendAlert({
      type: 'email_blocked',
      severity: 'high',
      data: {
        recipient: bounce.recipient,
        reason: analysis,
        diagnosticCode: bounce.diagnosticCode
      }
    });
  }
}
```

### Complaint Handling

```typescript
// Feedback loop processor
export class FeedbackLoopProcessor {
  async processFeedbackLoop(complaint: ComplaintNotification): Promise<void> {
    // Immediate unsubscribe
    await this.unsubscribeService.unsubscribe(complaint.recipient, {
      reason: 'spam_complaint',
      source: complaint.feedbackType,
      timestamp: new Date()
    });
    
    // Update sender reputation
    await this.updateSenderReputation(complaint);
    
    // Analyze complaint patterns
    const pattern = await this.analyzeComplaintPattern(complaint);
    
    if (pattern.severity === 'high') {
      await this.takeCorrectiveAction(pattern);
    }
    
    // Store for reporting
    await this.storeComplaint(complaint);
  }
  
  private async analyzeComplaintPattern(
    complaint: ComplaintNotification
  ): Promise<ComplaintPattern> {
    const recentComplaints = await this.getRecentComplaints(
      complaint.workspaceId,
      24 // hours
    );
    
    const pattern: ComplaintPattern = {
      count: recentComplaints.length,
      rate: recentComplaints.length / await this.getTotalSent(24),
      commonalities: this.findCommonalities(recentComplaints),
      severity: 'low'
    };
    
    // Determine severity
    if (pattern.rate > 0.001) { // 0.1%
      pattern.severity = 'high';
    } else if (pattern.rate > 0.0005) { // 0.05%
      pattern.severity = 'medium';
    }
    
    // Check for patterns
    if (pattern.commonalities.campaign) {
      pattern.type = 'campaign_issue';
    } else if (pattern.commonalities.contentType) {
      pattern.type = 'content_issue';
    } else if (pattern.commonalities.sendTime) {
      pattern.type = 'timing_issue';
    }
    
    return pattern;
  }
  
  private async takeCorrectiveAction(pattern: ComplaintPattern): Promise<void> {
    switch (pattern.type) {
      case 'campaign_issue':
        // Pause campaign
        await this.campaignService.pause(pattern.commonalities.campaign);
        break;
        
      case 'content_issue':
        // Flag content for review
        await this.contentService.flagForReview({
          reason: 'high_complaint_rate',
          pattern
        });
        break;
        
      case 'timing_issue':
        // Adjust sending schedule
        await this.schedulingService.adjustTiming({
          avoidHours: pattern.commonalities.sendTime
        });
        break;
    }
  }
}
```

## AI-Powered Spam Detection

### Machine Learning Model

```typescript
// ML-based spam detector
export class MLSpamDetector {
  private model: tf.LayersModel;
  private tokenizer: Tokenizer;
  
  async initialize(): Promise<void> {
    // Load pre-trained model
    this.model = await tf.loadLayersModel('/models/spam-detector/model.json');
    
    // Load tokenizer
    this.tokenizer = await this.loadTokenizer();
  }
  
  async predictSpamProbability(email: EmailContent): Promise<SpamPrediction> {
    // Extract features
    const features = await this.extractFeatures(email);
    
    // Make prediction
    const prediction = this.model.predict(features) as tf.Tensor;
    const probability = await prediction.data();
    
    // Get feature importance
    const importance = await this.getFeatureImportance(features);
    
    return {
      probability: probability[0],
      confidence: this.calculateConfidence(probability[0]),
      features: importance,
      recommendation: this.getRecommendation(probability[0])
    };
  }
  
  private async extractFeatures(email: EmailContent): Promise<tf.Tensor> {
    const features = [];
    
    // Text features
    const textTokens = this.tokenizer.encode(email.subject + ' ' + email.body);
    features.push(...textTokens);
    
    // Metadata features
    features.push(
      email.attachments?.length || 0,
      email.links?.length || 0,
      email.images?.length || 0,
      this.calculateTextHtmlRatio(email),
      this.countSpecialCharacters(email.body),
      this.calculateCapitalizationRatio(email.body)
    );
    
    // Sender features
    features.push(
      await this.getSenderReputation(email.from),
      await this.getSenderAge(email.from),
      await this.getSenderVolume(email.from)
    );
    
    // Time features
    const sendTime = new Date(email.scheduledAt || Date.now());
    features.push(
      sendTime.getHours(),
      sendTime.getDay(),
      this.isWeekend(sendTime) ? 1 : 0
    );
    
    return tf.tensor2d([features]);
  }
  
  private getRecommendation(probability: number): SpamRecommendation {
    if (probability < 0.2) {
      return {
        action: 'send',
        confidence: 'high',
        message: 'Email appears legitimate'
      };
    } else if (probability < 0.5) {
      return {
        action: 'review',
        confidence: 'medium',
        message: 'Email has some spam indicators',
        suggestions: [
          'Review content for spam triggers',
          'Consider personalizing the message',
          'Verify sender authentication'
        ]
      };
    } else if (probability < 0.8) {
      return {
        action: 'modify',
        confidence: 'medium',
        message: 'Email likely to be marked as spam',
        suggestions: [
          'Remove spam trigger words',
          'Improve text-to-image ratio',
          'Add unsubscribe link',
          'Authenticate sending domain'
        ]
      };
    } else {
      return {
        action: 'block',
        confidence: 'high',
        message: 'Email has high spam probability',
        suggestions: [
          'Completely rewrite the content',
          'Review sender reputation',
          'Check for blacklisting'
        ]
      };
    }
  }
}
```

### Behavioral Analysis

```typescript
// User behavior analyzer
export class BehaviorAnalyzer {
  async analyzeUserBehavior(userId: string): Promise<BehaviorProfile> {
    const history = await this.getUserHistory(userId, 90); // 90 days
    
    const profile: BehaviorProfile = {
      userId,
      normalPatterns: this.extractNormalPatterns(history),
      riskScore: 0,
      anomalies: []
    };
    
    // Check for anomalies
    const recentActivity = await this.getRecentActivity(userId, 24); // 24 hours
    
    // Volume anomaly
    if (recentActivity.emailsSent > profile.normalPatterns.avgDailyVolume * 3) {
      profile.anomalies.push({
        type: 'volume_spike',
        severity: 'high',
        value: recentActivity.emailsSent,
        expected: profile.normalPatterns.avgDailyVolume
      });
      profile.riskScore += 30;
    }
    
    // Recipient anomaly
    const newRecipientRatio = recentActivity.newRecipients / recentActivity.totalRecipients;
    if (newRecipientRatio > 0.8) {
      profile.anomalies.push({
        type: 'new_recipient_spike',
        severity: 'medium',
        value: newRecipientRatio,
        expected: profile.normalPatterns.avgNewRecipientRatio
      });
      profile.riskScore += 20;
    }
    
    // Content anomaly
    if (await this.detectContentAnomaly(recentActivity.emails, profile)) {
      profile.anomalies.push({
        type: 'content_change',
        severity: 'medium',
        details: 'Significant change in email content pattern'
      });
      profile.riskScore += 15;
    }
    
    // Time anomaly
    if (this.detectTimeAnomaly(recentActivity.sendTimes, profile)) {
      profile.anomalies.push({
        type: 'unusual_send_time',
        severity: 'low',
        details: 'Emails sent at unusual hours'
      });
      profile.riskScore += 10;
    }
    
    return profile;
  }
  
  private extractNormalPatterns(history: UserHistory): NormalPatterns {
    return {
      avgDailyVolume: this.calculateAverage(history.dailyVolumes),
      avgNewRecipientRatio: this.calculateAverage(history.newRecipientRatios),
      typicalSendHours: this.findTypicalHours(history.sendTimes),
      contentPatterns: this.analyzeContentPatterns(history.emails),
      recipientDomains: this.getCommonDomains(history.recipients)
    };
  }
}
```

## Monitoring & Analytics

### Real-time Dashboard

```typescript
// Spam metrics dashboard
export class SpamMetricsDashboard {
  async getRealtimeMetrics(): Promise<DashboardMetrics> {
    const [
      deliveryMetrics,
      reputationMetrics,
      contentMetrics,
      volumeMetrics
    ] = await Promise.all([
      this.getDeliveryMetrics(),
      this.getReputationMetrics(),
      this.getContentMetrics(),
      this.getVolumeMetrics()
    ]);
    
    return {
      timestamp: new Date(),
      delivery: deliveryMetrics,
      reputation: reputationMetrics,
      content: contentMetrics,
      volume: volumeMetrics,
      alerts: await this.getActiveAlerts(),
      recommendations: this.generateRecommendations({
        deliveryMetrics,
        reputationMetrics,
        contentMetrics,
        volumeMetrics
      })
    };
  }
  
  private async getDeliveryMetrics(): Promise<DeliveryMetrics> {
    const timeRange = { start: subHours(new Date(), 24), end: new Date() };
    
    const [sent, delivered, bounced, complained] = await Promise.all([
      this.countEmails('sent', timeRange),
      this.countEmails('delivered', timeRange),
      this.countEmails('bounced', timeRange),
      this.countEmails('complained', timeRange)
    ]);
    
    return {
      sent,
      delivered,
      deliveryRate: (delivered / sent) * 100,
      bounceRate: (bounced / sent) * 100,
      complaintRate: (complained / sent) * 100,
      trends: await this.calculateTrends('delivery', 7)
    };
  }
}
```

### Alert System

```typescript
// Spam alert manager
export class SpamAlertManager {
  private readonly thresholds = {
    bounceRate: { warning: 3, critical: 5 },
    complaintRate: { warning: 0.05, critical: 0.1 },
    spamScore: { warning: 5, critical: 8 },
    blacklistings: { warning: 1, critical: 3 }
  };
  
  async checkAndAlert(): Promise<void> {
    const metrics = await this.gatherMetrics();
    
    for (const [metric, value] of Object.entries(metrics)) {
      const threshold = this.thresholds[metric];
      
      if (value >= threshold.critical) {
        await this.sendAlert({
          severity: 'critical',
          metric,
          value,
          threshold: threshold.critical,
          actions: this.getCriticalActions(metric)
        });
      } else if (value >= threshold.warning) {
        await this.sendAlert({
          severity: 'warning',
          metric,
          value,
          threshold: threshold.warning,
          actions: this.getWarningActions(metric)
        });
      }
    }
  }
  
  private getCriticalActions(metric: string): string[] {
    const actions = {
      bounceRate: [
        'Pause all email sending immediately',
        'Review and clean email list',
        'Check authentication settings',
        'Contact ESP support'
      ],
      complaintRate: [
        'Stop current campaign',
        'Review email content and frequency',
        'Implement double opt-in',
        'Audit list acquisition methods'
      ],
      spamScore: [
        'Review and rewrite email content',
        'Remove spam trigger words',
        'Check sender authentication',
        'Test with spam checking tools'
      ],
      blacklistings: [
        'Identify affected IP/domain',
        'Submit delisting requests',
        'Review recent sending patterns',
        'Implement stricter content controls'
      ]
    };
    
    return actions[metric] || [];
  }
}
```

## Implementation Guide

### Setup Checklist

```typescript
// Spam prevention setup
export class SpamPreventionSetup {
  async setupForWorkspace(workspaceId: string): Promise<SetupResult> {
    const steps = [
      {
        name: 'Configure SPF',
        action: () => this.configureSPF(workspaceId),
        required: true
      },
      {
        name: 'Setup DKIM',
        action: () => this.setupDKIM(workspaceId),
        required: true
      },
      {
        name: 'Configure DMARC',
        action: () => this.configureDMARC(workspaceId),
        required: true
      },
      {
        name: 'Setup feedback loops',
        action: () => this.setupFeedbackLoops(workspaceId),
        required: true
      },
      {
        name: 'Configure rate limits',
        action: () => this.configureRateLimits(workspaceId),
        required: true
      },
      {
        name: 'Initialize ML model',
        action: () => this.initializeMLModel(workspaceId),
        required: false
      },
      {
        name: 'Setup monitoring',
        action: () => this.setupMonitoring(workspaceId),
        required: true
      }
    ];
    
    const results = [];
    
    for (const step of steps) {
      try {
        await step.action();
        results.push({ step: step.name, status: 'success' });
      } catch (error) {
        results.push({ 
          step: step.name, 
          status: 'failed', 
          error: error.message,
          required: step.required
        });
        
        if (step.required) {
          throw new Error(`Required step failed: ${step.name}`);
        }
      }
    }
    
    return {
      workspaceId,
      steps: results,
      complete: results.every(r => r.status === 'success')
    };
  }
}
```

### Integration Example

```typescript
// Email sending with spam prevention
export class SecureEmailSender {
  constructor(
    private spamDetector: MLSpamDetector,
    private rateLimiter: EmailRateLimiter,
    private contentFilter: SpamKeywordAnalyzer,
    private authService: EmailAuthService,
    private emailService: EmailService
  ) {}
  
  async sendEmail(email: EmailRequest): Promise<SendResult> {
    try {
      // 1. Content analysis
      const contentAnalysis = await this.analyzeContent(email);
      if (contentAnalysis.score > 10) {
        return {
          status: 'rejected',
          reason: 'content_spam_score_high',
          analysis: contentAnalysis
        };
      }
      
      // 2. ML spam detection
      const spamPrediction = await this.spamDetector.predictSpamProbability(email);
      if (spamPrediction.probability > 0.7) {
        return {
          status: 'rejected',
          reason: 'ml_spam_detection',
          prediction: spamPrediction
        };
      }
      
      // 3. Rate limiting
      const rateLimitCheck = await this.rateLimiter.checkLimits(
        email.userId,
        email.workspaceId,
        email.recipients
      );
      if (!rateLimitCheck.allowed) {
        return {
          status: 'rate_limited',
          reason: rateLimitCheck.reason,
          resetAt: rateLimitCheck.resetAt
        };
      }
      
      // 4. Authentication
      const authenticated = await this.authService.signEmail(email);
      
      // 5. Send email
      const result = await this.emailService.send(authenticated);
      
      // 6. Track metrics
      await this.trackSendMetrics(email, result);
      
      return {
        status: 'sent',
        messageId: result.messageId,
        analysis: contentAnalysis,
        prediction: spamPrediction
      };
      
    } catch (error) {
      logger.error('Email send failed:', error);
      throw error;
    }
  }
  
  private async analyzeContent(email: EmailRequest): Promise<ContentAnalysis> {
    const [
      keywordAnalysis,
      subjectAnalysis,
      htmlAnalysis
    ] = await Promise.all([
      this.contentFilter.analyzeContent(email.body),
      this.contentFilter.analyzeSubject(email.subject),
      email.html ? this.contentFilter.analyzeHTML(email.html) : null
    ]);
    
    return {
      score: keywordAnalysis.score + 
             subjectAnalysis.score + 
             (htmlAnalysis?.score || 0),
      details: {
        keywords: keywordAnalysis,
        subject: subjectAnalysis,
        html: htmlAnalysis
      }
    };
  }
}
```

## Best Practices

### 1. List Hygiene

```typescript
// List cleaning service
export class ListHygieneService {
  async cleanEmailList(listId: string): Promise<CleaningResult> {
    const emails = await this.getListEmails(listId);
    const results = {
      total: emails.length,
      valid: 0,
      invalid: 0,
      risky: 0,
      unknown: 0,
      removed: []
    };
    
    for (const email of emails) {
      const validation = await this.validateEmail(email);
      
      switch (validation.status) {
        case 'valid':
          results.valid++;
          break;
          
        case 'invalid':
          results.invalid++;
          results.removed.push({
            email: email.address,
            reason: validation.reason
          });
          await this.removeFromList(listId, email.id);
          break;
          
        case 'risky':
          results.risky++;
          if (validation.risk === 'high') {
            results.removed.push({
              email: email.address,
              reason: 'high_risk'
            });
            await this.removeFromList(listId, email.id);
          }
          break;
          
        default:
          results.unknown++;
      }
    }
    
    return results;
  }
  
  private async validateEmail(email: EmailRecord): Promise<ValidationResult> {
    // Check syntax
    if (!this.isValidSyntax(email.address)) {
      return { status: 'invalid', reason: 'invalid_syntax' };
    }
    
    // Check domain
    const domain = email.address.split('@')[1];
    if (!await this.isDomainValid(domain)) {
      return { status: 'invalid', reason: 'invalid_domain' };
    }
    
    // Check disposable email
    if (await this.isDisposableEmail(domain)) {
      return { status: 'risky', risk: 'high', reason: 'disposable_email' };
    }
    
    // Check role-based
    if (this.isRoleBased(email.address)) {
      return { status: 'risky', risk: 'medium', reason: 'role_based' };
    }
    
    // Check engagement history
    const engagement = await this.getEngagementHistory(email.address);
    if (engagement.bounceCount > 0) {
      return { status: 'invalid', reason: 'previous_bounce' };
    }
    
    if (engagement.complaintCount > 0) {
      return { status: 'invalid', reason: 'previous_complaint' };
    }
    
    if (engagement.lastOpenedAt < subMonths(new Date(), 6)) {
      return { status: 'risky', risk: 'low', reason: 'inactive' };
    }
    
    return { status: 'valid' };
  }
}
```

### 2. Engagement-Based Sending

```typescript
// Engagement optimizer
export class EngagementOptimizer {
  async optimizeSending(
    campaignId: string,
    recipients: string[]
  ): Promise<OptimizedList> {
    const segments = {
      highly_engaged: [],
      moderately_engaged: [],
      low_engaged: [],
      never_engaged: []
    };
    
    for (const recipient of recipients) {
      const engagement = await this.calculateEngagementScore(recipient);
      
      if (engagement.score > 80) {
        segments.highly_engaged.push({
          recipient,
          bestTime: engagement.optimalSendTime,
          frequency: 'normal'
        });
      } else if (engagement.score > 50) {
        segments.moderately_engaged.push({
          recipient,
          bestTime: engagement.optimalSendTime,
          frequency: 'reduced'
        });
      } else if (engagement.score > 20) {
        segments.low_engaged.push({
          recipient,
          bestTime: engagement.optimalSendTime,
          frequency: 'minimal'
        });
      } else {
        segments.never_engaged.push({
          recipient,
          action: 're_engagement_campaign'
        });
      }
    }
    
    return {
      segments,
      recommendations: this.generateRecommendations(segments),
      schedule: this.createOptimalSchedule(segments)
    };
  }
}
```

### 3. Content Best Practices

```typescript
// Content guidelines
export const contentGuidelines = {
  subject: {
    maxLength: 50,
    avoid: ['free', 'guarantee', 'urgent', 'act now'],
    include: ['personalization', 'clear_value', 'curiosity']
  },
  
  body: {
    textToHtmlRatio: 0.4, // 40% text minimum
    maxImages: 3,
    requireUnsubscribe: true,
    requirePhysicalAddress: true,
    maxLinks: 5
  },
  
  technical: {
    maxSizeKB: 100,
    preferredWidth: 600,
    mobileOptimized: true,
    altTextRequired: true
  },
  
  authentication: {
    spf: 'required',
    dkim: 'required',
    dmarc: 'recommended',
    bimi: 'optional'
  }
};
```

## Conclusion

Effective spam prevention requires a multi-layered approach combining technical measures, content optimization, and continuous monitoring. By implementing these comprehensive spam prevention strategies, hasteCRM ensures high deliverability rates while maintaining sender reputation and compliance with email best practices.