import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import Anthropic from "@anthropic-ai/sdk";
import { EmailService } from "../gmail/email.service";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";

interface EmailSummarizationOptions {
  includeActionItems?: boolean;
  includeKeyPoints?: boolean;
  maxLength?: number;
}

interface SmartComposeOptions {
  tone?: "formal" | "casual" | "friendly" | "professional";
  length?: "short" | "medium" | "long";
  includeContext?: boolean;
}

interface ContactEnrichmentData {
  company?: string;
  title?: string;
  linkedInUrl?: string;
  summary?: string;
  tags?: string[];
}

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private anthropic: Anthropic;
  private readonly useMockAi: boolean;

  constructor(
    private configService: ConfigService,
    private emailService: EmailService,
    private contactsService: ContactsService,
    private prisma: PrismaService,
  ) {
    const apiKey = this.configService.get<string>("ANTHROPIC_API_KEY");
    this.useMockAi = this.configService.get<boolean>("USE_MOCK_AI", true);

    if (!this.useMockAi && apiKey) {
      this.anthropic = new Anthropic({
        apiKey,
      });
    } else {
      this.logger.warn("Using mock AI service - no API key configured");
    }
  }

  /**
   * Summarize an email or email thread
   */
  async summarizeEmail(
    emailId: string,
    options: EmailSummarizationOptions = {},
  ): Promise<{
    summary: string;
    actionItems?: string[];
    keyPoints?: string[];
  }> {
    try {
      const email = await this.emailService.findByMessageId(emailId);
      if (!email) {
        throw new Error("Email not found");
      }

      // For threads, get all emails in the thread
      let content = email.textContent || email.htmlContent || "";
      if (email.threadId) {
        const threadEmails = await this.emailService.findByThread(
          email.threadId,
        );
        if (threadEmails && threadEmails.length > 0) {
          content = threadEmails
            .map(
              (e) =>
                `From: ${e.from}\nDate: ${e.sentAt}\n\n${e.textContent || e.htmlContent || ""}`,
            )
            .join("\n\n---\n\n");
        }
      }

      if (this.useMockAi) {
        return this.mockSummarizeEmail(content, options);
      }

      const message = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: options.maxLength || 500,
        messages: [
          {
            role: "user",
            content: `Please summarize the following email thread concisely:

${content}

${options.includeActionItems ? "Include any action items." : ""}
${options.includeKeyPoints ? "Include key points." : ""}

Format the response as JSON with fields: summary, actionItems (array), keyPoints (array).`,
          },
        ],
      });

      const response = JSON.parse(message.content[0].text);
      return response;
    } catch (error) {
      this.logger.error("Failed to summarize email", error);
      throw error;
    }
  }

  /**
   * Generate smart compose suggestions for email replies
   */
  async generateSmartCompose(
    emailId: string,
    prompt: string,
    options: SmartComposeOptions = {},
  ): Promise<{
    suggestions: string[];
    fullDraft?: string;
  }> {
    try {
      const email = await this.emailService.findByMessageId(emailId);
      if (!email) {
        throw new Error("Email not found");
      }

      let context = "";
      if (options.includeContext && email.threadId) {
        const threadEmails = await this.emailService.findByThread(
          email.threadId,
        );
        if (threadEmails && threadEmails.length > 0) {
          context = threadEmails
            .slice(-3) // Last 3 emails for context
            .map(
              (e) =>
                `From: ${e.from}\n${e.textContent || e.htmlContent || ""}`,
            )
            .join("\n\n---\n\n");
        }
      }

      if (this.useMockAi) {
        return this.mockGenerateSmartCompose(prompt, context, options);
      }

      const message = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Generate email reply suggestions based on:

Context: ${context}
User's prompt: ${prompt}
Tone: ${options.tone || "professional"}
Length: ${options.length || "medium"}

Provide 3 different response options and one full draft. Format as JSON with fields: suggestions (array of 3 short suggestions), fullDraft (complete email draft).`,
          },
        ],
      });

      const response = JSON.parse(message.content[0].text);
      return response;
    } catch (error) {
      this.logger.error("Failed to generate smart compose", error);
      throw error;
    }
  }

  /**
   * Generate AI insights from communication patterns
   */
  async generateInsights(
    workspaceId: string,
    timeRange: { start: Date; end: Date },
  ): Promise<{
    communicationPatterns: any;
    topContacts: any[];
    suggestions: string[];
  }> {
    try {
      // Get email statistics
      const emailStats = await this.prisma.email.groupBy({
        by: ["from", "isRead", "isStarred"],
        where: {
          workspaceId,
          sentAt: {
            gte: timeRange.start,
            lte: timeRange.end,
          },
        },
        _count: true,
      });

      // Get contact interaction data
      const contactInteractions = await this.prisma.contact.findMany({
        where: {
          workspaceId,
          emails: {
            some: {
              sentAt: {
                gte: timeRange.start,
                lte: timeRange.end,
              },
            },
          },
        },
        include: {
          _count: {
            select: { emails: true },
          },
        },
        orderBy: {
          emails: {
            _count: "desc",
          },
        },
        take: 10,
      });

      if (this.useMockAi) {
        return this.mockGenerateInsights(emailStats, contactInteractions);
      }

      const message = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: `Analyze the following communication data and provide insights:

Email Statistics: ${JSON.stringify(emailStats)}
Top Contacts: ${JSON.stringify(contactInteractions)}

Generate insights about communication patterns, identify key relationships, and provide actionable suggestions. Format as JSON with fields: communicationPatterns (object), topContacts (array), suggestions (array of strings).`,
          },
        ],
      });

      const response = JSON.parse(message.content[0].text);
      return response;
    } catch (error) {
      this.logger.error("Failed to generate insights", error);
      throw error;
    }
  }

  /**
   * Enrich contact information using AI
   */
  async enrichContact(
    contactId: string,
  ): Promise<ContactEnrichmentData | null> {
    try {
      const contact = await this.contactsService.findOne(contactId);
      if (!contact) {
        throw new Error("Contact not found");
      }

      // Get recent emails from/to this contact
      const recentEmails = await this.prisma.email.findMany({
        where: {
          OR: [{ from: contact.email }, { to: { has: contact.email } }],
        },
        orderBy: { sentAt: "desc" },
        take: 10,
      });

      const emailContent = recentEmails
        .map((e) => e.textContent || e.htmlContent || "")
        .join("\n\n");

      if (this.useMockAi) {
        return this.mockEnrichContact(contact, emailContent);
      }

      const message = await this.anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `Based on the following information about a contact and their email communications, extract or infer additional details:

Contact: ${contact.firstName} ${contact.lastName} (${contact.email})
Current Info: ${JSON.stringify(contact)}

Email Communications:
${emailContent}

Extract or infer: company name, job title, LinkedIn URL (if mentioned), a brief professional summary, and relevant tags. Format as JSON with fields: company, title, linkedInUrl, summary, tags (array).`,
          },
        ],
      });

      const enrichmentData = JSON.parse(message.content[0].text);

      // Update contact with enriched data
      await this.contactsService.update(contactId, contact.workspaceId, {
        company: enrichmentData.company || contact.company,
        title: enrichmentData.title || contact.title,
        customFields: {
          ...contact.customFields,
          linkedInUrl: enrichmentData.linkedInUrl,
          aiSummary: enrichmentData.summary,
          aiTags: enrichmentData.tags,
        },
      });

      return enrichmentData;
    } catch (error) {
      this.logger.error("Failed to enrich contact", error);
      throw error;
    }
  }

  // Mock implementations for development
  private mockSummarizeEmail(
    content: string,
    options: EmailSummarizationOptions,
  ) {
    const summary =
      "This email discusses project updates and upcoming deadlines. The sender is requesting feedback on the proposal by end of week.";
    const actionItems = options.includeActionItems
      ? [
          "Review project proposal",
          "Provide feedback by Friday",
          "Schedule follow-up meeting",
        ]
      : undefined;
    const keyPoints = options.includeKeyPoints
      ? [
          "Project timeline has been updated",
          "Budget approval pending",
          "Team expansion planned for Q2",
        ]
      : undefined;

    return { summary, actionItems, keyPoints };
  }

  private mockGenerateSmartCompose(
    _prompt: string,
    _context: string,
    _options: SmartComposeOptions,
  ) {
    const suggestions = [
      "Thank you for the update. I'll review the proposal and get back to you by Friday.",
      "I appreciate the detailed information. Let me discuss this with my team and provide feedback soon.",
      "Thanks for sharing. I have a few questions about the timeline that we should discuss.",
    ];

    const fullDraft = `Hi,

Thank you for the update on the project. I've reviewed the information you've shared and have a few thoughts.

I'll make sure to review the proposal thoroughly and provide my feedback by Friday as requested. The timeline updates look reasonable, and I'm glad to see we're planning for team expansion in Q2.

Regarding the budget approval, do we have an estimated date for when that might come through? This would help us plan our resources more effectively.

Would it be helpful to schedule a brief call next week to discuss any questions that come up during my review?

Best regards`;

    return { suggestions, fullDraft };
  }

  private mockGenerateInsights(emailStats: any[], contactInteractions: any[]) {
    return {
      communicationPatterns: {
        totalEmails: emailStats.reduce((sum, stat) => sum + stat._count, 0),
        readRate: "87%",
        starRate: "12%",
        peakHours: ["9-11 AM", "2-4 PM"],
        avgResponseTime: "2.3 hours",
      },
      topContacts: contactInteractions.slice(0, 5).map((contact) => ({
        id: contact.id,
        name: `${contact.firstName} ${contact.lastName}`,
        email: contact.email,
        interactionCount: contact._count.emails,
        lastInteraction: new Date().toISOString(),
      })),
      suggestions: [
        "You have 15 unread emails from key contacts - consider setting aside time to respond",
        "Your response time is faster in the morning - schedule important emails for AM slots",
        "John Doe is your most frequent contact - consider adding them to your priority list",
        "Email volume peaks on Tuesdays - plan accordingly for better productivity",
      ],
    };
  }

  private mockEnrichContact(contact: any, _emailContent: string) {
    return {
      company: contact.company || "Acme Corporation",
      title: contact.title || "Senior Project Manager",
      linkedInUrl: "https://linkedin.com/in/example",
      summary:
        "Experienced project manager focusing on digital transformation initiatives. Key contact for enterprise software decisions.",
      tags: ["decision-maker", "technology", "enterprise", "project-management"],
    };
  }
}