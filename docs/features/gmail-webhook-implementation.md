# Gmail Webhook Implementation Guide

## Overview

This document provides complete implementation details for Gmail push notifications (webhooks) in hasteCRM, including setup, handling, security, and error recovery.

## Table of Contents

1. [Gmail Push Notification Setup](#gmail-push-notification-setup)
2. [Webhook Endpoint Implementation](#webhook-endpoint-implementation)
3. [Security and Verification](#security-and-verification)
4. [Message Processing](#message-processing)
5. [Error Handling and Recovery](#error-handling-and-recovery)
6. [Monitoring and Debugging](#monitoring-and-debugging)

## Gmail Push Notification Setup

### Google Cloud Pub/Sub Configuration

```typescript
// packages/api/src/gmail/pubsub/pubsub-setup.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { PubSub } from "@google-cloud/pubsub";
import { google } from "googleapis";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PubSubSetupService {
  private readonly logger = new Logger(PubSubSetupService.name);
  private pubsub: PubSub;
  private gmail: any;

  constructor(private configService: ConfigService) {
    this.pubsub = new PubSub({
      projectId: this.configService.get("GOOGLE_CLOUD_PROJECT_ID"),
      keyFilename: this.configService.get("GOOGLE_CLOUD_KEYFILE"),
    });
  }

  async setupPushNotifications(userEmail: string, accessToken: string) {
    try {
      // 1. Create or verify Pub/Sub topic
      const topicName = `projects/${this.configService.get("GOOGLE_CLOUD_PROJECT_ID")}/topics/gmail-push`;
      const topic = await this.ensureTopic(topicName);

      // 2. Create or verify subscription
      const subscriptionName = `gmail-push-${userEmail.replace("@", "-at-").replace(".", "-")}`;
      const subscription = await this.ensureSubscription(
        topicName,
        subscriptionName,
      );

      // 3. Grant Gmail publish rights
      await this.grantGmailPublishRights(topicName);

      // 4. Set up Gmail watch
      const auth = new google.auth.OAuth2();
      auth.setCredentials({ access_token: accessToken });

      this.gmail = google.gmail({ version: "v1", auth });

      const watchResponse = await this.gmail.users.watch({
        userId: "me",
        requestBody: {
          topicName,
          labelIds: ["INBOX", "SENT"],
          labelFilterAction: "include",
        },
      });

      this.logger.log(
        `Gmail watch setup for ${userEmail}, expires: ${new Date(watchResponse.data.expiration)}`,
      );

      return {
        historyId: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
        topicName,
        subscriptionName,
      };
    } catch (error) {
      this.logger.error("Failed to setup push notifications", error);
      throw error;
    }
  }

  private async ensureTopic(topicName: string) {
    try {
      const [topic] = await this.pubsub.topic(topicName).get();
      return topic;
    } catch (error) {
      if (error.code === 5) {
        // NOT_FOUND
        const [topic] = await this.pubsub.createTopic(topicName);
        this.logger.log(`Created topic: ${topicName}`);
        return topic;
      }
      throw error;
    }
  }

  private async ensureSubscription(
    topicName: string,
    subscriptionName: string,
  ) {
    const pushEndpoint = `${this.configService.get("API_BASE_URL")}/webhooks/gmail`;

    try {
      const [subscription] = await this.pubsub
        .subscription(subscriptionName)
        .get();
      return subscription;
    } catch (error) {
      if (error.code === 5) {
        // NOT_FOUND
        const [subscription] = await this.pubsub
          .topic(topicName)
          .createSubscription(subscriptionName, {
            pushConfig: {
              pushEndpoint,
              attributes: {
                "x-goog-version": "v1",
              },
            },
            ackDeadlineSeconds: 600, // 10 minutes
            messageRetentionDuration: {
              seconds: 604800, // 7 days
            },
            retryPolicy: {
              minimumBackoff: {
                seconds: 10,
              },
              maximumBackoff: {
                seconds: 600,
              },
            },
          });
        this.logger.log(`Created subscription: ${subscriptionName}`);
        return subscription;
      }
      throw error;
    }
  }

  private async grantGmailPublishRights(topicName: string) {
    const topic = this.pubsub.topic(topicName);
    const [policy] = await topic.iam.getPolicy();

    const gmailPublisher =
      "serviceAccount:gmail-api-push@system.gserviceaccount.com";
    const role = "roles/pubsub.publisher";

    const binding = policy.bindings.find((b) => b.role === role);
    if (binding && !binding.members.includes(gmailPublisher)) {
      binding.members.push(gmailPublisher);
    } else if (!binding) {
      policy.bindings.push({
        role,
        members: [gmailPublisher],
      });
    }

    await topic.iam.setPolicy(policy);
    this.logger.log("Granted Gmail publish rights to topic");
  }

  async renewWatch(emailAccountId: string) {
    const account = await this.emailAccountService.findOne(emailAccountId);
    if (!account) {
      throw new Error("Email account not found");
    }

    // Refresh token if needed
    const accessToken = await this.authService.refreshGoogleToken(
      account.refreshToken,
    );

    // Set up new watch
    const watchData = await this.setupPushNotifications(
      account.email,
      accessToken,
    );

    // Update account with new watch data
    await this.emailAccountService.update(emailAccountId, {
      watchExpiration: new Date(parseInt(watchData.expiration)),
      historyId: watchData.historyId,
    });

    return watchData;
  }
}
```

### Watch Renewal Scheduler

```typescript
// packages/api/src/gmail/schedulers/watch-renewal.scheduler.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { EmailAccountService } from "../email-account.service";
import { PubSubSetupService } from "../pubsub/pubsub-setup.service";

@Injectable()
export class WatchRenewalScheduler {
  private readonly logger = new Logger(WatchRenewalScheduler.name);

  constructor(
    private emailAccountService: EmailAccountService,
    private pubSubSetupService: PubSubSetupService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async renewExpiringWatches() {
    this.logger.log("Checking for expiring Gmail watches...");

    // Find watches expiring in the next 24 hours
    const expiringAccounts =
      await this.emailAccountService.findExpiringWatches(24);

    for (const account of expiringAccounts) {
      try {
        await this.pubSubSetupService.renewWatch(account.id);
        this.logger.log(`Renewed watch for account: ${account.email}`);
      } catch (error) {
        this.logger.error(`Failed to renew watch for ${account.email}:`, error);

        // Mark account as needing attention
        await this.emailAccountService.update(account.id, {
          syncStatus: "ERROR",
          lastError: `Watch renewal failed: ${error.message}`,
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupExpiredWatches() {
    // Remove old watch data
    const expiredAccounts = await this.emailAccountService.findExpiredWatches();

    for (const account of expiredAccounts) {
      try {
        // Try to set up a new watch
        const accessToken = await this.authService.refreshGoogleToken(
          account.refreshToken,
        );
        await this.pubSubSetupService.setupPushNotifications(
          account.email,
          accessToken,
        );
      } catch (error) {
        this.logger.error(
          `Failed to re-establish watch for ${account.email}:`,
          error,
        );

        // Fall back to polling mode
        await this.emailAccountService.update(account.id, {
          syncMode: "POLLING",
          syncStatus: "ERROR",
          lastError: "Watch expired, falling back to polling mode",
        });
      }
    }
  }
}
```

## Webhook Endpoint Implementation

### Webhook Controller

```typescript
// packages/api/src/webhooks/gmail-webhook.controller.ts
import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiExcludeEndpoint } from "@nestjs/swagger";
import { GmailWebhookService } from "./gmail-webhook.service";
import { PubSubAuthGuard } from "./guards/pubsub-auth.guard";
import { GmailPushNotification } from "./dto/gmail-push-notification.dto";

@ApiTags("webhooks")
@Controller("webhooks")
export class GmailWebhookController {
  constructor(private gmailWebhookService: GmailWebhookService) {}

  @Post("gmail")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PubSubAuthGuard)
  @ApiExcludeEndpoint() // Hide from public API docs
  async handleGmailWebhook(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    // Parse Pub/Sub message
    const message = this.parsePubSubMessage(body);
    if (!message) {
      throw new BadRequestException("Invalid Pub/Sub message");
    }

    // Process asynchronously
    setImmediate(() => {
      this.gmailWebhookService.processNotification(message).catch((error) => {
        console.error("Failed to process Gmail notification:", error);
      });
    });

    // Acknowledge immediately
    return { status: "ok" };
  }

  private parsePubSubMessage(body: any): GmailPushNotification | null {
    try {
      const { message } = body;
      if (!message || !message.data) {
        return null;
      }

      // Decode base64 data
      const decodedData = Buffer.from(message.data, "base64").toString("utf-8");
      const data = JSON.parse(decodedData);

      return {
        emailAddress: data.emailAddress,
        historyId: data.historyId,
        messageId: message.message_id || message.messageId,
        publishTime: message.publish_time || message.publishTime,
        attributes: message.attributes || {},
      };
    } catch (error) {
      console.error("Failed to parse Pub/Sub message:", error);
      return null;
    }
  }
}
```

### Webhook Service

```typescript
// packages/api/src/webhooks/gmail-webhook.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { Queue } from "bullmq";
import { InjectQueue } from "@nestjs/bullmq";
import { EmailAccountService } from "../email-accounts/email-account.service";
import { GmailSyncService } from "../gmail/gmail-sync.service";
import { GmailPushNotification } from "./dto/gmail-push-notification.dto";
import { RedisService } from "../redis/redis.service";

@Injectable()
export class GmailWebhookService {
  private readonly logger = new Logger(GmailWebhookService.name);

  constructor(
    @InjectQueue("gmail-sync") private gmailSyncQueue: Queue,
    private emailAccountService: EmailAccountService,
    private gmailSyncService: GmailSyncService,
    private redisService: RedisService,
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
    } catch (error) {
      this.logger.error("Failed to process Gmail notification:", error);
      throw error;
    }
  }

  private async checkDuplicate(messageId: string): Promise<boolean> {
    const key = `gmail:notification:${messageId}`;
    const exists = await this.redisService.exists(key);

    if (!exists) {
      // Set with 1 hour expiration
      await this.redisService.setex(key, 3600, "1");
    }

    return exists;
  }

  private async updateMetrics(accountId: string, processingTime: number) {
    const date = new Date().toISOString().split("T")[0];
    const key = `metrics:gmail:webhooks:${date}`;

    await this.redisService.hincrby(key, "total", 1);
    await this.redisService.hincrby(key, `account:${accountId}`, 1);
    await this.redisService.hincrby(key, "processing_time", processingTime);

    // Expire after 30 days
    await this.redisService.expire(key, 30 * 24 * 60 * 60);
  }
}
```

## Security and Verification

### Pub/Sub Authentication Guard

```typescript
// packages/api/src/webhooks/guards/pubsub-auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Request } from "express";
import { OAuth2Client } from "google-auth-library";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class PubSubAuthGuard implements CanActivate {
  private readonly logger = new Logger(PubSubAuthGuard.name);
  private oauthClient: OAuth2Client;

  constructor(private configService: ConfigService) {
    this.oauthClient = new OAuth2Client();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // 1. Verify Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      this.logger.warn("Missing or invalid Authorization header");
      throw new UnauthorizedException("Invalid authorization");
    }

    const token = authHeader.substring(7);

    try {
      // 2. Verify token with Google
      const ticket = await this.oauthClient.verifyIdToken({
        idToken: token,
        audience: this.configService.get("GOOGLE_CLOUD_PROJECT_ID"),
      });

      const payload = ticket.getPayload();
      if (!payload) {
        throw new UnauthorizedException("Invalid token payload");
      }

      // 3. Verify email and issuer
      const validIssuers = [
        "https://accounts.google.com",
        "accounts.google.com",
      ];

      if (!validIssuers.includes(payload.iss)) {
        this.logger.warn(`Invalid token issuer: ${payload.iss}`);
        throw new UnauthorizedException("Invalid token issuer");
      }

      // 4. Verify service account
      const expectedEmail = "gmail-api-push@system.gserviceaccount.com";
      if (payload.email !== expectedEmail) {
        this.logger.warn(`Invalid service account: ${payload.email}`);
        throw new UnauthorizedException("Invalid service account");
      }

      // Add verified claims to request
      (request as any).pubsubClaims = payload;

      return true;
    } catch (error) {
      this.logger.error("Token verification failed:", error);
      throw new UnauthorizedException("Token verification failed");
    }
  }
}
```

### Request Validation

```typescript
// packages/api/src/webhooks/dto/gmail-push-notification.dto.ts
import { IsString, IsNumber, IsObject, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class PubSubMessage {
  @IsString()
  data: string;

  @IsString()
  messageId: string;

  @IsString()
  message_id?: string;

  @IsString()
  publishTime: string;

  @IsString()
  publish_time?: string;

  @IsObject()
  attributes?: Record<string, string>;
}

export class PubSubEnvelope {
  @ValidateNested()
  @Type(() => PubSubMessage)
  message: PubSubMessage;

  @IsString()
  subscription: string;
}

export class GmailPushNotification {
  @IsString()
  emailAddress: string;

  @IsString()
  historyId: string;

  @IsString()
  messageId: string;

  @IsString()
  publishTime: string;

  @IsObject()
  attributes: Record<string, string>;
}
```

## Message Processing

### History Sync Processor

```typescript
// packages/api/src/gmail/processors/history-sync.processor.ts
import { Processor, Process } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";
import { GmailHistoryService } from "../gmail-history.service";
import { EmailAccountService } from "../../email-accounts/email-account.service";

interface HistorySyncJob {
  accountId: string;
  startHistoryId: string;
  endHistoryId: string;
  trigger: "webhook" | "manual" | "scheduled";
}

@Processor("gmail-sync")
@Injectable()
export class HistorySyncProcessor {
  private readonly logger = new Logger(HistorySyncProcessor.name);

  constructor(
    private gmailHistoryService: GmailHistoryService,
    private emailAccountService: EmailAccountService,
  ) {}

  @Process("sync-history")
  async processHistorySync(job: Job<HistorySyncJob>) {
    const { accountId, startHistoryId, endHistoryId, trigger } = job.data;

    this.logger.log(
      `Processing history sync for account ${accountId}: ${startHistoryId} -> ${endHistoryId}`,
    );

    try {
      // Get account and auth
      const account = await this.emailAccountService.findOne(accountId);
      if (!account) {
        throw new Error("Account not found");
      }

      const auth = await this.getAuth(account);
      const gmail = google.gmail({ version: "v1", auth });

      // Fetch history
      const history = await this.fetchHistory(
        gmail,
        startHistoryId,
        endHistoryId,
      );

      // Process changes
      const results = await this.processHistory(account, history);

      // Update account
      await this.emailAccountService.update(accountId, {
        historyId: endHistoryId,
        lastSyncAt: new Date(),
        syncStatus: "ACTIVE",
      });

      this.logger.log(
        `Completed history sync for ${account.email}: ` +
          `${results.messagesAdded} added, ${results.messagesDeleted} deleted, ` +
          `${results.labelsChanged} label changes`,
      );

      return results;
    } catch (error) {
      this.logger.error(`History sync failed for account ${accountId}:`, error);

      // Update account status
      await this.emailAccountService.update(accountId, {
        syncStatus: "ERROR",
        lastError: error.message,
      });

      throw error;
    }
  }

  private async fetchHistory(
    gmail: any,
    startHistoryId: string,
    endHistoryId?: string,
  ) {
    const history = [];
    let pageToken: string | undefined;

    do {
      const response = await gmail.users.history.list({
        userId: "me",
        startHistoryId,
        historyTypes: [
          "messageAdded",
          "messageDeleted",
          "labelAdded",
          "labelRemoved",
        ],
        pageToken,
      });

      if (response.data.history) {
        history.push(...response.data.history);
      }

      pageToken = response.data.nextPageToken;

      // Check if we've reached the end history ID
      if (endHistoryId && response.data.historyId >= endHistoryId) {
        break;
      }
    } while (pageToken);

    return history;
  }

  private async processHistory(account: any, history: any[]) {
    const results = {
      messagesAdded: 0,
      messagesDeleted: 0,
      labelsChanged: 0,
    };

    for (const record of history) {
      // Process added messages
      if (record.messagesAdded) {
        for (const item of record.messagesAdded) {
          await this.processAddedMessage(account, item.message);
          results.messagesAdded++;
        }
      }

      // Process deleted messages
      if (record.messagesDeleted) {
        for (const item of record.messagesDeleted) {
          await this.processDeletedMessage(account, item.message);
          results.messagesDeleted++;
        }
      }

      // Process label changes
      if (record.labelsAdded || record.labelsRemoved) {
        const labelChanges = [
          ...(record.labelsAdded || []),
          ...(record.labelsRemoved || []),
        ];

        for (const item of labelChanges) {
          await this.processLabelChange(
            account,
            item.message,
            item.labelIds,
            record.labelsAdded ? "added" : "removed",
          );
          results.labelsChanged++;
        }
      }
    }

    return results;
  }

  private async processAddedMessage(account: any, message: any) {
    // Queue job to fetch and store full message
    await this.emailSyncQueue.add("fetch-message", {
      accountId: account.id,
      messageId: message.id,
      threadId: message.threadId,
    });
  }

  private async processDeletedMessage(account: any, message: any) {
    // Mark message as deleted in database
    await this.emailService.markAsDeleted(account.workspaceId, message.id);
  }

  private async processLabelChange(
    account: any,
    message: any,
    labelIds: string[],
    action: "added" | "removed",
  ) {
    // Update message labels in database
    if (action === "added") {
      await this.emailService.addLabels(
        account.workspaceId,
        message.id,
        labelIds,
      );
    } else {
      await this.emailService.removeLabels(
        account.workspaceId,
        message.id,
        labelIds,
      );
    }
  }

  private async getAuth(account: any) {
    const oauth2Client = new google.auth.OAuth2(
      this.configService.get("GOOGLE_CLIENT_ID"),
      this.configService.get("GOOGLE_CLIENT_SECRET"),
      this.configService.get("GOOGLE_REDIRECT_URI"),
    );

    // Refresh token if needed
    const tokens = await this.authService.refreshGoogleToken(
      account.refreshToken,
    );
    oauth2Client.setCredentials(tokens);

    return oauth2Client;
  }
}
```

### Message Fetch Processor

```typescript
// packages/api/src/gmail/processors/message-fetch.processor.ts
import { Processor, Process } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { google } from "googleapis";
import { EmailService } from "../../emails/email.service";
import { EmailParserService } from "../email-parser.service";

interface MessageFetchJob {
  accountId: string;
  messageId: string;
  threadId: string;
}

@Processor("gmail-sync")
@Injectable()
export class MessageFetchProcessor {
  private readonly logger = new Logger(MessageFetchProcessor.name);

  constructor(
    private emailService: EmailService,
    private emailParserService: EmailParserService,
  ) {}

  @Process("fetch-message")
  async processFetchMessage(job: Job<MessageFetchJob>) {
    const { accountId, messageId, threadId } = job.data;

    try {
      // Get auth and Gmail client
      const auth = await this.getAuth(accountId);
      const gmail = google.gmail({ version: "v1", auth });

      // Fetch full message
      const response = await gmail.users.messages.get({
        userId: "me",
        id: messageId,
        format: "full",
      });

      const message = response.data;

      // Parse message
      const parsedEmail = this.emailParserService.parseGmailMessage(message);

      // Store in database
      await this.emailService.upsert({
        ...parsedEmail,
        accountId,
        messageId,
        threadId,
        workspaceId: await this.getWorkspaceId(accountId),
      });

      // Process attachments if any
      if (parsedEmail.attachments?.length > 0) {
        await this.processAttachments(
          accountId,
          messageId,
          parsedEmail.attachments,
        );
      }

      // Extract and link contacts
      await this.extractContacts(parsedEmail);

      this.logger.log(`Fetched and stored message ${messageId}`);
    } catch (error) {
      this.logger.error(`Failed to fetch message ${messageId}:`, error);
      throw error;
    }
  }

  private async processAttachments(
    accountId: string,
    messageId: string,
    attachments: any[],
  ) {
    for (const attachment of attachments) {
      if (attachment.size > 25 * 1024 * 1024) {
        // 25MB limit
        this.logger.warn(
          `Skipping large attachment: ${attachment.filename} (${attachment.size} bytes)`,
        );
        continue;
      }

      await this.attachmentQueue.add("download-attachment", {
        accountId,
        messageId,
        attachmentId: attachment.id,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        size: attachment.size,
      });
    }
  }

  private async extractContacts(email: any) {
    const contacts = [];

    // Extract from sender
    if (email.from) {
      contacts.push(email.from);
    }

    // Extract from recipients
    if (email.to) {
      contacts.push(...email.to);
    }
    if (email.cc) {
      contacts.push(...email.cc);
    }

    // Queue contact enrichment
    for (const contact of contacts) {
      await this.contactQueue.add("enrich-contact", {
        email: contact.email,
        name: contact.name,
        source: "GMAIL",
        workspaceId: email.workspaceId,
      });
    }
  }
}
```

## Error Handling and Recovery

### Webhook Error Recovery

```typescript
// packages/api/src/gmail/services/webhook-recovery.service.ts
import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { EmailAccountService } from "../../email-accounts/email-account.service";
import { GmailSyncService } from "../gmail-sync.service";

@Injectable()
export class WebhookRecoveryService {
  private readonly logger = new Logger(WebhookRecoveryService.name);

  constructor(
    private emailAccountService: EmailAccountService,
    private gmailSyncService: GmailSyncService,
  ) {}

  @Cron("*/30 * * * *") // Every 30 minutes
  async checkMissedUpdates() {
    const accounts = await this.emailAccountService.findActive();

    for (const account of accounts) {
      try {
        await this.checkAccountForMissedUpdates(account);
      } catch (error) {
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
        `Account ${account.email} hasn't synced in ${Math.round(timeSinceSync / 60000)} minutes`,
      );

      // Perform manual sync
      await this.gmailSyncService.syncAccount(account.id, {
        fullSync: false,
        source: "recovery",
      });
    }
  }

  async handleWebhookFailure(accountId: string, error: Error) {
    this.logger.error(
      `Webhook processing failed for account ${accountId}:`,
      error,
    );

    // Increment failure count
    const account = await this.emailAccountService.findOne(accountId);
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
      await this.pollingQueue.add("poll-account", {
        accountId,
        interval: "5m",
      });
    }
  }
}
```

### Resilient Sync Queue

```typescript
// packages/api/src/gmail/queues/sync-queue.config.ts
import { Queue, QueueOptions } from "bullmq";
import { Injectable } from "@nestjs/common";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class SyncQueueConfig {
  constructor(private redisService: RedisService) {}

  createSyncQueue(): Queue {
    const queueOptions: QueueOptions = {
      connection: this.redisService.getConnection(),
      defaultJobOptions: {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
          maxDelay: 60000,
        },
        removeOnComplete: {
          count: 100, // Keep last 100 completed jobs
          age: 24 * 3600, // Keep for 24 hours
        },
        removeOnFail: {
          count: 500, // Keep last 500 failed jobs
          age: 7 * 24 * 3600, // Keep for 7 days
        },
      },
    };

    const queue = new Queue("gmail-sync", queueOptions);

    // Add event listeners
    queue.on("failed", (job, error) => {
      console.error(`Job ${job.id} failed:`, error);
      this.handleJobFailure(job, error);
    });

    queue.on("stalled", (jobId) => {
      console.warn(`Job ${jobId} stalled`);
    });

    return queue;
  }

  private async handleJobFailure(job: any, error: Error) {
    // Log to monitoring service
    await this.monitoringService.logJobFailure({
      jobId: job.id,
      jobName: job.name,
      accountId: job.data.accountId,
      error: error.message,
      attemptsMade: job.attemptsMade,
      timestamp: new Date(),
    });

    // If final attempt, trigger recovery
    if (job.attemptsMade >= job.opts.attempts) {
      await this.webhookRecoveryService.handleWebhookFailure(
        job.data.accountId,
        error,
      );
    }
  }
}
```

## Monitoring and Debugging

### Webhook Metrics Service

```typescript
// packages/api/src/gmail/services/webhook-metrics.service.ts
import { Injectable } from "@nestjs/common";
import { InjectMetric } from "@willsoto/nestjs-prometheus";
import { Counter, Histogram, Gauge } from "prom-client";

@Injectable()
export class WebhookMetricsService {
  constructor(
    @InjectMetric("gmail_webhook_received_total")
    private webhookReceivedCounter: Counter<string>,

    @InjectMetric("gmail_webhook_processing_duration_seconds")
    private processingDurationHistogram: Histogram<string>,

    @InjectMetric("gmail_webhook_queue_size")
    private queueSizeGauge: Gauge<string>,

    @InjectMetric("gmail_webhook_errors_total")
    private errorCounter: Counter<string>,
  ) {}

  recordWebhookReceived(emailAddress: string) {
    this.webhookReceivedCounter.labels(emailAddress).inc();
  }

  recordProcessingDuration(emailAddress: string, duration: number) {
    this.processingDurationHistogram
      .labels(emailAddress)
      .observe(duration / 1000);
  }

  updateQueueSize(size: number) {
    this.queueSizeGauge.set(size);
  }

  recordError(emailAddress: string, errorType: string) {
    this.errorCounter.labels(emailAddress, errorType).inc();
  }

  async getMetrics() {
    return {
      totalReceived: await this.webhookReceivedCounter.get(),
      averageProcessingTime: await this.processingDurationHistogram.get(),
      currentQueueSize: await this.queueSizeGauge.get(),
      errorRate: await this.errorCounter.get(),
    };
  }
}
```

### Webhook Debug Endpoint

```typescript
// packages/api/src/gmail/controllers/webhook-debug.controller.ts
import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation } from "@nestjs/swagger";
import { AdminGuard } from "../../auth/guards/admin.guard";
import { WebhookDebugService } from "../services/webhook-debug.service";

@ApiTags("admin")
@Controller("admin/webhooks/gmail")
@UseGuards(AdminGuard)
export class WebhookDebugController {
  constructor(private webhookDebugService: WebhookDebugService) {}

  @Get("status")
  @ApiOperation({ summary: "Get webhook system status" })
  async getStatus() {
    return this.webhookDebugService.getSystemStatus();
  }

  @Get("accounts/:accountId/history")
  @ApiOperation({ summary: "Get webhook history for account" })
  async getAccountHistory(@Param("accountId") accountId: string) {
    return this.webhookDebugService.getAccountWebhookHistory(accountId);
  }

  @Get("accounts/:accountId/test")
  @ApiOperation({ summary: "Send test webhook for account" })
  async sendTestWebhook(@Param("accountId") accountId: string) {
    return this.webhookDebugService.sendTestWebhook(accountId);
  }

  @Get("metrics")
  @ApiOperation({ summary: "Get webhook metrics" })
  async getMetrics() {
    return this.webhookDebugService.getMetrics();
  }
}
```

### Webhook Logging

```typescript
// packages/api/src/gmail/interceptors/webhook-logging.interceptor.ts
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap, catchError } from "rxjs/operators";
import { Request } from "express";

@Injectable()
export class WebhookLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("WebhookLogger");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();

    // Log incoming webhook
    this.logger.log({
      message: "Incoming Gmail webhook",
      headers: this.sanitizeHeaders(request.headers),
      body: this.sanitizeBody(request.body),
      timestamp: new Date().toISOString(),
    });

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.log({
          message: "Webhook processed successfully",
          duration,
          timestamp: new Date().toISOString(),
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        this.logger.error({
          message: "Webhook processing failed",
          error: error.message,
          stack: error.stack,
          duration,
          timestamp: new Date().toISOString(),
        });
        throw error;
      }),
    );
  }

  private sanitizeHeaders(headers: any) {
    const sanitized = { ...headers };
    // Remove sensitive headers
    delete sanitized.authorization;
    delete sanitized.cookie;
    return sanitized;
  }

  private sanitizeBody(body: any) {
    // Truncate large payloads
    const bodyStr = JSON.stringify(body);
    if (bodyStr.length > 1000) {
      return {
        truncated: true,
        preview: bodyStr.substring(0, 1000) + "...",
      };
    }
    return body;
  }
}
```

This completes the comprehensive Gmail webhook handling implementation guide for hasteCRM.
