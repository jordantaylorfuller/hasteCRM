import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BullModule } from "@nestjs/bullmq";
import { ConfigModule } from "@nestjs/config";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { AuthModule } from "../auth/auth.module";
import { GmailService } from "./gmail.service";
import { GmailSyncService } from "./gmail-sync.service";
import { EmailAccountService } from "./email-account.service";
import { EmailService } from "./email.service";
import { EmailParserService } from "./email-parser.service";
import { GmailHistoryService } from "./gmail-history.service";
import { EmailAccountResolver } from "./resolvers/email-account.resolver";
import { EmailResolver } from "./resolvers/email.resolver";
import { HistorySyncProcessor } from "./processors/history-sync.processor";
import { MessageFetchProcessor } from "./processors/message-fetch.processor";

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: { expiresIn: "15m" },
    }),
    BullModule.registerQueue({
      name: "gmail-sync",
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: {
          count: 100,
          age: 24 * 3600, // 24 hours
        },
        removeOnFail: {
          count: 500,
          age: 7 * 24 * 3600, // 7 days
        },
      },
    }),
  ],
  providers: [
    GmailService,
    GmailSyncService,
    EmailAccountService,
    EmailService,
    EmailParserService,
    GmailHistoryService,
    EmailAccountResolver,
    EmailResolver,
    HistorySyncProcessor,
    MessageFetchProcessor,
  ],
  exports: [GmailService, GmailSyncService, EmailAccountService, EmailService],
})
export class GmailModule {}
