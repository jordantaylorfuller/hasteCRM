import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Email, Prisma } from "../prisma/prisma-client";

interface EmailCreateInput {
  workspaceId: string;
  accountId: string;
  messageId: string;
  threadId: string;
  subject?: string;
  snippet?: string;
  bodyHtml?: string;
  bodyText?: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  toNames: string[];
  ccEmails: string[];
  ccNames: string[];
  bccEmails: string[];
  bccNames: string[];
  direction: "INBOUND" | "OUTBOUND";
  sentAt: Date;
  receivedAt: Date;
  gmailLabels: string[];
  gmailHistoryId?: string;
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  senderId: string;
  contactId?: string;
  dealId?: string;
  attachments?: Array<{
    filename: string;
    mimeType: string;
    size: number;
    gmailId?: string;
  }>;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create or update an email
   */
  async upsert(data: EmailCreateInput): Promise<Email> {
    const { attachments, ...emailData } = data;

    // Create or update email
    const email = await this.prisma.email.upsert({
      where: { messageId: data.messageId },
      create: emailData,
      update: {
        ...emailData,
        updatedAt: new Date(),
      },
      include: {
        attachments: true,
      },
    });

    // Handle attachments
    if (attachments && attachments.length > 0) {
      // Delete existing attachments
      await this.prisma.emailAttachment.deleteMany({
        where: { emailId: email.id },
      });

      // Create new attachments
      await this.prisma.emailAttachment.createMany({
        data: attachments.map((att) => ({
          emailId: email.id,
          filename: att.filename,
          mimeType: att.mimeType,
          size: att.size,
          gmailId: att.gmailId,
          url: "", // Will be updated when downloaded
        })),
      });
    }

    return email;
  }

  /**
   * Find email by message ID
   */
  async findByMessageId(messageId: string): Promise<Email | null> {
    return this.prisma.email.findUnique({
      where: { messageId },
      include: {
        attachments: true,
      },
    });
  }

  /**
   * Find emails for a workspace
   */
  async findByWorkspace(
    workspaceId: string,
    options?: {
      skip?: number;
      take?: number;
      where?: Prisma.EmailWhereInput;
      orderBy?: Prisma.EmailOrderByWithRelationInput;
    },
  ): Promise<{ emails: Email[]; total: number }> {
    const where: Prisma.EmailWhereInput = {
      workspaceId,
      ...options?.where,
    };

    const [emails, total] = await Promise.all([
      this.prisma.email.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 20,
        orderBy: options?.orderBy || { sentAt: "desc" },
        include: {
          attachments: true,
        },
      }),
      this.prisma.email.count({ where }),
    ]);

    return { emails, total };
  }

  /**
   * Find emails by thread
   */
  async findByThread(threadId: string): Promise<Email[]> {
    return this.prisma.email.findMany({
      where: { threadId },
      orderBy: { sentAt: "asc" },
      include: {
        attachments: true,
      },
    });
  }

  /**
   * Find emails by contact
   */
  async findByContact(contactId: string): Promise<Email[]> {
    return this.prisma.email.findMany({
      where: { contactId },
      orderBy: { sentAt: "desc" },
      include: {
        attachments: true,
      },
    });
  }

  /**
   * Find emails by deal
   */
  async findByDeal(dealId: string): Promise<Email[]> {
    return this.prisma.email.findMany({
      where: { dealId },
      orderBy: { sentAt: "desc" },
      include: {
        attachments: true,
      },
    });
  }

  /**
   * Search emails
   */
  async search(
    workspaceId: string,
    query: string,
    options?: {
      skip?: number;
      take?: number;
    },
  ): Promise<{ emails: Email[]; total: number }> {
    const where: Prisma.EmailWhereInput = {
      workspaceId,
      OR: [
        { subject: { contains: query, mode: "insensitive" } },
        { bodyText: { contains: query, mode: "insensitive" } },
        { fromEmail: { contains: query, mode: "insensitive" } },
        { fromName: { contains: query, mode: "insensitive" } },
      ],
    };

    const [emails, total] = await Promise.all([
      this.prisma.email.findMany({
        where,
        skip: options?.skip || 0,
        take: options?.take || 20,
        orderBy: { sentAt: "desc" },
        include: {
          attachments: true,
        },
      }),
      this.prisma.email.count({ where }),
    ]);

    return { emails, total };
  }

  /**
   * Mark email as read
   */
  async markAsRead(messageId: string): Promise<Email> {
    return this.prisma.email.update({
      where: { messageId },
      data: { isRead: true },
    });
  }

  /**
   * Mark email as unread
   */
  async markAsUnread(messageId: string): Promise<Email> {
    return this.prisma.email.update({
      where: { messageId },
      data: { isRead: false },
    });
  }

  /**
   * Star/unstar email
   */
  async toggleStar(messageId: string): Promise<Email> {
    const email = await this.findByMessageId(messageId);
    if (!email) {
      throw new Error("Email not found");
    }

    return this.prisma.email.update({
      where: { messageId },
      data: { isStarred: !email.isStarred },
    });
  }

  /**
   * Mark email as deleted
   */
  async markAsDeleted(workspaceId: string, messageId: string): Promise<void> {
    await this.prisma.email.deleteMany({
      where: {
        workspaceId,
        messageId,
      },
    });
  }

  /**
   * Add labels to email
   */
  async addLabels(
    workspaceId: string,
    messageId: string,
    labelIds: string[],
  ): Promise<Email> {
    const email = await this.findByMessageId(messageId);
    if (!email || email.workspaceId !== workspaceId) {
      throw new Error("Email not found");
    }

    const newLabels = Array.from(new Set([...email.gmailLabels, ...labelIds]));

    return this.prisma.email.update({
      where: { messageId },
      data: { gmailLabels: newLabels },
    });
  }

  /**
   * Remove labels from email
   */
  async removeLabels(
    workspaceId: string,
    messageId: string,
    labelIds: string[],
  ): Promise<Email> {
    const email = await this.findByMessageId(messageId);
    if (!email || email.workspaceId !== workspaceId) {
      throw new Error("Email not found");
    }

    const newLabels = email.gmailLabels.filter(
      (label) => !labelIds.includes(label),
    );

    return this.prisma.email.update({
      where: { messageId },
      data: { gmailLabels: newLabels },
    });
  }

  /**
   * Get email statistics
   */
  async getStats(workspaceId: string): Promise<{
    total: number;
    unread: number;
    starred: number;
    sent: number;
    received: number;
  }> {
    const [total, unread, starred, sent, received] = await Promise.all([
      this.prisma.email.count({ where: { workspaceId } }),
      this.prisma.email.count({ where: { workspaceId, isRead: false } }),
      this.prisma.email.count({ where: { workspaceId, isStarred: true } }),
      this.prisma.email.count({
        where: { workspaceId, direction: "OUTBOUND" },
      }),
      this.prisma.email.count({ where: { workspaceId, direction: "INBOUND" } }),
    ]);

    return { total, unread, starred, sent, received };
  }

  /**
   * Record email open
   */
  async recordOpen(messageId: string, metadata?: any): Promise<void> {
    const email = await this.findByMessageId(messageId);
    if (!email) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.email.update({
        where: { messageId },
        data: {
          openCount: { increment: 1 },
          firstOpenedAt: email.firstOpenedAt || new Date(),
          lastOpenedAt: new Date(),
        },
      }),
      this.prisma.emailTrackingEvent.create({
        data: {
          emailId: email.id,
          type: "open",
          metadata,
        },
      }),
    ]);
  }

  /**
   * Record email click
   */
  async recordClick(
    messageId: string,
    url: string,
    metadata?: any,
  ): Promise<void> {
    const email = await this.findByMessageId(messageId);
    if (!email) {
      return;
    }

    await this.prisma.$transaction([
      this.prisma.email.update({
        where: { messageId },
        data: {
          clickCount: { increment: 1 },
        },
      }),
      this.prisma.emailTrackingEvent.create({
        data: {
          emailId: email.id,
          type: "click",
          metadata: {
            url,
            ...metadata,
          },
        },
      }),
    ]);
  }
}
