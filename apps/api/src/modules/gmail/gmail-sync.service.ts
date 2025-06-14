import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { GmailService } from "./gmail.service";
import { EmailAccountService } from "./email-account.service";
import { EmailService } from "./email.service";
import { EmailParserService } from "./email-parser.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GmailSyncService {
  private readonly logger = new Logger(GmailSyncService.name);

  constructor(
    private gmailService: GmailService,
    private emailAccountService: EmailAccountService,
    private emailService: EmailService,
    private emailParserService: EmailParserService,
    private prisma: PrismaService,
    @InjectQueue("gmail-sync") private gmailSyncQueue: Queue,
  ) {}

  /**
   * Sync an email account
   */
  async syncAccount(
    accountId: string,
    options?: {
      fullSync?: boolean;
      source?: string;
    },
  ): Promise<void> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    this.logger.log(
      `Starting sync for ${account.email} (source: ${options?.source || "manual"})`,
    );

    try {
      if (options?.fullSync) {
        await this.performFullSync(accountId);
      } else {
        await this.performIncrementalSync(accountId);
      }
    } catch (error: any) {
      this.logger.error(`Sync failed for ${account.email}:`, error);
      await this.emailAccountService.recordSyncError(
        accountId,
        error.message || "Sync failed",
      );
      throw error;
    }
  }

  /**
   * Perform full sync
   */
  private async performFullSync(accountId: string): Promise<void> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const accessToken =
      await this.emailAccountService.getFreshAccessToken(accountId);

    // Get messages list
    const messages = await this.gmailService.listMessages(
      accessToken,
      undefined,
      undefined,
      50, // Sync last 50 messages
    );

    if (!messages.messages) {
      this.logger.log(`No messages found for ${account.email}`);
      return;
    }

    // Queue fetch jobs for each message
    for (const message of messages.messages) {
      if (message.id && message.threadId) {
        await this.gmailSyncQueue.add(
          "fetch-message",
          {
            accountId,
            messageId: message.id,
            threadId: message.threadId,
          },
          {
            priority: 2,
          },
        );
      }
    }

    // Get current history ID
    const profile = await this.gmailService.getProfile(accessToken);
    await this.emailAccountService.recordSuccessfulSync(
      accountId,
      profile.historyId,
    );

    this.logger.log(
      `Queued ${messages.messages.length} messages for ${account.email}`,
    );
  }

  /**
   * Perform incremental sync using history
   */
  private async performIncrementalSync(accountId: string): Promise<void> {
    await this.gmailSyncQueue.add(
      "sync-history",
      {
        accountId,
        trigger: "manual",
      },
      {
        priority: 1,
      },
    );
  }

  /**
   * Fetch and store a single message
   */
  async fetchAndStoreMessage(
    accountId: string,
    messageId: string,
    threadId: string,
  ): Promise<void> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const accessToken =
      await this.emailAccountService.getFreshAccessToken(accountId);

    // Fetch full message
    const message = await this.gmailService.getMessage(accessToken, messageId);
    if (!message) {
      this.logger.warn(`Message ${messageId} not found`);
      return;
    }

    // Parse message
    const parsed = this.emailParserService.parseGmailMessage(message);

    // Determine direction
    const direction = this.emailParserService.extractDirection(
      parsed.fromEmail,
      account.email,
    );

    // Find sender user
    const sender = await this.prisma.user.findUnique({
      where: { email: parsed.fromEmail },
    });

    // Store email
    await this.emailService.upsert({
      workspaceId: account.workspaceId,
      accountId: account.id,
      messageId,
      threadId,
      ...parsed,
      direction,
      senderId: sender?.id || account.userId, // Default to account owner
      gmailHistoryId: message.historyId,
    });

    // Process attachments if any
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const attachment of parsed.attachments) {
        await this.gmailSyncQueue.add(
          "download-attachment",
          {
            accountId,
            messageId,
            attachmentId: attachment.id,
            filename: attachment.filename,
            mimeType: attachment.mimeType,
            size: attachment.size,
          },
          {
            priority: 3,
          },
        );
      }
    }

    this.logger.debug(`Stored message ${messageId} for ${account.email}`);
  }

  /**
   * Download and store attachment
   */
  async downloadAttachment(
    accountId: string,
    messageId: string,
    attachmentId: string,
    filename: string,
    _mimeType: string,
    _size: number,
  ): Promise<void> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const accessToken =
      await this.emailAccountService.getFreshAccessToken(accountId);

    // Get email
    const email = await this.emailService.findByMessageId(messageId);
    if (!email) {
      this.logger.warn(`Email ${messageId} not found for attachment`);
      return;
    }

    try {
      // Download attachment
      const attachmentData = await this.gmailService.getAttachment(
        accessToken,
        messageId,
        attachmentId,
      );

      if (!attachmentData.data) {
        this.logger.warn(`No data for attachment ${attachmentId}`);
        return;
      }

      // TODO: Upload to storage service and get URL
      // For now, we'll store a placeholder URL
      const url = `attachment://${messageId}/${attachmentId}/${filename}`;

      // Update attachment record
      await this.prisma.emailAttachment.updateMany({
        where: {
          emailId: email.id,
          gmailId: attachmentId,
        },
        data: {
          url,
        },
      });

      this.logger.debug(
        `Downloaded attachment ${filename} for message ${messageId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to download attachment ${attachmentId}:`,
        error,
      );
    }
  }

  /**
   * Get sync status for all accounts
   */
  async getSyncStatus(workspaceId: string): Promise<any[]> {
    const accounts =
      await this.emailAccountService.findByWorkspace(workspaceId);

    return Promise.all(
      accounts.map(async (account) => {
        const emailCount = await this.prisma.email.count({
          where: { accountId: account.id },
        });

        return {
          id: account.id,
          email: account.email,
          syncEnabled: account.syncEnabled,
          syncMode: account.syncMode,
          syncStatus: account.syncStatus,
          lastSyncAt: account.lastSyncAt,
          lastError: account.lastError,
          emailCount,
          watchExpiration: account.watchExpiration,
        };
      }),
    );
  }
}
