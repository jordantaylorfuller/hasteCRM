import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { GmailSyncService } from "../gmail-sync.service";

interface MessageFetchJob {
  accountId: string;
  messageId: string;
  threadId: string;
}

interface AttachmentDownloadJob {
  accountId: string;
  messageId: string;
  attachmentId: string;
  filename: string;
  mimeType: string;
  size: number;
}

interface FullSyncJob {
  accountId: string;
  maxResults?: number;
}

@Processor("gmail-sync")
export class MessageFetchProcessor extends WorkerHost {
  private readonly logger = new Logger(MessageFetchProcessor.name);

  constructor(private gmailSyncService: GmailSyncService) {
    super();
  }

  async process(job: Job<any>) {
    switch (job.name) {
      case "fetch-message":
        return this.processFetchMessage(job);
      case "download-attachment":
        return this.processDownloadAttachment(job);
      case "full-sync":
        return this.processFullSync(job);
    }
  }

  async processFetchMessage(job: Job<MessageFetchJob>) {
    const { accountId, messageId, threadId } = job.data;

    try {
      await this.gmailSyncService.fetchAndStoreMessage(
        accountId,
        messageId,
        threadId,
      );

      this.logger.log(`Fetched and stored message ${messageId}`);
    } catch (error: any) {
      this.logger.error(`Failed to fetch message ${messageId}:`, error);
      throw error;
    }
  }

  async processDownloadAttachment(job: Job<AttachmentDownloadJob>) {
    const { accountId, messageId, attachmentId, filename, mimeType, size } =
      job.data;

    try {
      await this.gmailSyncService.downloadAttachment(
        accountId,
        messageId,
        attachmentId,
        filename,
        mimeType,
        size,
      );

      this.logger.log(
        `Downloaded attachment ${filename} for message ${messageId}`,
      );
    } catch (error: any) {
      this.logger.error(
        `Failed to download attachment ${attachmentId}:`,
        error,
      );
      // Don't throw - attachment download failures shouldn't fail the job
    }
  }

  async processFullSync(job: Job<FullSyncJob>) {
    const { accountId } = job.data;

    try {
      await this.gmailSyncService.syncAccount(accountId, {
        fullSync: true,
        source: "job",
      });

      this.logger.log(`Full sync completed for account ${accountId}`);
    } catch (error: any) {
      this.logger.error(`Full sync failed for account ${accountId}:`, error);
      throw error;
    }
  }
}
