# AI Service Integration Implementation Guide

## Table of Contents
1. [Overview](#overview)
2. [Service Architecture](#service-architecture)
3. [Provider Implementations](#provider-implementations)
4. [Rate Limiting & Fallbacks](#rate-limiting--fallbacks)
5. [Cost Optimization](#cost-optimization)
6. [Testing AI Services](#testing-ai-services)
7. [Production Considerations](#production-considerations)

## Overview

This guide provides complete implementation details for integrating AI services (Claude, GPT-4, Perplexity) into hasteCRM.

## Service Architecture

### Base AI Service Interface

```typescript
// packages/ai/src/interfaces/ai-service.interface.ts
export interface AIServiceConfig {
  provider: 'claude' | 'openai' | 'perplexity';
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface AIResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  provider: string;
  model: string;
  latency: number;
}

export interface AIService {
  generateCompletion(prompt: string, options?: CompletionOptions): Promise<AIResponse>;
  generateEmbedding(text: string): Promise<number[]>;
  estimateCost(tokens: number): number;
  checkAvailability(): Promise<boolean>;
}
```

### AI Service Factory

```typescript
// packages/ai/src/services/ai-service.factory.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ClaudeService } from './claude.service';
import { OpenAIService } from './openai.service';
import { PerplexityService } from './perplexity.service';
import { AIService, AIServiceConfig } from '../interfaces/ai-service.interface';

@Injectable()
export class AIServiceFactory {
  private services: Map<string, AIService> = new Map();

  constructor(
    private configService: ConfigService,
    private claudeService: ClaudeService,
    private openaiService: OpenAIService,
    private perplexityService: PerplexityService,
  ) {
    this.initializeServices();
  }

  private initializeServices(): void {
    // Initialize Claude
    this.services.set('claude', this.claudeService);
    
    // Initialize OpenAI
    this.services.set('openai', this.openaiService);
    
    // Initialize Perplexity for search
    this.services.set('perplexity', this.perplexityService);
  }

  getService(provider: string): AIService {
    const service = this.services.get(provider);
    if (!service) {
      throw new Error(`AI service provider '${provider}' not found`);
    }
    return service;
  }

  async getAvailableService(preferredProviders: string[] = ['claude', 'openai']): Promise<AIService> {
    for (const provider of preferredProviders) {
      const service = this.services.get(provider);
      if (service && await service.checkAvailability()) {
        return service;
      }
    }
    throw new Error('No AI services available');
  }
}
```

## Provider Implementations

### Claude Implementation

```typescript
// packages/ai/src/services/claude.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { AIService, AIResponse } from '../interfaces/ai-service.interface';
import { MetricsService } from '@/monitoring/metrics.service';
import { CircuitBreaker } from '@/utils/circuit-breaker';

@Injectable()
export class ClaudeService implements AIService {
  private readonly logger = new Logger(ClaudeService.name);
  private client: Anthropic;
  private circuitBreaker: CircuitBreaker;
  
  private readonly COST_PER_1K_PROMPT_TOKENS = 0.008;
  private readonly COST_PER_1K_COMPLETION_TOKENS = 0.024;

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.client = new Anthropic({
      apiKey: this.configService.get('AI_CLAUDE_API_KEY'),
    });

    this.circuitBreaker = new CircuitBreaker({
      name: 'claude-api',
      failureThreshold: 5,
      resetTimeout: 60000, // 1 minute
      monitoringPeriod: 120000, // 2 minutes
    });
  }

  async generateCompletion(prompt: string, options?: any): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.messages.create({
          model: options?.model || 'claude-3-opus-20240229',
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          messages: [{
            role: 'user',
            content: prompt,
          }],
          stream: options?.stream || false,
        });
      });

      const latency = Date.now() - startTime;
      const usage = this.calculateUsage(response.usage);

      // Track metrics
      this.metricsService.recordAIRequest({
        provider: 'claude',
        model: response.model,
        tokens: usage.totalTokens,
        latency,
        cost: usage.cost,
      });

      return {
        content: response.content[0].type === 'text' ? response.content[0].text : '',
        usage,
        provider: 'claude',
        model: response.model,
        latency,
      };
    } catch (error) {
      this.logger.error('Claude API error:', error);
      this.metricsService.recordAIError('claude', error.message);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    // Claude doesn't provide embeddings, use OpenAI as fallback
    throw new Error('Claude does not support embeddings. Use OpenAI service.');
  }

  private calculateUsage(usage: any) {
    const promptTokens = usage.input_tokens;
    const completionTokens = usage.output_tokens;
    const totalTokens = promptTokens + completionTokens;
    
    const cost = 
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS +
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    };
  }

  estimateCost(tokens: number): number {
    // Assume 70/30 split between prompt and completion
    const promptTokens = tokens * 0.7;
    const completionTokens = tokens * 0.3;
    
    return (
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS +
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS
    );
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.messages.create({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'ping' }],
      });
      return true;
    } catch (error) {
      this.logger.warn('Claude service unavailable:', error.message);
      return false;
    }
  }
}
```

### OpenAI Implementation

```typescript
// packages/ai/src/services/openai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { AIService, AIResponse } from '../interfaces/ai-service.interface';
import { MetricsService } from '@/monitoring/metrics.service';
import { CircuitBreaker } from '@/utils/circuit-breaker';

@Injectable()
export class OpenAIService implements AIService {
  private readonly logger = new Logger(OpenAIService.name);
  private client: OpenAI;
  private circuitBreaker: CircuitBreaker;
  
  private readonly COST_PER_1K_PROMPT_TOKENS = 0.01;
  private readonly COST_PER_1K_COMPLETION_TOKENS = 0.03;
  private readonly EMBEDDING_COST_PER_1K_TOKENS = 0.0001;

  constructor(
    private configService: ConfigService,
    private metricsService: MetricsService,
  ) {
    this.client = new OpenAI({
      apiKey: this.configService.get('AI_OPENAI_API_KEY'),
    });

    this.circuitBreaker = new CircuitBreaker({
      name: 'openai-api',
      failureThreshold: 5,
      resetTimeout: 60000,
      monitoringPeriod: 120000,
    });
  }

  async generateCompletion(prompt: string, options?: any): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await this.circuitBreaker.execute(async () => {
        return await this.client.chat.completions.create({
          model: options?.model || 'gpt-4-turbo-preview',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: options?.maxTokens || 4096,
          temperature: options?.temperature || 0.7,
          stream: options?.stream || false,
        });
      });

      const latency = Date.now() - startTime;
      const usage = this.calculateUsage(response.usage);

      this.metricsService.recordAIRequest({
        provider: 'openai',
        model: response.model,
        tokens: usage.totalTokens,
        latency,
        cost: usage.cost,
      });

      return {
        content: response.choices[0].message.content,
        usage,
        provider: 'openai',
        model: response.model,
        latency,
      };
    } catch (error) {
      this.logger.error('OpenAI API error:', error);
      this.metricsService.recordAIError('openai', error.message);
      
      // Handle rate limiting
      if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      }
      
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.client.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
      });

      const tokens = response.usage.total_tokens;
      const cost = (tokens / 1000) * this.EMBEDDING_COST_PER_1K_TOKENS;

      this.metricsService.recordAIRequest({
        provider: 'openai',
        model: 'text-embedding-3-small',
        tokens,
        latency: 0,
        cost,
      });

      return response.data[0].embedding;
    } catch (error) {
      this.logger.error('OpenAI embedding error:', error);
      throw error;
    }
  }

  private calculateUsage(usage: any) {
    const promptTokens = usage.prompt_tokens;
    const completionTokens = usage.completion_tokens;
    const totalTokens = usage.total_tokens;
    
    const cost = 
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS +
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS;

    return {
      promptTokens,
      completionTokens,
      totalTokens,
      cost,
    };
  }

  estimateCost(tokens: number): number {
    const promptTokens = tokens * 0.7;
    const completionTokens = tokens * 0.3;
    
    return (
      (promptTokens / 1000) * this.COST_PER_1K_PROMPT_TOKENS +
      (completionTokens / 1000) * this.COST_PER_1K_COMPLETION_TOKENS
    );
  }

  async checkAvailability(): Promise<boolean> {
    try {
      await this.client.models.retrieve('gpt-4');
      return true;
    } catch (error) {
      this.logger.warn('OpenAI service unavailable:', error.message);
      return false;
    }
  }
}
```

### Perplexity Implementation

```typescript
// packages/ai/src/services/perplexity.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AIService, AIResponse } from '../interfaces/ai-service.interface';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class PerplexityService implements AIService {
  private readonly logger = new Logger(PerplexityService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.perplexity.ai';
  
  private readonly COST_PER_REQUEST = 0.005; // $0.005 per request

  constructor(
    private configService: ConfigService,
    private httpService: HttpService,
  ) {
    this.apiKey = this.configService.get('AI_PERPLEXITY_API_KEY');
  }

  async generateCompletion(prompt: string, options?: any): Promise<AIResponse> {
    const startTime = Date.now();
    
    try {
      const response = await firstValueFrom(
        this.httpService.post(
          `${this.baseUrl}/chat/completions`,
          {
            model: options?.model || 'pplx-70b-online',
            messages: [{ role: 'user', content: prompt }],
            temperature: options?.temperature || 0.7,
            max_tokens: options?.maxTokens || 1024,
            search_domain_filter: options?.searchDomains || [],
            return_images: options?.returnImages || false,
            return_related_questions: options?.returnRelatedQuestions || false,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
          }
        )
      );

      const latency = Date.now() - startTime;
      const content = response.data.choices[0].message.content;
      const usage = {
        promptTokens: 0, // Perplexity doesn't provide token counts
        completionTokens: 0,
        totalTokens: 0,
        cost: this.COST_PER_REQUEST,
      };

      return {
        content,
        usage,
        provider: 'perplexity',
        model: response.data.model,
        latency,
      };
    } catch (error) {
      this.logger.error('Perplexity API error:', error);
      throw error;
    }
  }

  async generateEmbedding(text: string): Promise<number[]> {
    throw new Error('Perplexity does not support embeddings.');
  }

  estimateCost(tokens: number): number {
    return this.COST_PER_REQUEST;
  }

  async checkAvailability(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.baseUrl}/models`, {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
          },
        })
      );
      return response.status === 200;
    } catch (error) {
      this.logger.warn('Perplexity service unavailable:', error.message);
      return false;
    }
  }
}
```

## Rate Limiting & Fallbacks

### Rate Limiter Implementation

```typescript
// packages/ai/src/utils/rate-limiter.ts
import { Injectable } from '@nestjs/common';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';

interface RateLimitConfig {
  provider: string;
  requestsPerMinute: number;
  requestsPerHour: number;
  tokensPerMinute: number;
  tokensPerHour: number;
}

@Injectable()
export class AIRateLimiter {
  private limiters: Map<string, RateLimiterMemory> = new Map();
  
  constructor() {
    this.initializeLimiters();
  }

  private initializeLimiters() {
    // Claude rate limits
    this.createLimiter('claude-rpm', 50); // 50 requests per minute
    this.createLimiter('claude-rph', 1000); // 1000 requests per hour
    this.createLimiter('claude-tpm', 100000); // 100k tokens per minute
    this.createLimiter('claude-tph', 2000000); // 2M tokens per hour

    // OpenAI rate limits
    this.createLimiter('openai-rpm', 500); // 500 requests per minute
    this.createLimiter('openai-rph', 10000); // 10k requests per hour
    this.createLimiter('openai-tpm', 150000); // 150k tokens per minute
    this.createLimiter('openai-tph', 3000000); // 3M tokens per hour

    // Perplexity rate limits
    this.createLimiter('perplexity-rpm', 20); // 20 requests per minute
    this.createLimiter('perplexity-rph', 300); // 300 requests per hour
  }

  private createLimiter(key: string, points: number) {
    const duration = key.endsWith('rpm') ? 60 : 3600; // 1 minute or 1 hour
    
    this.limiters.set(key, new RateLimiterMemory({
      keyPrefix: key,
      points,
      duration,
    }));
  }

  async checkLimit(provider: string, type: 'request' | 'tokens', amount: number = 1): Promise<boolean> {
    const rpmKey = `${provider}-rpm`;
    const rphKey = `${provider}-rph`;
    
    try {
      if (type === 'request') {
        await this.limiters.get(rpmKey).consume('global', amount);
        await this.limiters.get(rphKey).consume('global', amount);
      } else {
        const tpmKey = `${provider}-tpm`;
        const tphKey = `${provider}-tph`;
        await this.limiters.get(tpmKey).consume('global', amount);
        await this.limiters.get(tphKey).consume('global', amount);
      }
      return true;
    } catch (rejRes) {
      return false;
    }
  }

  async getWaitTime(provider: string, type: 'request' | 'tokens'): Promise<number> {
    const key = type === 'request' ? `${provider}-rpm` : `${provider}-tpm`;
    const limiter = this.limiters.get(key);
    
    try {
      const res = await limiter.get('global');
      return res ? res.msBeforeNext : 0;
    } catch {
      return 0;
    }
  }
}
```

### AI Service with Fallbacks

```typescript
// packages/ai/src/services/ai-orchestrator.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { AIServiceFactory } from './ai-service.factory';
import { AIRateLimiter } from '../utils/rate-limiter';
import { CacheService } from '@/cache/cache.service';
import { MetricsService } from '@/monitoring/metrics.service';

@Injectable()
export class AIOrchestrator {
  private readonly logger = new Logger(AIOrchestrator.name);
  
  constructor(
    private aiServiceFactory: AIServiceFactory,
    private rateLimiter: AIRateLimiter,
    private cacheService: CacheService,
    private metricsService: MetricsService,
  ) {}

  async generateCompletion(
    prompt: string,
    options?: {
      preferredProviders?: string[];
      cacheKey?: string;
      cacheTTL?: number;
      maxRetries?: number;
    }
  ): Promise<any> {
    const providers = options?.preferredProviders || ['claude', 'openai'];
    const cacheKey = options?.cacheKey;
    
    // Check cache first
    if (cacheKey) {
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        this.logger.debug(`Cache hit for key: ${cacheKey}`);
        return cached;
      }
    }

    // Try each provider with rate limiting and fallback
    for (const provider of providers) {
      try {
        // Check rate limits
        const canProceed = await this.rateLimiter.checkLimit(provider, 'request');
        if (!canProceed) {
          const waitTime = await this.rateLimiter.getWaitTime(provider, 'request');
          this.logger.warn(`Rate limit hit for ${provider}, wait ${waitTime}ms`);
          continue;
        }

        // Get service and make request
        const service = this.aiServiceFactory.getService(provider);
        const response = await service.generateCompletion(prompt, options);

        // Check token limits
        await this.rateLimiter.checkLimit(provider, 'tokens', response.usage.totalTokens);

        // Cache successful response
        if (cacheKey) {
          await this.cacheService.set(cacheKey, response, options.cacheTTL || 3600);
        }

        // Record success metric
        this.metricsService.recordAISuccess(provider);

        return response;
      } catch (error) {
        this.logger.error(`Failed with ${provider}:`, error);
        this.metricsService.recordAIError(provider, error.message);
        
        // Continue to next provider
        if (providers.indexOf(provider) < providers.length - 1) {
          continue;
        }
        
        // All providers failed
        throw new Error(`All AI providers failed. Last error: ${error.message}`);
      }
    }
  }

  async generateEmbedding(text: string, options?: any): Promise<number[]> {
    // Only OpenAI supports embeddings
    const service = this.aiServiceFactory.getService('openai');
    return service.generateEmbedding(text);
  }

  async searchWithAI(query: string, options?: any): Promise<any> {
    // Use Perplexity for search-enhanced responses
    const service = this.aiServiceFactory.getService('perplexity');
    return service.generateCompletion(query, {
      ...options,
      searchDomains: options?.domains || [],
      returnRelatedQuestions: true,
    });
  }
}
```

## Cost Optimization

### Cost Tracking Service

```typescript
// packages/ai/src/services/ai-cost-tracker.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/prisma/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class AICostTracker {
  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
  ) {}

  async trackUsage(data: {
    userId: string;
    workspaceId: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
    purpose: string;
  }): Promise<void> {
    // Save to database
    await this.prisma.aiUsage.create({
      data: {
        userId: data.userId,
        workspaceId: data.workspaceId,
        provider: data.provider,
        model: data.model,
        promptTokens: data.promptTokens,
        completionTokens: data.completionTokens,
        totalTokens: data.totalTokens,
        cost: data.cost,
        purpose: data.purpose,
        timestamp: new Date(),
      },
    });

    // Check budget alerts
    await this.checkBudgetAlerts(data.workspaceId);
  }

  async checkBudgetAlerts(workspaceId: string): Promise<void> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: { subscription: true },
    });

    if (!workspace?.subscription?.aiBudgetLimit) return;

    // Get current month usage
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const usage = await this.prisma.aiUsage.aggregate({
      where: {
        workspaceId,
        timestamp: { gte: startOfMonth },
      },
      _sum: { cost: true },
    });

    const totalCost = usage._sum.cost || 0;
    const budgetLimit = workspace.subscription.aiBudgetLimit;
    const usagePercent = (totalCost / budgetLimit) * 100;

    // Send alerts at 50%, 80%, 90%, and 100%
    if (usagePercent >= 50 && usagePercent < 55) {
      this.eventEmitter.emit('ai.budget.alert', {
        workspaceId,
        level: '50%',
        currentUsage: totalCost,
        limit: budgetLimit,
      });
    } else if (usagePercent >= 80 && usagePercent < 85) {
      this.eventEmitter.emit('ai.budget.alert', {
        workspaceId,
        level: '80%',
        currentUsage: totalCost,
        limit: budgetLimit,
      });
    } else if (usagePercent >= 90 && usagePercent < 95) {
      this.eventEmitter.emit('ai.budget.alert', {
        workspaceId,
        level: '90%',
        currentUsage: totalCost,
        limit: budgetLimit,
      });
    } else if (usagePercent >= 100) {
      this.eventEmitter.emit('ai.budget.exceeded', {
        workspaceId,
        currentUsage: totalCost,
        limit: budgetLimit,
      });
    }
  }

  async getUsageReport(workspaceId: string, startDate: Date, endDate: Date) {
    const usage = await this.prisma.aiUsage.groupBy({
      by: ['provider', 'model', 'purpose'],
      where: {
        workspaceId,
        timestamp: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        promptTokens: true,
        completionTokens: true,
        totalTokens: true,
        cost: true,
      },
      _count: true,
    });

    const totalCost = usage.reduce((sum, item) => sum + (item._sum.cost || 0), 0);

    return {
      period: { startDate, endDate },
      totalCost,
      breakdown: usage,
      recommendations: this.generateCostRecommendations(usage),
    };
  }

  private generateCostRecommendations(usage: any[]): string[] {
    const recommendations = [];

    // Check for expensive model usage
    const expensiveModels = usage.filter(u => 
      u.model === 'gpt-4' || u.model === 'claude-3-opus'
    );
    
    if (expensiveModels.length > 0) {
      const cheaperUsage = usage.filter(u => 
        u.model === 'gpt-3.5-turbo' || u.model === 'claude-3-haiku'
      );
      
      if (cheaperUsage.length < expensiveModels.length) {
        recommendations.push(
          'Consider using cheaper models (GPT-3.5 or Claude Haiku) for simple tasks'
        );
      }
    }

    // Check for high token usage
    const highTokenUsage = usage.filter(u => 
      u._sum.totalTokens / u._count > 2000
    );
    
    if (highTokenUsage.length > 0) {
      recommendations.push(
        'Optimize prompts to reduce token usage. Average completion is over 2000 tokens.'
      );
    }

    // Check for cacheable queries
    const duplicatePurposes = usage.filter(u => u._count > 10);
    if (duplicatePurposes.length > 0) {
      recommendations.push(
        'Enable response caching for frequently repeated AI queries'
      );
    }

    return recommendations;
  }
}
```

## Testing AI Services

### Unit Tests

```typescript
// packages/ai/src/services/__tests__/ai-orchestrator.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AIOrchestrator } from '../ai-orchestrator.service';
import { AIServiceFactory } from '../ai-service.factory';
import { AIRateLimiter } from '../../utils/rate-limiter';
import { CacheService } from '@/cache/cache.service';
import { MetricsService } from '@/monitoring/metrics.service';

describe('AIOrchestrator', () => {
  let orchestrator: AIOrchestrator;
  let mockFactory: jest.Mocked<AIServiceFactory>;
  let mockRateLimiter: jest.Mocked<AIRateLimiter>;
  let mockCache: jest.Mocked<CacheService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AIOrchestrator,
        {
          provide: AIServiceFactory,
          useValue: {
            getService: jest.fn(),
          },
        },
        {
          provide: AIRateLimiter,
          useValue: {
            checkLimit: jest.fn(),
            getWaitTime: jest.fn(),
          },
        },
        {
          provide: CacheService,
          useValue: {
            get: jest.fn(),
            set: jest.fn(),
          },
        },
        {
          provide: MetricsService,
          useValue: {
            recordAISuccess: jest.fn(),
            recordAIError: jest.fn(),
          },
        },
      ],
    }).compile();

    orchestrator = module.get<AIOrchestrator>(AIOrchestrator);
    mockFactory = module.get(AIServiceFactory);
    mockRateLimiter = module.get(AIRateLimiter);
    mockCache = module.get(CacheService);
  });

  describe('generateCompletion', () => {
    it('should return cached response if available', async () => {
      const cachedResponse = { content: 'cached', provider: 'cache' };
      mockCache.get.mockResolvedValue(cachedResponse);

      const result = await orchestrator.generateCompletion('test prompt', {
        cacheKey: 'test-key',
      });

      expect(result).toEqual(cachedResponse);
      expect(mockFactory.getService).not.toHaveBeenCalled();
    });

    it('should fallback to next provider on failure', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRateLimiter.checkLimit.mockResolvedValue(true);

      const mockClaudeService = {
        generateCompletion: jest.fn().mockRejectedValue(new Error('Claude failed')),
      };
      const mockOpenAIService = {
        generateCompletion: jest.fn().mockResolvedValue({
          content: 'OpenAI response',
          usage: { totalTokens: 100 },
          provider: 'openai',
        }),
      };

      mockFactory.getService
        .mockReturnValueOnce(mockClaudeService as any)
        .mockReturnValueOnce(mockOpenAIService as any);

      const result = await orchestrator.generateCompletion('test prompt', {
        preferredProviders: ['claude', 'openai'],
      });

      expect(result.provider).toBe('openai');
      expect(mockClaudeService.generateCompletion).toHaveBeenCalled();
      expect(mockOpenAIService.generateCompletion).toHaveBeenCalled();
    });

    it('should respect rate limits', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRateLimiter.checkLimit
        .mockResolvedValueOnce(false) // Claude rate limited
        .mockResolvedValueOnce(true); // OpenAI available

      mockRateLimiter.getWaitTime.mockResolvedValue(5000);

      const mockOpenAIService = {
        generateCompletion: jest.fn().mockResolvedValue({
          content: 'OpenAI response',
          usage: { totalTokens: 100 },
          provider: 'openai',
        }),
      };

      mockFactory.getService.mockReturnValue(mockOpenAIService as any);

      const result = await orchestrator.generateCompletion('test prompt', {
        preferredProviders: ['claude', 'openai'],
      });

      expect(result.provider).toBe('openai');
      expect(mockRateLimiter.checkLimit).toHaveBeenCalledTimes(3); // 2 for request, 1 for tokens
    });

    it('should throw error when all providers fail', async () => {
      mockCache.get.mockResolvedValue(null);
      mockRateLimiter.checkLimit.mockResolvedValue(true);

      const mockService = {
        generateCompletion: jest.fn().mockRejectedValue(new Error('Service failed')),
      };

      mockFactory.getService.mockReturnValue(mockService as any);

      await expect(
        orchestrator.generateCompletion('test prompt', {
          preferredProviders: ['claude'],
        })
      ).rejects.toThrow('All AI providers failed');
    });
  });
});
```

### Integration Tests

```typescript
// packages/ai/e2e/ai-service.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AIModule } from '../src/ai.module';
import { AIOrchestrator } from '../src/services/ai-orchestrator.service';

describe('AI Service Integration (e2e)', () => {
  let app: INestApplication;
  let orchestrator: AIOrchestrator;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: '.env.test',
        }),
        AIModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    orchestrator = app.get<AIOrchestrator>(AIOrchestrator);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Real AI Provider Tests', () => {
    it('should generate completion with Claude', async () => {
      const response = await orchestrator.generateCompletion(
        'What is 2+2? Reply with just the number.',
        { preferredProviders: ['claude'] }
      );

      expect(response.content).toContain('4');
      expect(response.provider).toBe('claude');
      expect(response.usage.totalTokens).toBeGreaterThan(0);
      expect(response.usage.cost).toBeGreaterThan(0);
    }, 30000);

    it('should generate embedding with OpenAI', async () => {
      const embedding = await orchestrator.generateEmbedding(
        'This is a test sentence for embedding.'
      );

      expect(embedding).toBeInstanceOf(Array);
      expect(embedding.length).toBe(1536); // text-embedding-3-small dimension
      expect(embedding[0]).toBeInstanceOf(Number);
    }, 30000);

    it('should search with Perplexity', async () => {
      const response = await orchestrator.searchWithAI(
        'What is the current weather in New York?',
        { domains: ['weather.com', 'weather.gov'] }
      );

      expect(response.content).toBeTruthy();
      expect(response.provider).toBe('perplexity');
    }, 30000);

    it('should handle provider fallback', async () => {
      // Force Claude to fail by using invalid API key
      process.env.AI_CLAUDE_API_KEY = 'invalid-key';

      const response = await orchestrator.generateCompletion(
        'Test fallback behavior',
        { preferredProviders: ['claude', 'openai'] }
      );

      expect(response.provider).toBe('openai');
    }, 30000);
  });
});
```

## Production Considerations

### Environment Configuration

```bash
# .env.production
# AI Service Configuration
AI_CLAUDE_API_KEY=your-claude-api-key
AI_OPENAI_API_KEY=your-openai-api-key
AI_PERPLEXITY_API_KEY=your-perplexity-api-key

# AI Service Preferences
AI_PRIMARY_PROVIDER=claude
AI_FALLBACK_PROVIDERS=openai,perplexity
AI_ENABLE_CACHING=true
AI_CACHE_TTL=3600

# Rate Limiting
AI_RATE_LIMIT_ENABLED=true
AI_REQUESTS_PER_MINUTE=50
AI_TOKENS_PER_MINUTE=100000

# Cost Control
AI_BUDGET_ALERTS_ENABLED=true
AI_MONTHLY_BUDGET_USD=1000
AI_COST_ALERT_THRESHOLDS=50,80,90,100

# Model Selection
AI_DEFAULT_CHAT_MODEL=claude-3-opus-20240229
AI_DEFAULT_FAST_MODEL=claude-3-haiku-20240307
AI_DEFAULT_EMBEDDING_MODEL=text-embedding-3-small

# Monitoring
AI_METRICS_ENABLED=true
AI_LOG_LEVEL=info
AI_TRACE_SAMPLING_RATE=0.1
```

### Deployment Checklist

```yaml
# k8s/ai-service-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ai-service
  namespace: crm-production
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ai-service
  template:
    metadata:
      labels:
        app: ai-service
    spec:
      containers:
      - name: ai-service
        image: hastecrm/ai-service:latest
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
        env:
        - name: AI_CLAUDE_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: claude-api-key
        - name: AI_OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: openai-api-key
        - name: AI_PERPLEXITY_API_KEY
          valueFrom:
            secretKeyRef:
              name: ai-secrets
              key: perplexity-api-key
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Monitoring Dashboard

```typescript
// packages/ai/src/monitoring/ai-metrics.dashboard.ts
export const AI_METRICS_DASHBOARD = {
  panels: [
    {
      title: 'AI Request Rate',
      query: 'rate(ai_requests_total[5m])',
      type: 'graph',
    },
    {
      title: 'AI Response Time',
      query: 'histogram_quantile(0.95, ai_request_duration_seconds_bucket)',
      type: 'graph',
    },
    {
      title: 'AI Error Rate',
      query: 'rate(ai_errors_total[5m])',
      type: 'graph',
    },
    {
      title: 'AI Cost per Hour',
      query: 'increase(ai_cost_usd_total[1h])',
      type: 'stat',
    },
    {
      title: 'Token Usage by Provider',
      query: 'sum by(provider) (increase(ai_tokens_total[1h]))',
      type: 'piechart',
    },
    {
      title: 'Provider Availability',
      query: 'ai_provider_available',
      type: 'table',
    },
  ],
  alerts: [
    {
      name: 'AIHighErrorRate',
      expr: 'rate(ai_errors_total[5m]) > 0.1',
      for: '5m',
      severity: 'warning',
    },
    {
      name: 'AIProviderDown',
      expr: 'ai_provider_available == 0',
      for: '2m',
      severity: 'critical',
    },
    {
      name: 'AIBudgetExceeded',
      expr: 'ai_monthly_cost_usd > 1000',
      for: '1m',
      severity: 'critical',
    },
  ],
};
```

This complete AI integration guide provides all the implementation details needed for Claude Code to build the AI features autonomously.