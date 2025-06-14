import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { gmail_v1 } from "googleapis";
import { GmailService } from "./gmail.service";
import { EmailAccountService } from "./email-account.service";
import { EmailService } from "./email.service";

interface HistoryChange {
  messagesAdded?: Array<{
    message: gmail_v1.Schema$Message;
  }>;
  messagesDeleted?: Array<{
    message: gmail_v1.Schema$Message;
  }>;
  labelsAdded?: Array<{
    message: gmail_v1.Schema$Message;
    labelIds: string[];
  }>;
  labelsRemoved?: Array<{
    message: gmail_v1.Schema$Message;
    labelIds: string[];
  }>;
}

@Injectable()
export class GmailHistoryService {
  private readonly logger = new Logger(GmailHistoryService.name);

  constructor(
    private gmailService: GmailService,
    private emailAccountService: EmailAccountService,
    private emailService: EmailService,
    @InjectQueue("gmail-sync") private gmailSyncQueue: Queue,
  ) {}

  /**
   * Sync history for an account
   */
  async syncHistory(
    accountId: string,
    startHistoryId?: string,
  ): Promise<{
    messagesAdded: number;
    messagesDeleted: number;
    labelsChanged: number;
    newHistoryId: string;
  }> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const accessToken =
      await this.emailAccountService.getFreshAccessToken(accountId);

    // Use provided start history ID or account's last synced ID
    const historyId = startHistoryId || account.historyId;
    if (!historyId) {
      this.logger.warn(
        `No history ID for account ${account.email}, performing full sync`,
      );
      return this.performFullSync(accountId);
    }

    try {
      const history = await this.fetchHistory(accessToken, historyId);
      const results = await this.processHistory(account, history.changes);

      // Update account with new history ID
      await this.emailAccountService.recordSuccessfulSync(
        accountId,
        history.newHistoryId,
      );

      return {
        ...results,
        newHistoryId: history.newHistoryId,
      };
    } catch (error: any) {
      // If history ID is too old, perform full sync
      if (error.code === 404 || error.message?.includes("historyId")) {
        this.logger.warn(
          `History ID too old for ${account.email}, performing full sync`,
        );
        return this.performFullSync(accountId);
      }

      await this.emailAccountService.recordSyncError(
        accountId,
        error.message || "History sync failed",
      );
      throw error;
    }
  }

  /**
   * Fetch history from Gmail
   */
  private async fetchHistory(
    accessToken: string,
    startHistoryId: string,
  ): Promise<{
    changes: HistoryChange[];
    newHistoryId: string;
  }> {
    const changes: HistoryChange[] = [];
    let pageToken: string | undefined;
    let newHistoryId = startHistoryId;

    do {
      const historyData = await this.gmailService.getHistory(
        accessToken,
        startHistoryId,
        ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"],
        pageToken,
      );

      if (historyData.history) {
        changes.push(...(historyData.history as HistoryChange[]));
      }

      if (historyData.historyId) {
        newHistoryId = historyData.historyId;
      }

      pageToken = historyData.nextPageToken || undefined;
    } while (pageToken);

    return { changes, newHistoryId };
  }

  /**
   * Process history changes
   */
  private async processHistory(
    account: any,
    changes: HistoryChange[],
  ): Promise<{
    messagesAdded: number;
    messagesDeleted: number;
    labelsChanged: number;
  }> {
    const results = {
      messagesAdded: 0,
      messagesDeleted: 0,
      labelsChanged: 0,
    };

    for (const change of changes) {
      // Process added messages
      if (change.messagesAdded) {
        for (const item of change.messagesAdded) {
          if (item.message.id && item.message.threadId) {
            await this.queueMessageFetch(
              account.id,
              item.message.id,
              item.message.threadId,
            );
            results.messagesAdded++;
          }
        }
      }

      // Process deleted messages
      if (change.messagesDeleted) {
        for (const item of change.messagesDeleted) {
          if (item.message.id) {
            await this.emailService.markAsDeleted(
              account.workspaceId,
              item.message.id,
            );
            results.messagesDeleted++;
          }
        }
      }

      // Process label changes
      if (change.labelsAdded) {
        for (const item of change.labelsAdded) {
          if (item.message.id && item.labelIds) {
            await this.emailService.addLabels(
              account.workspaceId,
              item.message.id,
              item.labelIds,
            );
            results.labelsChanged++;
          }
        }
      }

      if (change.labelsRemoved) {
        for (const item of change.labelsRemoved) {
          if (item.message.id && item.labelIds) {
            await this.emailService.removeLabels(
              account.workspaceId,
              item.message.id,
              item.labelIds,
            );
            results.labelsChanged++;
          }
        }
      }
    }

    return results;
  }

  /**
   * Queue message fetch job
   */
  private async queueMessageFetch(
    accountId: string,
    messageId: string,
    threadId: string,
  ): Promise<void> {
    await this.gmailSyncQueue.add(
      "fetch-message",
      {
        accountId,
        messageId,
        threadId,
      },
      {
        priority: 2,
        attempts: 3,
      },
    );
  }

  /**
   * Perform full sync when history is not available
   */
  private async performFullSync(accountId: string): Promise<{
    messagesAdded: number;
    messagesDeleted: number;
    labelsChanged: number;
    newHistoryId: string;
  }> {
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      throw new Error("Account not found");
    }

    const accessToken =
      await this.emailAccountService.getFreshAccessToken(accountId);

    // Get profile to get current history ID
    const profile = await this.gmailService.getProfile(accessToken);
    const newHistoryId = profile.historyId || "1";

    // Queue full sync job
    await this.gmailSyncQueue.add(
      "full-sync",
      {
        accountId,
        maxResults: 100, // Sync last 100 messages
      },
      {
        priority: 3,
        attempts: 3,
      },
    );

    // Update account with new history ID
    await this.emailAccountService.update(accountId, {
      historyId: newHistoryId,
    });

    return {
      messagesAdded: 0, // Will be updated by full sync job
      messagesDeleted: 0,
      labelsChanged: 0,
      newHistoryId,
    };
  }
}
