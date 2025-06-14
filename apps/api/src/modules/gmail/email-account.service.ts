import { Injectable, Logger, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { GmailService } from "./gmail.service";
import { EmailAccount } from "../prisma/prisma-client";

@Injectable()
export class EmailAccountService {
  private readonly logger = new Logger(EmailAccountService.name);

  constructor(
    private prisma: PrismaService,
    private gmailService: GmailService,
  ) {}

  /**
   * Create email account
   */
  async create(data: {
    workspaceId: string;
    userId: string;
    email: string;
    accessToken: string;
    refreshToken: string;
    tokenExpiresAt: Date;
  }): Promise<EmailAccount> {
    // Get Gmail profile to verify the email
    const profile = await this.gmailService.getProfile(data.accessToken);

    if (profile.emailAddress !== data.email) {
      throw new Error("Email address mismatch");
    }

    return this.prisma.emailAccount.create({
      data: {
        workspaceId: data.workspaceId,
        userId: data.userId,
        email: data.email,
        provider: "gmail",
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        tokenExpiresAt: data.tokenExpiresAt,
        historyId: profile.historyId,
      },
    });
  }

  /**
   * Find one email account
   */
  async findOne(id: string): Promise<EmailAccount | null> {
    return this.prisma.emailAccount.findUnique({
      where: { id },
    });
  }

  /**
   * Find by email
   */
  async findByEmail(email: string): Promise<EmailAccount | null> {
    return this.prisma.emailAccount.findFirst({
      where: { email },
    });
  }

  /**
   * Find all accounts for a workspace
   */
  async findByWorkspace(workspaceId: string): Promise<EmailAccount[]> {
    return this.prisma.emailAccount.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find all accounts for a user
   */
  async findByUser(userId: string): Promise<EmailAccount[]> {
    return this.prisma.emailAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Find active accounts
   */
  async findActive(): Promise<EmailAccount[]> {
    return this.prisma.emailAccount.findMany({
      where: {
        syncEnabled: true,
        syncStatus: "ACTIVE",
      },
    });
  }

  /**
   * Find accounts with expiring watches
   */
  async findExpiringWatches(hoursAhead: number): Promise<EmailAccount[]> {
    const expiryThreshold = new Date();
    expiryThreshold.setHours(expiryThreshold.getHours() + hoursAhead);

    return this.prisma.emailAccount.findMany({
      where: {
        syncEnabled: true,
        syncMode: "PUSH",
        watchExpiration: {
          lte: expiryThreshold,
        },
      },
    });
  }

  /**
   * Find accounts with expired watches
   */
  async findExpiredWatches(): Promise<EmailAccount[]> {
    return this.prisma.emailAccount.findMany({
      where: {
        syncEnabled: true,
        syncMode: "PUSH",
        watchExpiration: {
          lt: new Date(),
        },
      },
    });
  }

  /**
   * Update email account
   */
  async update(
    id: string,
    data: Partial<{
      syncEnabled: boolean;
      syncMode: string;
      syncStatus: string;
      lastSyncAt: Date;
      syncCursor: string;
      historyId: string;
      lastError: string;
      watchExpiration: Date;
      topicName: string;
      subscriptionName: string;
      webhookFailureCount: number;
      lastWebhookError: string;
      lastWebhookErrorAt: Date;
      accessToken: string;
      refreshToken: string;
      tokenExpiresAt: Date;
    }>,
  ): Promise<EmailAccount> {
    return this.prisma.emailAccount.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete email account
   */
  async delete(id: string): Promise<void> {
    await this.prisma.emailAccount.delete({
      where: { id },
    });
  }

  /**
   * Get fresh access token
   */
  async getFreshAccessToken(accountId: string): Promise<string> {
    const account = await this.findOne(accountId);
    if (!account) {
      throw new NotFoundException("Email account not found");
    }

    // Check if token is still valid (with 5 minute buffer)
    const now = new Date();
    const expiryBuffer = new Date(account.tokenExpiresAt);
    expiryBuffer.setMinutes(expiryBuffer.getMinutes() - 5);

    if (now < expiryBuffer) {
      return account.accessToken;
    }

    // Refresh the token
    this.logger.log(`Refreshing token for account ${account.email}`);
    const newAccessToken = await this.gmailService.refreshAccessToken(
      account.refreshToken,
    );

    // Update in database
    const newExpiresAt = new Date();
    newExpiresAt.setHours(newExpiresAt.getHours() + 1); // Google tokens typically expire in 1 hour

    await this.update(accountId, {
      accessToken: newAccessToken,
      tokenExpiresAt: newExpiresAt,
    });

    return newAccessToken;
  }

  /**
   * Enable sync for account
   */
  async enableSync(id: string): Promise<EmailAccount> {
    return this.update(id, {
      syncEnabled: true,
      syncStatus: "ACTIVE",
    });
  }

  /**
   * Disable sync for account
   */
  async disableSync(id: string): Promise<EmailAccount> {
    return this.update(id, {
      syncEnabled: false,
      syncStatus: "PAUSED",
    });
  }

  /**
   * Record sync error
   */
  async recordSyncError(id: string, error: string): Promise<EmailAccount> {
    return this.update(id, {
      syncStatus: "ERROR",
      lastError: error,
    });
  }

  /**
   * Record successful sync
   */
  async recordSuccessfulSync(
    id: string,
    historyId?: string,
  ): Promise<EmailAccount> {
    const data: any = {
      lastSyncAt: new Date(),
      syncStatus: "ACTIVE",
      lastError: null,
    };

    if (historyId) {
      data.historyId = historyId;
    }

    return this.update(id, data);
  }
}
