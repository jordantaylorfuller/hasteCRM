import { Injectable } from "@nestjs/common";
import {
  HealthIndicator,
  HealthIndicatorResult,
  HealthCheckError,
} from "@nestjs/terminus";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class PrismaHealthIndicator extends HealthIndicator {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const startTime = Date.now();

      // Execute a simple query to check database connectivity
      await this.prisma.$queryRaw`SELECT 1`;

      const responseTime = Date.now() - startTime;

      // Get connection pool stats if available
      const metrics = await this.getMetrics();

      return this.getStatus(key, true, {
        responseTime: `${responseTime}ms`,
        ...metrics,
      });
    } catch (error) {
      throw new HealthCheckError(
        "Database health check failed",
        this.getStatus(key, false, {
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
  }

  async pingCheck(key: string): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus(key, true);
    } catch (error) {
      throw new HealthCheckError(
        "Database ping failed",
        this.getStatus(key, false),
      );
    }
  }

  private async getMetrics() {
    try {
      // Get database version
      const versionResult = await this.prisma.$queryRaw<[{ version: string }]>`
        SELECT version() as version
      `;
      const version = versionResult[0]?.version?.split(" ")[1] || "unknown";

      // Get connection count
      const connectionResult = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      const connections = Number(connectionResult[0]?.count || 0);

      // Get database size
      const sizeResult = await this.prisma.$queryRaw<[{ size: string }]>`
        SELECT pg_size_pretty(pg_database_size(current_database())) as size
      `;
      const size = sizeResult[0]?.size || "unknown";

      return {
        version,
        connections,
        size,
      };
    } catch (error) {
      // Return empty metrics if queries fail
      return {};
    }
  }
}
