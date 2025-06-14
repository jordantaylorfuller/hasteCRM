import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

interface AppMetrics {
  timestamp: string;
  uptime: number;
  memory: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
    external: number;
  };
  cpu: {
    user: number;
    system: number;
  };
  database: {
    activeConnections?: number;
    totalQueries?: number;
  };
  redis: {
    connectedClients?: number;
    usedMemory?: number;
  };
  requests: {
    total: number;
    errors: number;
    avgResponseTime: number;
  };
}

@Controller('metrics')
export class MetricsController {
  private requestCount = 0;
  private errorCount = 0;
  private totalResponseTime = 0;

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  @Get()
  async getMetrics(): Promise<AppMetrics> {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    const uptime = process.uptime();

    // Get database metrics
    const dbMetrics = await this.getDatabaseMetrics();
    
    // Get Redis metrics
    const redisMetrics = await this.getRedisMetrics();

    return {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime),
      memory: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024), // MB
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024), // MB
        rss: Math.round(memoryUsage.rss / 1024 / 1024), // MB
        external: Math.round(memoryUsage.external / 1024 / 1024), // MB
      },
      cpu: {
        user: Math.round(cpuUsage.user / 1000000), // seconds
        system: Math.round(cpuUsage.system / 1000000), // seconds
      },
      database: dbMetrics,
      redis: redisMetrics,
      requests: {
        total: this.requestCount,
        errors: this.errorCount,
        avgResponseTime: this.requestCount > 0 
          ? Math.round(this.totalResponseTime / this.requestCount) 
          : 0,
      },
    };
  }

  @Get('prometheus')
  async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.getMetrics();
    
    return `
# HELP app_uptime_seconds Application uptime in seconds
# TYPE app_uptime_seconds gauge
app_uptime_seconds ${metrics.uptime}

# HELP app_memory_heap_used_bytes Heap memory used in bytes
# TYPE app_memory_heap_used_bytes gauge
app_memory_heap_used_bytes ${metrics.memory.heapUsed * 1024 * 1024}

# HELP app_memory_heap_total_bytes Total heap memory in bytes
# TYPE app_memory_heap_total_bytes gauge
app_memory_heap_total_bytes ${metrics.memory.heapTotal * 1024 * 1024}

# HELP app_memory_rss_bytes RSS memory in bytes
# TYPE app_memory_rss_bytes gauge
app_memory_rss_bytes ${metrics.memory.rss * 1024 * 1024}

# HELP app_cpu_user_seconds CPU user time in seconds
# TYPE app_cpu_user_seconds counter
app_cpu_user_seconds ${metrics.cpu.user}

# HELP app_cpu_system_seconds CPU system time in seconds
# TYPE app_cpu_system_seconds counter
app_cpu_system_seconds ${metrics.cpu.system}

# HELP app_http_requests_total Total number of HTTP requests
# TYPE app_http_requests_total counter
app_http_requests_total ${metrics.requests.total}

# HELP app_http_errors_total Total number of HTTP errors
# TYPE app_http_errors_total counter
app_http_errors_total ${metrics.requests.errors}

# HELP app_http_response_time_milliseconds Average HTTP response time
# TYPE app_http_response_time_milliseconds gauge
app_http_response_time_milliseconds ${metrics.requests.avgResponseTime}

# HELP app_database_connections Active database connections
# TYPE app_database_connections gauge
app_database_connections ${metrics.database.activeConnections || 0}

# HELP app_redis_connected_clients Redis connected clients
# TYPE app_redis_connected_clients gauge
app_redis_connected_clients ${metrics.redis.connectedClients || 0}
`.trim();
  }

  private async getDatabaseMetrics() {
    try {
      const result = await this.prisma.$queryRaw<[{ count: bigint }]>`
        SELECT COUNT(*) as count 
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;
      
      return {
        activeConnections: Number(result[0]?.count || 0),
      };
    } catch (error) {
      return {};
    }
  }

  private async getRedisMetrics() {
    try {
      const client = this.redis.getClient();
      const info = await client.info('clients');
      const memInfo = await client.info('memory');
      
      const clientsMatch = info.match(/connected_clients:(\d+)/);
      const memMatch = memInfo.match(/used_memory:(\d+)/);
      
      return {
        connectedClients: clientsMatch ? parseInt(clientsMatch[1]) : undefined,
        usedMemory: memMatch ? parseInt(memMatch[1]) : undefined,
      };
    } catch (error) {
      return {};
    }
  }

  // Method to track requests (called by interceptors)
  trackRequest(responseTime: number, hasError: boolean) {
    this.requestCount++;
    this.totalResponseTime += responseTime;
    if (hasError) {
      this.errorCount++;
    }
  }
}