import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { JwtModule } from "@nestjs/jwt";
import { PipelinesService } from "./pipelines.service";
import { DealsService } from "./deals.service";
import { PipelineAnalyticsService } from "./pipeline-analytics.service";
import { PipelineAutomationService } from "./pipeline-automation.service";
import { PipelinesResolver, DealsResolver } from "./pipelines.resolver";
import { AutomationProcessor } from "./processors/automation.processor";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: { expiresIn: "15m" },
    }),
    BullModule.registerQueue({
      name: "automations",
    }),
  ],
  providers: [
    PipelinesService,
    DealsService,
    PipelineAnalyticsService,
    PipelineAutomationService,
    PipelinesResolver,
    DealsResolver,
    AutomationProcessor,
  ],
  exports: [
    PipelinesService,
    DealsService,
    PipelineAnalyticsService,
    PipelineAutomationService,
  ],
})
export class PipelinesModule {}
