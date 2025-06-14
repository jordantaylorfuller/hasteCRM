import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";
import { GmailModule } from "../gmail/gmail.module";
import { GmailWebhookController } from "./gmail-webhook.controller";
import { GmailWebhookService } from "./gmail-webhook.service";
import { WebhookRecoveryService } from "./webhook-recovery.service";
import { PubSubAuthGuard } from "./guards/pubsub-auth.guard";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    GmailModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: { expiresIn: "15m" },
    }),
    BullModule.registerQueue({
      name: "gmail-sync",
    }),
  ],
  controllers: [GmailWebhookController],
  providers: [GmailWebhookService, WebhookRecoveryService, PubSubAuthGuard],
  exports: [GmailWebhookService, WebhookRecoveryService],
})
export class WebhooksModule {}
