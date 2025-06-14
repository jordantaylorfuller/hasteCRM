import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EmailAccountService } from "../gmail/email-account.service";
import { GmailSyncService } from "../gmail/gmail-sync.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class WebhookRecoveryService {
  private readonly logger = new Logger(WebhookRecoveryService.name);

  constructor(
    private emailAccountService: EmailAccountService,
    private gmailSyncService: GmailSyncService,
    private prisma: PrismaService,
    @InjectQueue("gmail-sync") private gmailSyncQueue: Queue,
  ) {}

  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkMissedUpdates() {
    this.logger.log("Checking for missed email updates...");

    const accounts = await this.emailAccountService.findActive();

    for (const account of accounts) {
      try {
        await this.checkAccountForMissedUpdates(account);
      } catch (error: any) {
        this.logger.error(
          `Failed to check missed updates for ${account.email}:`,
          error,
        );
      }
    }
  }

  private async checkAccountForMissedUpdates(account: any) {
    const lastSync = account.lastSyncAt || account.createdAt;
    const timeSinceSync = Date.now() - lastSync.getTime();

    // If no sync in 2 hours, check for updates
    if (timeSinceSync > 2 * 60 * 60 * 1000) {
      this.logger.warn(
        `Account ${account.email} hasn't synced in ${Math.round(
          timeSinceSync / 60000,
        )} minutes`,
      );

      // Perform manual sync
      await this.gmailSyncService.syncAccount(account.id, {
        fullSync: false,
        source: "recovery",
      });
    }
  }

  @Cron(CronExpression.EVERY_HOUR)
  async cleanupFailedWebhooks() {
    this.logger.log("Cleaning up failed webhook events...");

    // Find failed webhook events older than 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const failedEvents = await this.prisma.gmailWebhookEvent.findMany({
      where: {
        status: "FAILED",
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: {
        account: true,
      },
    });

    for (const event of failedEvents) {
      try {
        // Retry the sync for this history ID
        await this.gmailSyncQueue.add(
          "sync-history",
          {
            accountId: event.accountId,
            startHistoryId: event.historyId,
            trigger: "recovery",
          },
          {
            priority: 3,
            attempts: 1,
          },
        );

        // Update the event status
        await this.prisma.gmailWebhookEvent.update({
          where: { id: event.id },
          data: {
            status: "RETRIED",
          },
        });
      } catch (error: any) {
        this.logger.error(`Failed to retry webhook event ${event.id}:`, error);
      }
    }

    this.logger.log(`Retried ${failedEvents.length} failed webhook events`);
  }

  async handleWebhookFailure(accountId: string, error: Error) {
    this.logger.error(
      `Webhook processing failed for account ${accountId}:`,
      error,
    );

    // Get account
    const account = await this.emailAccountService.findOne(accountId);
    if (!account) {
      return;
    }

    // Increment failure count
    const failureCount = (account.webhookFailureCount || 0) + 1;

    await this.emailAccountService.update(accountId, {
      webhookFailureCount: failureCount,
      lastWebhookError: error.message,
      lastWebhookErrorAt: new Date(),
    });

    // Switch to polling if too many failures
    if (failureCount >= 5) {
      this.logger.warn(
        `Switching account ${account.email} to polling mode due to webhook failures`,
      );

      await this.emailAccountService.update(accountId, {
        syncMode: "POLLING",
        webhookFailureCount: 0,
      });

      // Schedule polling job
      await this.gmailSyncQueue.add(
        "poll-account",
        {
          accountId,
          interval: "5m",
        },
        {
          repeat: {
            every: 5 * 60 * 1000, // 5 minutes
          },
        },
      );
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async generateDailyReport() {
    this.logger.log("Generating daily webhook report...");

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split("T")[0];

    // Get webhook events for yesterday
    const events = await this.prisma.gmailWebhookEvent.findMany({
      where: {
        createdAt: {
          gte: new Date(dateStr + "T00:00:00.000Z"),
          lt: new Date(dateStr + "T23:59:59.999Z"),
        },
      },
      select: {
        status: true,
        processingTime: true,
      },
    });

    const report = {
      date: dateStr,
      total: events.length,
      processed: events.filter((e) => e.status === "PROCESSED").length,
      failed: events.filter((e) => e.status === "FAILED").length,
      pending: events.filter((e) => e.status === "PENDING").length,
      averageProcessingTime:
        events
          .filter((e) => e.processingTime)
          .reduce((sum, e) => sum + (e.processingTime || 0), 0) /
          events.filter((e) => e.processingTime).length || 0,
    };

    this.logger.log("Daily webhook report:", report);

    // You could store this report or send it via email
  }
}
