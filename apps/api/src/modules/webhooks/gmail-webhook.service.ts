import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { EmailAccountService } from "../gmail/email-account.service";
import { RedisService } from "../redis/redis.service";
import { PrismaService } from "../prisma/prisma.service";

interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
  messageId: string;
  publishTime: string;
  attributes: Record<string, string>;
}

@Injectable()
export class GmailWebhookService {
  private readonly logger = new Logger(GmailWebhookService.name);

  constructor(
    @InjectQueue("gmail-sync") private gmailSyncQueue: Queue,
    private emailAccountService: EmailAccountService,
    private redisService: RedisService,
    private prisma: PrismaService,
  ) {}

  async processNotification(notification: GmailPushNotification) {
    const startTime = Date.now();

    try {
      // Deduplication check
      const isDuplicate = await this.checkDuplicate(notification.messageId);
      if (isDuplicate) {
        this.logger.warn(`Duplicate notification: ${notification.messageId}`);
        return;
      }

      // Find email account
      const account = await this.emailAccountService.findByEmail(
        notification.emailAddress,
      );
      if (!account) {
        this.logger.error(
          `No account found for email: ${notification.emailAddress}`,
        );
        return;
      }

      // Check if historyId is newer
      const currentHistoryId = BigInt(account.historyId || "0");
      const notificationHistoryId = BigInt(notification.historyId);

      if (notificationHistoryId <= currentHistoryId) {
        this.logger.log(
          `Skipping old history: ${notification.historyId} <= ${account.historyId}`,
        );
        return;
      }

      // Record webhook event
      await this.prisma.gmailWebhookEvent.create({
        data: {
          accountId: account.id,
          messageId: notification.messageId,
          historyId: notification.historyId,
          publishTime: new Date(notification.publishTime),
          status: "PENDING",
        },
      });

      // Queue sync job
      const job = await this.gmailSyncQueue.add(
        "sync-history",
        {
          accountId: account.id,
          startHistoryId: account.historyId,
          endHistoryId: notification.historyId,
          trigger: "webhook",
        },
        {
          priority: 1,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      );

      this.logger.log(`Queued sync job ${job.id} for ${account.email}`);

      // Update metrics
      await this.updateMetrics(account.id, Date.now() - startTime);

      // Update webhook event status
      await this.prisma.gmailWebhookEvent.updateMany({
        where: {
          messageId: notification.messageId,
          status: "PENDING",
        },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
          processingTime: Date.now() - startTime,
        },
      });
    } catch (error: any) {
      this.logger.error("Failed to process Gmail notification:", error);

      // Record failure
      await this.prisma.gmailWebhookEvent.updateMany({
        where: {
          messageId: notification.messageId,
          status: "PENDING",
        },
        data: {
          status: "FAILED",
          error: error.message || "Unknown error",
          processedAt: new Date(),
        },
      });

      throw error;
    }
  }

  private async checkDuplicate(messageId: string): Promise<boolean> {
    const key = `gmail:notification:${messageId}`;
    const exists = await this.redisService.get(key);

    if (!exists) {
      // Set with 1 hour expiration
      await this.redisService.set(key, "1", "EX", 3600);
    }

    return !!exists;
  }

  private async updateMetrics(accountId: string, processingTime: number) {
    const date = new Date().toISOString().split("T")[0];
    const key = `metrics:gmail:webhooks:${date}`;

    // Increment counters
    await this.redisService.hincrby(key, "total", 1);
    await this.redisService.hincrby(key, `account:${accountId}`, 1);
    await this.redisService.hincrby(key, "processing_time", processingTime);

    // Set expiration to 30 days
    await this.redisService.expire(key, 30 * 24 * 60 * 60);
  }

  async getWebhookStats(accountId: string) {
    const key = `webhook:stats:${accountId}`;
    const count = await this.redisService.hget(key, "count");
    const totalTime = await this.redisService.hget(key, "totalTime");

    return {
      totalReceived: parseInt(count || "0"),
      averageProcessingTime: count && totalTime 
        ? parseInt(totalTime) / parseInt(count)
        : 0,
    };
  }

  async getWebhookMetrics(date?: string) {
    const targetDate = date || new Date().toISOString().split("T")[0];
    const key = `metrics:gmail:webhooks:${targetDate}`;

    const metrics = await this.redisService.hgetall(key);

    return {
      date: targetDate,
      total: parseInt(metrics.total || "0"),
      averageProcessingTime: metrics.processing_time
        ? parseInt(metrics.processing_time) / parseInt(metrics.total || "1")
        : 0,
      accounts: Object.entries(metrics)
        .filter(([k]) => k.startsWith("account:"))
        .map(([k, v]) => ({
          accountId: k.replace("account:", ""),
          count: parseInt(v),
        })),
    };
  }
}
