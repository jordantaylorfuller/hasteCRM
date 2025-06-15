import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redis: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    const client = this.redis.getClient();

    try {
      const startTime = Date.now();

      // Ping Redis
      const pingResult = await client.ping();

      if (pingResult !== "PONG") {
        throw new Error("Redis ping failed");
      }

      const responseTime = Date.now() - startTime;

      // Get Redis info
      const info = await this.getRedisInfo();

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        ...info,
      });
    } catch (error) {
      throw new HealthCheckError(
        "Redis health check failed",
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  private async getRedisInfo() {
    const client = this.redis.getClient();

    try {
      const info = await client.info();
      const lines = info.split("\r\n");
      const infoObj: Record<string, string> = {};

      lines.forEach((line) => {
        if (line && !line.startsWith("#")) {
          const [key, value] = line.split(":");
          if (key && value) {
            infoObj[key] = value;
          }
        }
      });

      return {
        version: infoObj.redis_version || "unknown",
        mode: infoObj.redis_mode || "standalone",
        connected_clients: parseInt(infoObj.connected_clients || "0"),
        used_memory_human: infoObj.used_memory_human || "unknown",
        uptime_in_days: parseInt(infoObj.uptime_in_days || "0"),
      };
    } catch (error) {
      // Return default values if info fails
      return {
        version: "unknown",
        mode: "standalone",
        connected_clients: 0,
        used_memory_human: "unknown",
        uptime_in_days: 0,
      };
    }
  }
}
