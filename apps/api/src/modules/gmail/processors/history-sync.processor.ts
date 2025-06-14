import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Logger } from "@nestjs/common";
import { GmailHistoryService } from "../gmail-history.service";
import { EmailAccountService } from "../email-account.service";

interface HistorySyncJob {
  accountId: string;
  startHistoryId?: string;
  endHistoryId?: string;
  trigger: "webhook" | "manual" | "scheduled";
}

@Processor("gmail-sync")
export class HistorySyncProcessor extends WorkerHost {
  private readonly logger = new Logger(HistorySyncProcessor.name);

  constructor(
    private gmailHistoryService: GmailHistoryService,
    private emailAccountService: EmailAccountService,
  ) {
    super();
  }

  async process(job: Job<HistorySyncJob>) {
    if (job.name === "sync-history") {
      return this.processHistorySync(job);
    }
  }

  async processHistorySync(job: Job<HistorySyncJob>) {
    const { accountId, startHistoryId, trigger } = job.data;

    this.logger.log(
      `Processing history sync for account ${accountId} (trigger: ${trigger})`,
    );

    try {
      const results = await this.gmailHistoryService.syncHistory(
        accountId,
        startHistoryId,
      );

      this.logger.log(
        `History sync completed for account ${accountId}: ` +
          `${results.messagesAdded} added, ${results.messagesDeleted} deleted, ` +
          `${results.labelsChanged} label changes`,
      );

      return results;
    } catch (error: any) {
      this.logger.error(`History sync failed for account ${accountId}:`, error);

      // Update account status
      await this.emailAccountService.recordSyncError(
        accountId,
        error.message || "History sync failed",
      );

      throw error;
    }
  }
}
