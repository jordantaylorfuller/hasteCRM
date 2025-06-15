import { Test, TestingModule } from "@nestjs/testing";
import { WebhookRecoveryService } from "./webhook-recovery.service";
import { EmailAccountService } from "../gmail/email-account.service";
import { GmailSyncService } from "../gmail/gmail-sync.service";
import { PrismaService } from "../prisma/prisma.service";
import { Queue } from "bullmq";
import { getQueueToken } from "@nestjs/bullmq";

describe("WebhookRecoveryService", () => {
  let service: WebhookRecoveryService;
  let emailAccountService: EmailAccountService;
  let gmailSyncService: GmailSyncService;
  let prismaService: PrismaService;
  let gmailSyncQueue: Queue;

  const mockEmailAccountService = {
    findActive: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockGmailSyncService = {
    syncAccount: jest.fn(),
  };

  const mockPrismaService = {
    gmailWebhookEvent: {
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    emailAccount: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGmailSyncQueue = {
    add: jest.fn(),
  };

  const mockAccounts = [
    {
      id: "account-1",
      email: "test1@example.com",
      lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      id: "account-2",
      email: "test2@example.com",
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      id: "account-3",
      email: "test3@example.com",
      lastSyncAt: null,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago, never synced
      isActive: true,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRecoveryService,
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: GmailSyncService,
          useValue: mockGmailSyncService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken("gmail-sync"),
          useValue: mockGmailSyncQueue,
        },
      ],
    }).compile();

    service = module.get<WebhookRecoveryService>(WebhookRecoveryService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    gmailSyncService = module.get<GmailSyncService>(GmailSyncService);
    prismaService = module.get<PrismaService>(PrismaService);
    gmailSyncQueue = module.get<Queue>(getQueueToken("gmail-sync"));

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("checkMissedUpdates", () => {
    it("should log check message", async () => {
      mockEmailAccountService.findActive.mockResolvedValue([]);

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.checkMissedUpdates();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Checking for missed email updates...",
      );

      loggerLogSpy.mockRestore();
    });

    it("should sync accounts that haven't synced in over 2 hours", async () => {
      mockEmailAccountService.findActive.mockResolvedValue(mockAccounts);
      mockGmailSyncService.syncAccount.mockResolvedValue({});

      const loggerWarnSpy = jest
        .spyOn(service["logger"], "warn")
        .mockImplementation();

      await service.checkMissedUpdates();

      expect(mockEmailAccountService.findActive).toHaveBeenCalled();

      // Should sync account-1 (3 hours) and account-3 (5 hours since creation)
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledTimes(2);
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledWith(
        "account-1",
        { fullSync: false, source: "recovery" },
      );
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledWith(
        "account-3",
        { fullSync: false, source: "recovery" },
      );

      // Should not sync account-2 (only 30 minutes)
      expect(mockGmailSyncService.syncAccount).not.toHaveBeenCalledWith(
        "account-2",
        expect.any(Object),
      );

      // Should log warnings for accounts that need sync
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Account test1@example.com hasn't synced in"),
      );
      expect(loggerWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Account test3@example.com hasn't synced in"),
      );

      loggerWarnSpy.mockRestore();
    });

    it("should handle errors for individual accounts", async () => {
      mockEmailAccountService.findActive.mockResolvedValue(mockAccounts);
      mockGmailSyncService.syncAccount
        .mockResolvedValueOnce({}) // First account succeeds
        .mockRejectedValueOnce(new Error("Sync failed")); // Second account fails

      // Mock logger.error to prevent output in tests
      const loggerErrorSpy = jest
        .spyOn(service["logger"], "error")
        .mockImplementation();

      await service.checkMissedUpdates();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to check missed updates"),
        expect.any(Error),
      );

      // Should still process all accounts despite error
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledTimes(2);

      loggerErrorSpy.mockRestore();
    });

    it("should handle empty account list", async () => {
      mockEmailAccountService.findActive.mockResolvedValue([]);

      await service.checkMissedUpdates();

      expect(mockGmailSyncService.syncAccount).not.toHaveBeenCalled();
    });
  });

  describe("cleanupFailedWebhooks", () => {
    it("should log cleanup message", async () => {
      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue([]);

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.cleanupFailedWebhooks();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Cleaning up failed webhook events...",
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Retried 0 failed webhook events",
      );

      loggerLogSpy.mockRestore();
    });

    it("should retry and cleanup old failed webhooks", async () => {
      const failedEvents = [
        {
          id: "event-1",
          accountId: "account-1",
          historyId: "12345",
          status: "FAILED",
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          account: mockAccounts[0],
        },
        {
          id: "event-2",
          accountId: "account-2",
          historyId: "12346",
          status: "FAILED",
          createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
          account: mockAccounts[1],
        },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(
        failedEvents,
      );
      mockGmailSyncQueue.add.mockResolvedValue({ id: "job-123" });
      mockPrismaService.gmailWebhookEvent.update.mockResolvedValue({});

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.cleanupFailedWebhooks();

      // Should find failed events older than 24 hours
      expect(mockPrismaService.gmailWebhookEvent.findMany).toHaveBeenCalledWith(
        {
          where: {
            status: "FAILED",
            createdAt: {
              lt: expect.any(Date),
            },
          },
          include: {
            account: true,
          },
        },
      );

      // Should queue retry for each failed event
      expect(mockGmailSyncQueue.add).toHaveBeenCalledTimes(2);
      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        "sync-history",
        {
          accountId: "account-1",
          startHistoryId: "12345",
          trigger: "recovery",
        },
        {
          priority: 3,
          attempts: 1,
        },
      );
      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        "sync-history",
        {
          accountId: "account-2",
          startHistoryId: "12346",
          trigger: "recovery",
        },
        {
          priority: 3,
          attempts: 1,
        },
      );

      // Should update event status
      expect(mockPrismaService.gmailWebhookEvent.update).toHaveBeenCalledTimes(
        2,
      );
      expect(mockPrismaService.gmailWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: "event-1" },
        data: { status: "RETRIED" },
      });

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Retried 2 failed webhook events",
      );

      loggerLogSpy.mockRestore();
    });

    it("should handle retry errors gracefully", async () => {
      const failedEvents = [
        {
          id: "event-1",
          accountId: "account-1",
          historyId: "12345",
          status: "FAILED",
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          account: mockAccounts[0],
        },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(
        failedEvents,
      );
      mockGmailSyncQueue.add.mockRejectedValue(new Error("Queue error"));

      // Mock logger.error to prevent output in tests
      const loggerErrorSpy = jest
        .spyOn(service["logger"], "error")
        .mockImplementation();

      await service.cleanupFailedWebhooks();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Failed to retry webhook event"),
        expect.any(Error),
      );

      loggerErrorSpy.mockRestore();
    });

    it("should handle empty failed events list", async () => {
      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue([]);

      await service.cleanupFailedWebhooks();

      expect(mockGmailSyncQueue.add).not.toHaveBeenCalled();
      expect(mockPrismaService.gmailWebhookEvent.update).not.toHaveBeenCalled();
    });
  });

  describe("handleWebhookFailure", () => {
    it("should handle webhook failure and increment failure count", async () => {
      const account = {
        id: "account-1",
        email: "test@example.com",
        webhookFailureCount: 2,
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.update.mockResolvedValue({});

      const error = new Error("Webhook processing failed");
      await service.handleWebhookFailure("account-1", error);

      expect(mockEmailAccountService.findOne).toHaveBeenCalledWith("account-1");
      expect(mockEmailAccountService.update).toHaveBeenCalledWith("account-1", {
        webhookFailureCount: 3,
        lastWebhookError: "Webhook processing failed",
        lastWebhookErrorAt: expect.any(Date),
      });
    });

    it("should switch to polling mode after 5 failures", async () => {
      const account = {
        id: "account-1",
        email: "test@example.com",
        webhookFailureCount: 4,
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.update.mockResolvedValue({});
      mockGmailSyncQueue.add.mockResolvedValue({ id: "job-123" });

      const loggerWarnSpy = jest
        .spyOn(service["logger"], "warn")
        .mockImplementation();

      const error = new Error("Webhook processing failed");
      await service.handleWebhookFailure("account-1", error);

      expect(mockEmailAccountService.update).toHaveBeenCalledTimes(2);
      expect(mockEmailAccountService.update).toHaveBeenNthCalledWith(
        1,
        "account-1",
        {
          webhookFailureCount: 5,
          lastWebhookError: "Webhook processing failed",
          lastWebhookErrorAt: expect.any(Date),
        },
      );
      expect(mockEmailAccountService.update).toHaveBeenNthCalledWith(
        2,
        "account-1",
        {
          syncMode: "POLLING",
          webhookFailureCount: 0,
        },
      );

      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        "poll-account",
        {
          accountId: "account-1",
          interval: "5m",
        },
        {
          repeat: {
            every: 5 * 60 * 1000,
          },
        },
      );

      expect(loggerWarnSpy).toHaveBeenCalledWith(
        "Switching account test@example.com to polling mode due to webhook failures",
      );

      loggerWarnSpy.mockRestore();
    });

    it("should handle missing account gracefully", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      const error = new Error("Webhook processing failed");
      await service.handleWebhookFailure("non-existent", error);

      expect(mockEmailAccountService.findOne).toHaveBeenCalledWith(
        "non-existent",
      );
      expect(mockEmailAccountService.update).not.toHaveBeenCalled();
      expect(mockGmailSyncQueue.add).not.toHaveBeenCalled();
    });

    it("should handle webhook failure with no previous failure count", async () => {
      const account = {
        id: "account-1",
        email: "test@example.com",
        webhookFailureCount: null,
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.update.mockResolvedValue({});

      const error = new Error("First webhook failure");
      await service.handleWebhookFailure("account-1", error);

      expect(mockEmailAccountService.update).toHaveBeenCalledWith("account-1", {
        webhookFailureCount: 1,
        lastWebhookError: "First webhook failure",
        lastWebhookErrorAt: expect.any(Date),
      });
    });
  });

  describe("generateDailyReport", () => {
    it("should generate daily report with webhook statistics", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split("T")[0];

      const events = [
        { status: "PROCESSED", processingTime: 100 },
        { status: "PROCESSED", processingTime: 200 },
        { status: "FAILED", processingTime: null },
        { status: "PENDING", processingTime: null },
        { status: "PROCESSED", processingTime: 150 },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(events);

      // Mock logger.log to verify the report
      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.generateDailyReport();

      expect(mockPrismaService.gmailWebhookEvent.findMany).toHaveBeenCalledWith(
        {
          where: {
            createdAt: {
              gte: new Date(dateStr + "T00:00:00.000Z"),
              lt: new Date(dateStr + "T23:59:59.999Z"),
            },
          },
          select: {
            status: true,
            processingTime: true,
          },
        },
      );

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Daily webhook report:",
        expect.objectContaining({
          date: dateStr,
          total: 5,
          processed: 3,
          failed: 1,
          pending: 1,
          averageProcessingTime: 150,
        }),
      );

      loggerLogSpy.mockRestore();
    });

    it("should handle empty events list", async () => {
      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue([]);

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.generateDailyReport();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Daily webhook report:",
        expect.objectContaining({
          total: 0,
          processed: 0,
          failed: 0,
          pending: 0,
          averageProcessingTime: 0,
        }),
      );

      loggerLogSpy.mockRestore();
    });

    it("should handle events with no processing time", async () => {
      const events = [
        { status: "PROCESSED", processingTime: null },
        { status: "PROCESSED", processingTime: null },
        { status: "FAILED", processingTime: null },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(events);

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.generateDailyReport();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Daily webhook report:",
        expect.objectContaining({
          averageProcessingTime: 0,
        }),
      );

      loggerLogSpy.mockRestore();
    });

    it("should log message when generating report", async () => {
      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue([]);

      const loggerLogSpy = jest
        .spyOn(service["logger"], "log")
        .mockImplementation();

      await service.generateDailyReport();

      expect(loggerLogSpy).toHaveBeenCalledWith(
        "Generating daily webhook report...",
      );

      loggerLogSpy.mockRestore();
    });
  });

  describe("checkAccountForMissedUpdates", () => {
    it("should be called as part of checkMissedUpdates", async () => {
      const checkAccountSpy = jest
        .spyOn(service as any, "checkAccountForMissedUpdates")
        .mockImplementation();

      mockEmailAccountService.findActive.mockResolvedValue(mockAccounts);

      await service.checkMissedUpdates();

      expect(checkAccountSpy).toHaveBeenCalledTimes(3);
      expect(checkAccountSpy).toHaveBeenCalledWith(mockAccounts[0]);
      expect(checkAccountSpy).toHaveBeenCalledWith(mockAccounts[1]);
      expect(checkAccountSpy).toHaveBeenCalledWith(mockAccounts[2]);

      checkAccountSpy.mockRestore();
    });
  });
});
