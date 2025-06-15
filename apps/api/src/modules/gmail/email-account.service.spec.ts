import { Test, TestingModule } from "@nestjs/testing";
import { NotFoundException } from "@nestjs/common";
import { EmailAccountService } from "./email-account.service";
import { PrismaService } from "../prisma/prisma.service";
import { GmailService } from "./gmail.service";

describe("EmailAccountService", () => {
  let service: EmailAccountService;
  let prismaService: PrismaService;
  let gmailService: GmailService;

  const mockEmailAccount = {
    id: "account-123",
    workspaceId: "workspace-123",
    userId: "user-123",
    email: "test@example.com",
    provider: "gmail",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    tokenExpiresAt: new Date("2024-12-31"),
    syncEnabled: true,
    syncMode: "PUSH",
    syncStatus: "ACTIVE",
    lastSyncAt: new Date(),
    syncCursor: null,
    historyId: "12345",
    lastError: null,
    watchExpiration: new Date("2024-12-31"),
    topicName: null,
    subscriptionName: null,
    webhookFailureCount: 0,
    lastWebhookError: null,
    lastWebhookErrorAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockGmailProfile = {
    emailAddress: "test@example.com",
    messagesTotal: 1000,
    threadsTotal: 500,
    historyId: "12345",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAccountService,
        {
          provide: PrismaService,
          useValue: {
            emailAccount: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
            },
          },
        },
        {
          provide: GmailService,
          useValue: {
            getProfile: jest.fn(),
            refreshAccessToken: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmailAccountService>(EmailAccountService);
    prismaService = module.get<PrismaService>(PrismaService);
    gmailService = module.get<GmailService>(GmailService);
  });

  describe("create", () => {
    const createData = {
      workspaceId: "workspace-123",
      userId: "user-123",
      email: "test@example.com",
      accessToken: "access-token",
      refreshToken: "refresh-token",
      tokenExpiresAt: new Date("2024-12-31"),
    };

    it("should create email account when email matches", async () => {
      (gmailService.getProfile as jest.Mock).mockResolvedValue(mockGmailProfile);
      (prismaService.emailAccount.create as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );

      const result = await service.create(createData);

      expect(gmailService.getProfile).toHaveBeenCalledWith(createData.accessToken);
      expect(prismaService.emailAccount.create).toHaveBeenCalledWith({
        data: {
          ...createData,
          provider: "gmail",
          historyId: mockGmailProfile.historyId,
        },
      });
      expect(result).toEqual(mockEmailAccount);
    });

    it("should throw error when email address mismatches", async () => {
      (gmailService.getProfile as jest.Mock).mockResolvedValue({
        ...mockGmailProfile,
        emailAddress: "different@example.com",
      });

      await expect(service.create(createData)).rejects.toThrow(
        "Email address mismatch",
      );
    });
  });

  describe("findOne", () => {
    it("should find email account by id", async () => {
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );

      const result = await service.findOne("account-123");

      expect(prismaService.emailAccount.findUnique).toHaveBeenCalledWith({
        where: { id: "account-123" },
      });
      expect(result).toEqual(mockEmailAccount);
    });

    it("should return null when account not found", async () => {
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findOne("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByEmail", () => {
    it("should find email account by email", async () => {
      (prismaService.emailAccount.findFirst as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );

      const result = await service.findByEmail("test@example.com");

      expect(prismaService.emailAccount.findFirst).toHaveBeenCalledWith({
        where: { email: "test@example.com" },
      });
      expect(result).toEqual(mockEmailAccount);
    });
  });

  describe("findByWorkspace", () => {
    it("should find all accounts for a workspace", async () => {
      const accounts = [mockEmailAccount, { ...mockEmailAccount, id: "account-456" }];
      (prismaService.emailAccount.findMany as jest.Mock).mockResolvedValue(accounts);

      const result = await service.findByWorkspace("workspace-123");

      expect(prismaService.emailAccount.findMany).toHaveBeenCalledWith({
        where: { workspaceId: "workspace-123" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(accounts);
    });
  });

  describe("findByUser", () => {
    it("should find all accounts for a user", async () => {
      const accounts = [mockEmailAccount];
      (prismaService.emailAccount.findMany as jest.Mock).mockResolvedValue(accounts);

      const result = await service.findByUser("user-123");

      expect(prismaService.emailAccount.findMany).toHaveBeenCalledWith({
        where: { userId: "user-123" },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(accounts);
    });
  });

  describe("findActive", () => {
    it("should find all active accounts", async () => {
      const accounts = [mockEmailAccount];
      (prismaService.emailAccount.findMany as jest.Mock).mockResolvedValue(accounts);

      const result = await service.findActive();

      expect(prismaService.emailAccount.findMany).toHaveBeenCalledWith({
        where: {
          syncEnabled: true,
          syncStatus: "ACTIVE",
        },
      });
      expect(result).toEqual(accounts);
    });
  });

  describe("findExpiringWatches", () => {
    it("should find accounts with expiring watches", async () => {
      const accounts = [mockEmailAccount];
      (prismaService.emailAccount.findMany as jest.Mock).mockResolvedValue(accounts);

      const result = await service.findExpiringWatches(24);

      expect(prismaService.emailAccount.findMany).toHaveBeenCalledWith({
        where: {
          syncEnabled: true,
          syncMode: "PUSH",
          watchExpiration: {
            lte: expect.any(Date),
          },
        },
      });

      // Verify the date is approximately 24 hours ahead
      const callArgs = (prismaService.emailAccount.findMany as jest.Mock).mock
        .calls[0][0];
      const expiryDate = callArgs.where.watchExpiration.lte;
      const now = new Date();
      const hoursDiff = (expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeCloseTo(24, 0);

      expect(result).toEqual(accounts);
    });
  });

  describe("findExpiredWatches", () => {
    it("should find accounts with expired watches", async () => {
      const accounts = [mockEmailAccount];
      (prismaService.emailAccount.findMany as jest.Mock).mockResolvedValue(accounts);

      const result = await service.findExpiredWatches();

      expect(prismaService.emailAccount.findMany).toHaveBeenCalledWith({
        where: {
          syncEnabled: true,
          syncMode: "PUSH",
          watchExpiration: {
            lt: expect.any(Date),
          },
        },
      });
      expect(result).toEqual(accounts);
    });
  });

  describe("update", () => {
    it("should update email account", async () => {
      const updateData = {
        syncEnabled: false,
        syncStatus: "PAUSED",
      };
      const updatedAccount = { ...mockEmailAccount, ...updateData };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.update("account-123", updateData);

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: updateData,
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe("delete", () => {
    it("should delete email account", async () => {
      (prismaService.emailAccount.delete as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );

      await service.delete("account-123");

      expect(prismaService.emailAccount.delete).toHaveBeenCalledWith({
        where: { id: "account-123" },
      });
    });
  });

  describe("getFreshAccessToken", () => {
    it("should return existing token if still valid", async () => {
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      const account = { ...mockEmailAccount, tokenExpiresAt: futureDate };
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(
        account,
      );

      const result = await service.getFreshAccessToken("account-123");

      expect(result).toBe(account.accessToken);
      expect(gmailService.refreshAccessToken).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);
      const account = { ...mockEmailAccount, tokenExpiresAt: pastDate };
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(
        account,
      );
      (gmailService.refreshAccessToken as jest.Mock).mockResolvedValue(
        "new-access-token",
      );
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue({
        ...account,
        accessToken: "new-access-token",
      });

      const result = await service.getFreshAccessToken("account-123");

      expect(gmailService.refreshAccessToken).toHaveBeenCalledWith(
        account.refreshToken,
      );
      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          accessToken: "new-access-token",
          tokenExpiresAt: expect.any(Date),
        },
      });
      expect(result).toBe("new-access-token");
    });

    it("should refresh token if expiring within 5 minutes", async () => {
      const soonDate = new Date();
      soonDate.setMinutes(soonDate.getMinutes() + 3); // 3 minutes from now
      const account = { ...mockEmailAccount, tokenExpiresAt: soonDate };
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(
        account,
      );
      (gmailService.refreshAccessToken as jest.Mock).mockResolvedValue(
        "new-access-token",
      );
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue({
        ...account,
        accessToken: "new-access-token",
      });

      const result = await service.getFreshAccessToken("account-123");

      expect(gmailService.refreshAccessToken).toHaveBeenCalled();
      expect(result).toBe("new-access-token");
    });

    it("should throw NotFoundException if account not found", async () => {
      (prismaService.emailAccount.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getFreshAccessToken("non-existent")).rejects.toThrow(
        new NotFoundException("Email account not found"),
      );
    });
  });

  describe("enableSync", () => {
    it("should enable sync for account", async () => {
      const updatedAccount = {
        ...mockEmailAccount,
        syncEnabled: true,
        syncStatus: "ACTIVE",
      };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.enableSync("account-123");

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          syncEnabled: true,
          syncStatus: "ACTIVE",
        },
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe("disableSync", () => {
    it("should disable sync for account", async () => {
      const updatedAccount = {
        ...mockEmailAccount,
        syncEnabled: false,
        syncStatus: "PAUSED",
      };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.disableSync("account-123");

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          syncEnabled: false,
          syncStatus: "PAUSED",
        },
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe("recordSyncError", () => {
    it("should record sync error", async () => {
      const error = "Sync failed: API rate limit";
      const updatedAccount = {
        ...mockEmailAccount,
        syncStatus: "ERROR",
        lastError: error,
      };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.recordSyncError("account-123", error);

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          syncStatus: "ERROR",
          lastError: error,
        },
      });
      expect(result).toEqual(updatedAccount);
    });
  });

  describe("recordSuccessfulSync", () => {
    it("should record successful sync without historyId", async () => {
      const updatedAccount = {
        ...mockEmailAccount,
        lastSyncAt: new Date(),
        syncStatus: "ACTIVE",
        lastError: null,
      };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.recordSuccessfulSync("account-123");

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          lastSyncAt: expect.any(Date),
          syncStatus: "ACTIVE",
          lastError: null,
        },
      });
      expect(result).toEqual(updatedAccount);
    });

    it("should record successful sync with historyId", async () => {
      const newHistoryId = "67890";
      const updatedAccount = {
        ...mockEmailAccount,
        lastSyncAt: new Date(),
        syncStatus: "ACTIVE",
        lastError: null,
        historyId: newHistoryId,
      };
      (prismaService.emailAccount.update as jest.Mock).mockResolvedValue(
        updatedAccount,
      );

      const result = await service.recordSuccessfulSync("account-123", newHistoryId);

      expect(prismaService.emailAccount.update).toHaveBeenCalledWith({
        where: { id: "account-123" },
        data: {
          lastSyncAt: expect.any(Date),
          syncStatus: "ACTIVE",
          lastError: null,
          historyId: newHistoryId,
        },
      });
      expect(result).toEqual(updatedAccount);
    });
  });
});