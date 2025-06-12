import { Injectable } from "@nestjs/common";
import { RedisService } from "../redis/redis.service";
import { randomBytes } from "crypto";
import { User } from "@hasteCRM/database";

export interface SessionData {
  sessionId: string;
  userId: string;
  email: string;
  workspaceId: string;
  role: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  lastActivity: Date;
}

@Injectable()
export class SessionService {
  private readonly SESSION_TTL = 60 * 60 * 24; // 24 hours in seconds
  private readonly SESSION_REFRESH_THRESHOLD = 60 * 60; // 1 hour in seconds

  constructor(private redisService: RedisService) {}

  async createSession(
    user: User,
    workspaceId: string,
    role: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionData> {
    const sessionId = this.generateSessionId();
    const sessionData: SessionData = {
      sessionId,
      userId: user.id,
      email: user.email,
      workspaceId,
      role,
      ipAddress,
      userAgent,
      createdAt: new Date(),
      lastActivity: new Date(),
    };

    await this.redisService.setSession(
      sessionId,
      sessionData,
      this.SESSION_TTL,
    );

    // Track user session for multi-device management
    await this.addUserSession(user.id, sessionId);

    return sessionData;
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    const session = await this.redisService.getSession(sessionId);
    if (!session) return null;

    // Update last activity if session is still valid
    const ttl = await this.redisService.getClient().ttl(`session:${sessionId}`);
    if (ttl > 0 && ttl < this.SESSION_TTL - this.SESSION_REFRESH_THRESHOLD) {
      session.lastActivity = new Date();
      await this.redisService.setSession(sessionId, session, this.SESSION_TTL);
    }

    return session;
  }

  async validateSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    return session !== null;
  }

  async refreshSession(sessionId: string): Promise<boolean> {
    const session = await this.getSession(sessionId);
    if (!session) return false;

    session.lastActivity = new Date();
    await this.redisService.setSession(sessionId, session, this.SESSION_TTL);
    return true;
  }

  async invalidateSession(sessionId: string): Promise<void> {
    const session = await this.getSession(sessionId);
    if (session) {
      await this.removeUserSession(session.userId, sessionId);
      await this.redisService.deleteSession(sessionId);
    }
  }

  async invalidateAllUserSessions(userId: string): Promise<void> {
    const sessions = await this.getUserSessions(userId);
    for (const sessionId of sessions) {
      await this.redisService.deleteSession(sessionId);
    }
    await this.clearUserSessions(userId);
  }

  async getUserActiveSessions(userId: string): Promise<SessionData[]> {
    const sessionIds = await this.getUserSessions(userId);
    const activeSessions: SessionData[] = [];

    for (const sessionId of sessionIds) {
      const session = await this.getSession(sessionId);
      if (session) {
        activeSessions.push(session);
      }
    }

    return activeSessions;
  }

  async getActiveSessionCount(userId: string): Promise<number> {
    const sessions = await this.getUserActiveSessions(userId);
    return sessions.length;
  }

  // Session limits
  async enforceSessionLimit(userId: string, maxSessions = 5): Promise<void> {
    const sessions = await this.getUserActiveSessions(userId);

    if (sessions.length > maxSessions) {
      // Sort by last activity and remove oldest sessions
      sessions.sort(
        (a, b) =>
          new Date(a.lastActivity).getTime() -
          new Date(b.lastActivity).getTime(),
      );

      const sessionsToRemove = sessions.slice(0, sessions.length - maxSessions);
      for (const session of sessionsToRemove) {
        await this.invalidateSession(session.sessionId);
      }
    }
  }

  // Token management with Redis
  async blacklistToken(token: string, expiresInSeconds = 86400): Promise<void> {
    await this.redisService.blacklistToken(token, expiresInSeconds);
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    return await this.redisService.isTokenBlacklisted(token);
  }

  // Private helper methods
  private generateSessionId(): string {
    return randomBytes(32).toString("hex");
  }

  private async addUserSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const key = `user:sessions:${userId}`;
    await this.redisService.getClient().sadd(key, sessionId);
    await this.redisService.getClient().expire(key, this.SESSION_TTL);
  }

  private async removeUserSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const key = `user:sessions:${userId}`;
    await this.redisService.getClient().srem(key, sessionId);
  }

  private async getUserSessions(userId: string): Promise<string[]> {
    const key = `user:sessions:${userId}`;
    return await this.redisService.getClient().smembers(key);
  }

  private async clearUserSessions(userId: string): Promise<void> {
    const key = `user:sessions:${userId}`;
    await this.redisService.getClient().del(key);
  }
}
