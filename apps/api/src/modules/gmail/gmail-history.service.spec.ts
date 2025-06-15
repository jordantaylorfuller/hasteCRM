import { Test, TestingModule } from "@nestjs/testing";
import { GmailHistoryService } from "./gmail-history.service";
import { GmailService } from "./gmail.service";
import { EmailAccountService } from "./email-account.service";
import { EmailService } from "./email.service";
import { getQueueToken } from "@nestjs/bullmq";
import { Queue } from "bullmq";

describe("GmailHistoryService", () => {
  let service: GmailHistoryService;
  let gmailService: GmailService;
  let emailAccountService: EmailAccountService;
  let emailService: EmailService;
  let gmailSyncQueue: Queue;

  const mockGmailService = {
    getHistory: jest.fn(),
  };

  const mockEmailAccountService = {
    findOne: jest.fn(),
    getFreshAccessToken: jest.fn(),
    recordSuccessfulSync: jest.fn(),
    recordSyncError: jest.fn(),
  };

  const mockEmailService = {
    findByMessageId: jest.fn(),
    upsert: jest.fn(),
    markAsDeleted: jest.fn(),
  };

  const mockGmailSyncQueue = {
    add: jest.fn(),
  };

  const mockAccount = {
    id: "account-123",
    email: "test@example.com",
    workspaceId: "workspace-123",
    historyId: "history-123",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailHistoryService,
        {
          provide: GmailService,
          useValue: mockGmailService,
        },
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: getQueueToken("gmail-sync"),
          useValue: mockGmailSyncQueue,
        },
      ],
    }).compile();

    service = module.get<GmailHistoryService>(GmailHistoryService);
    gmailService = module.get<GmailService>(GmailService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    emailService = module.get<EmailService>(EmailService);
    gmailSyncQueue = module.get<Queue>(getQueueToken("gmail-sync"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("syncHistory", () => {
    it("should sync history successfully", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockAccount);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "fresh-token",
      );
      mockGmailService.getHistory.mockResolvedValue({
        history: [
          {
            messagesAdded: [
              {
                message: {
                  id: "msg-1",
                  threadId: "thread-1",
                },
              },
            ],
          },
        ],
        historyId: "new-history-123",
        nextPageToken: null,
      });
      mockGmailSyncQueue.add.mockResolvedValue({});
      mockEmailAccountService.recordSuccessfulSync.mockResolvedValue(undefined);

      const result = await service.syncHistory("account-123");

      expect(emailAccountService.findOne).toHaveBeenCalledWith("account-123");
      expect(emailAccountService.getFreshAccessToken).toHaveBeenCalledWith(
        "account-123",
      );
      expect(gmailService.getHistory).toHaveBeenCalledWith(
        "fresh-token",
        "history-123",
        ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"],
        undefined,
      );
      expect(result).toEqual({
        messagesAdded: 1,
        messagesDeleted: 0,
        labelsChanged: 0,
        newHistoryId: "new-history-123",
      });
    });

    it("should use provided start history ID", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockAccount);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "fresh-token",
      );
      mockGmailService.getHistory.mockResolvedValue({
        history: [],
        historyId: "newer-history-456",
        nextPageToken: null,
      });

      await service.syncHistory("account-123", "start-history-456");

      expect(gmailService.getHistory).toHaveBeenCalledWith(
        "fresh-token",
        "start-history-456",
        expect.any(Array),
        undefined,
      );
    });

    it("should handle pagination", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockAccount);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "fresh-token",
      );

      // First page
      mockGmailService.getHistory.mockResolvedValueOnce({
        history: [
          {
            messagesAdded: [{ message: { id: "msg-1", threadId: "thread-1" } }],
          },
        ],
        historyId: "mid-history",
        nextPageToken: "page-2",
      });

      // Second page
      mockGmailService.getHistory.mockResolvedValueOnce({
        history: [
          {
            messagesAdded: [{ message: { id: "msg-2", threadId: "thread-2" } }],
          },
        ],
        historyId: "final-history",
        nextPageToken: null,
      });

      const result = await service.syncHistory("account-123");

      expect(gmailService.getHistory).toHaveBeenCalledTimes(2);
      expect(gmailService.getHistory).toHaveBeenCalledWith(
        "fresh-token",
        "history-123",
        expect.any(Array),
        "page-2",
      );
      expect(result.messagesAdded).toBe(2);
      expect(result.newHistoryId).toBe("final-history");
    });

    it("should handle account not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      await expect(service.syncHistory("non-existent")).rejects.toThrow(
        "Account not found",
      );
    });

    it("should perform full sync when no history ID", async () => {
      const accountWithoutHistory = { ...mockAccount, historyId: null };
      mockEmailAccountService.findOne.mockResolvedValue(accountWithoutHistory);

      // Mock performFullSync
      const performFullSyncSpy = jest
        .spyOn(service as any, "performFullSync")
        .mockResolvedValue({
          messagesAdded: 100,
          messagesDeleted: 0,
          labelsChanged: 0,
          newHistoryId: "full-sync-history",
        });

      const result = await service.syncHistory("account-123");

      expect(performFullSyncSpy).toHaveBeenCalledWith("account-123");
      expect(result.messagesAdded).toBe(100);
    });

    it("should perform full sync on 404 error", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockAccount);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "fresh-token",
      );
      mockGmailService.getHistory.mockRejectedValue({ code: 404 });

      const performFullSyncSpy = jest
        .spyOn(service as any, "performFullSync")
        .mockResolvedValue({
          messagesAdded: 50,
          messagesDeleted: 0,
          labelsChanged: 0,
          newHistoryId: "full-sync-history",
        });

      const result = await service.syncHistory("account-123");

      expect(performFullSyncSpy).toHaveBeenCalledWith("account-123");
      expect(result.messagesAdded).toBe(50);
    });

    it("should record sync error on failure", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockAccount);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "fresh-token",
      );
      mockGmailService.getHistory.mockRejectedValue(new Error("API Error"));

      await expect(service.syncHistory("account-123")).rejects.toThrow(
        "API Error",
      );

      expect(emailAccountService.recordSyncError).toHaveBeenCalledWith(
        "account-123",
        "API Error",
      );
    });
  });

  describe("processHistory", () => {
    it("should process messages added", async () => {
      const changes = [
        {
          messagesAdded: [
            { message: { id: "msg-1", threadId: "thread-1" } },
            { message: { id: "msg-2", threadId: "thread-2" } },
          ],
        },
      ];

      const processHistorySpy = jest
        .spyOn(service as any, "processHistory")
        .mockResolvedValue({
          messagesAdded: 2,
          messagesDeleted: 0,
          labelsChanged: 0,
        });

      const result = await (service as any).processHistory(
        mockAccount,
        changes,
      );

      expect(result.messagesAdded).toBe(2);
    });
  });

  describe("queue operations", () => {
    it("should queue message fetch", async () => {
      await (service as any).queueMessageFetch(
        "account-123",
        "msg-123",
        "thread-123",
      );

      expect(gmailSyncQueue.add).toHaveBeenCalledWith(
        "fetch-message",
        {
          accountId: "account-123",
          messageId: "msg-123",
          threadId: "thread-123",
        },
        {
          priority: 2,
          attempts: 3,
        },
      );
    });
  });
});
