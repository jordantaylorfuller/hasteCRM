import { Injectable, OnModuleDestroy } from "@nestjs/common";
import Redis from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private sessionClient: Redis;

  constructor() {
    const redisConfig = {
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      password: process.env.REDIS_PASSWORD,
      db: 0,
    };

    // Main Redis client for general use
    this.client = new Redis(redisConfig);

    // Separate client for sessions (using db 1)
    this.sessionClient = new Redis({
      ...redisConfig,
      db: 1,
    });

    this.client.on("error", (err) => {
      console.error("Redis Client Error:", err);
    });

    this.sessionClient.on("error", (err) => {
      console.error("Redis Session Client Error:", err);
    });

    this.client.on("connect", () => {
      console.log("Redis Client Connected");
    });

    this.sessionClient.on("connect", () => {
      console.log("Redis Session Client Connected");
    });
  }

  getClient(): Redis {
    return this.client;
  }

  getSessionClient(): Redis {
    return this.sessionClient;
  }

  async onModuleDestroy() {
    await this.client.quit();
    await this.sessionClient.quit();
  }

  // Session management methods
  async setSession(
    sessionId: string,
    data: any,
    ttlSeconds = 3600,
  ): Promise<void> {
    await this.sessionClient.setex(
      `session:${sessionId}`,
      ttlSeconds,
      JSON.stringify(data),
    );
  }

  async getSession(sessionId: string): Promise<any | null> {
    const data = await this.sessionClient.get(`session:${sessionId}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.sessionClient.del(`session:${sessionId}`);
  }

  async extendSession(sessionId: string, ttlSeconds = 3600): Promise<boolean> {
    const result = await this.sessionClient.expire(
      `session:${sessionId}`,
      ttlSeconds,
    );
    return result === 1;
  }

  // Refresh token blacklist management
  async blacklistToken(token: string, expiresInSeconds: number): Promise<void> {
    await this.client.setex(`blacklist:${token}`, expiresInSeconds, "1");
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const result = await this.client.get(`blacklist:${token}`);
    return result === "1";
  }

  // Rate limiting helpers
  async incrementRateLimit(key: string, windowSeconds = 60): Promise<number> {
    const multi = this.client.multi();
    multi.incr(key);
    multi.expire(key, windowSeconds);
    const results = await multi.exec();
    return (results?.[0]?.[1] as number) || 1;
  }

  async getRateLimitCount(key: string): Promise<number> {
    const count = await this.client.get(key);
    return parseInt(count || "0");
  }

  // User session tracking
  async getUserSessions(userId: string): Promise<string[]> {
    const keys = await this.sessionClient.keys(`session:*`);
    const sessions: string[] = [];

    for (const key of keys) {
      const data = await this.sessionClient.get(key);
      if (data) {
        try {
          const session = JSON.parse(data);
          if (session.userId === userId) {
            sessions.push(key.replace("session:", ""));
          }
        } catch (e) {
          // Skip invalid sessions
        }
      }
    }

    return sessions;
  }

  async invalidateUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    for (const sessionId of sessions) {
      await this.deleteSession(sessionId);
    }
  }

  // Cache helpers
  async setCache(key: string, value: any, ttlSeconds?: number): Promise<void> {
    const data = JSON.stringify(value);
    if (ttlSeconds) {
      await this.client.setex(`cache:${key}`, ttlSeconds, data);
    } else {
      await this.client.set(`cache:${key}`, data);
    }
  }

  async getCache<T>(key: string): Promise<T | null> {
    const data = await this.client.get(`cache:${key}`);
    return data ? JSON.parse(data) : null;
  }

  async deleteCache(key: string): Promise<void> {
    await this.client.del(`cache:${key}`);
  }

  async clearCache(pattern = "*"): Promise<void> {
    const keys = await this.client.keys(`cache:${pattern}`);
    if (keys.length > 0) {
      await this.client.del(...keys);
    }
  }
}
