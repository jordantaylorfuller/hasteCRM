import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { HttpModule } from "@nestjs/axios";
import { HealthController } from "./health.controller";
import { MetricsController } from "./metrics.controller";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";
import { PrismaModule } from "../prisma/prisma.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [TerminusModule, HttpModule, PrismaModule, RedisModule],
  controllers: [HealthController, MetricsController],
  providers: [PrismaHealthIndicator, RedisHealthIndicator],
  exports: [],
})
export class HealthModule {}
