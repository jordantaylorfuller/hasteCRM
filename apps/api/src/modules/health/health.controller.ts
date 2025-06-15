import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HealthCheck,
  MemoryHealthIndicator,
  DiskHealthIndicator,
} from "@nestjs/terminus";
import { PrismaHealthIndicator } from "./indicators/prisma.health";
import { RedisHealthIndicator } from "./indicators/redis.health";

@Controller("health")
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    private disk: DiskHealthIndicator,
    private prisma: PrismaHealthIndicator,
    private redis: RedisHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      // Database health
      () => this.prisma.isHealthy("database"),

      // Redis health
      () => this.redis.isHealthy("redis"),

      // Memory health - 150MB heap threshold
      () => this.memory.checkHeap("memory_heap", 150 * 1024 * 1024),

      // Memory RSS - 300MB threshold
      () => this.memory.checkRSS("memory_rss", 300 * 1024 * 1024),

      // Disk health - 90% threshold
      () =>
        this.disk.checkStorage("storage", {
          path: "/",
          thresholdPercent: 0.9,
        }),
    ]);
  }

  @Get("live")
  @HealthCheck()
  liveness() {
    // Simple liveness check - if the app can respond, it's alive
    return this.health.check([]);
  }

  @Get("ready")
  @HealthCheck()
  readiness() {
    // Readiness check - ensure critical services are available
    return this.health.check([
      () => this.prisma.isHealthy("database"),
      () => this.redis.isHealthy("redis"),
    ]);
  }

  @Get("startup")
  @HealthCheck()
  startup() {
    // Startup probe - lighter check during initialization
    return this.health.check([() => this.prisma.pingCheck("database")]);
  }
}
