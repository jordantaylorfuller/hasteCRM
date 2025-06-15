import { Test, TestingModule } from "@nestjs/testing";
import { GmailSyncService } from "./gmail-sync.service";
import { GmailService } from "./gmail.service";
import { EmailService } from "./email.service";
import { EmailAccountService } from "./email-account.service";
import { EmailParserService } from "./email-parser.service";
import { GmailHistoryService } from "./gmail-history.service";
import { PrismaService } from "../prisma/prisma.service";
import { BullModule, getQueueToken } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";

describe("GmailSyncService - 100% Coverage", () => {
  let service: GmailSyncService;
  let _gmailService: GmailService;
  let _emailService: EmailService;
  let _emailAccountService: EmailAccountService;
  let _emailParserService: EmailParserService;
  let _gmailHistoryService: GmailHistoryService;
  let _prismaService: PrismaService;

  const mockQueue = {
    add: jest.fn(),
    on: jest.fn(),
    close: jest.fn(),
  };

  const mockGmailService = {
    listMessages: jest.fn(),
    getMessage: jest.fn(),
    getAttachment: jest.fn(),
    getHistory: jest.fn(),
    getProfile: jest.fn(),
  };

  const mockEmailService = {
    createFromGmail: jest.fn(),
    updateFromGmail: jest.fn(),
    findByMessageId: jest.fn(),
    upsert: jest.fn(),
  };

  const mockEmailAccountService = {
    findOne: jest.fn(),
    findByWorkspace: jest.fn(),
    getFreshAccessToken: jest.fn(),
    updateSyncState: jest.fn(),
    updateLastHistoryId: jest.fn(),
    recordSyncError: jest.fn(),
    recordSuccessfulSync: jest.fn(),
  };

  const mockEmailParserService = {
    parseGmailMessage: jest.fn(),
    extractDirection: jest.fn(),
  };

  const mockGmailHistoryService = {
    processHistory: jest.fn(),
  };

  const mockPrismaService = {
    email: {
      count: jest.fn(),
      findFirst: jest.fn(),
    },
    emailAttachment: {
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        BullModule.registerQueue({
          name: "gmail-sync",
        }),
      ],
      providers: [
        GmailSyncService,
        {
          provide: GmailService,
          useValue: mockGmailService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: EmailParserService,
          useValue: mockEmailParserService,
        },
        {
          provide: GmailHistoryService,
          useValue: mockGmailHistoryService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    })
      .overrideProvider(getQueueToken("gmail-sync"))
      .useValue(mockQueue)
      .compile();

    service = module.get<GmailSyncService>(GmailSyncService);
    _gmailService = module.get<GmailService>(GmailService);
    _emailService = module.get<EmailService>(EmailService);
    _emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    _emailParserService = module.get<EmailParserService>(EmailParserService);
    _gmailHistoryService = module.get<GmailHistoryService>(GmailHistoryService);
    _prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("syncAccount - lines 26-56", () => {
    it("should perform incremental sync by default", async () => {
      const accountId = "account-123";
      const account = {
        id: accountId,
        email: "test@example.com",
        workspaceId: "workspace-123",
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);

      await service.syncAccount(accountId);

      expect(mockEmailAccountService.findOne).toHaveBeenCalledWith(accountId);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "sync-history",
        {
          accountId: accountId,
          trigger: "manual",
        },
        {
          priority: 1,
        },
      );
    });

    it("should handle account not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      await expect(service.syncAccount("non-existent")).rejects.toThrow(
        "Account not found",
      );
    });

    it("should perform full sync when requested", async () => {
      const accountId = "account-456";
      const account = {
        id: accountId,
        email: "test@example.com",
        workspaceId: "workspace-123",
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockGmailService.listMessages.mockResolvedValue({
        messages: [
          { id: "msg-1", threadId: "thread-1" },
          { id: "msg-2", threadId: "thread-2" },
        ],
      });
      mockGmailService.getProfile.mockResolvedValue({
        historyId: "12345",
      });
      mockEmailAccountService.recordSuccessfulSync.mockResolvedValue(account);

      await service.syncAccount(accountId, { fullSync: true });

      expect(mockEmailAccountService.getFreshAccessToken).toHaveBeenCalledWith(
        accountId,
      );
      expect(mockGmailService.listMessages).toHaveBeenCalledWith(
        "access-token",
        undefined,
        undefined,
        50,
      );
      expect(mockQueue.add).toHaveBeenCalledTimes(2);
      expect(mockQueue.add).toHaveBeenCalledWith(
        "fetch-message",
        {
          accountId: accountId,
          messageId: "msg-1",
          threadId: "thread-1",
        },
        { priority: 2 },
      );
      expect(mockEmailAccountService.recordSuccessfulSync).toHaveBeenCalledWith(
        accountId,
        "12345",
      );
    });

    it("should handle sync errors and record them", async () => {
      const accountId = "account-error";
      const account = {
        id: accountId,
        email: "error@example.com",
        workspaceId: "workspace-123",
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);

      // Mock the queue to throw an error
      mockQueue.add.mockRejectedValue(new Error("Queue error"));
      mockEmailAccountService.recordSyncError.mockResolvedValue(account);

      await expect(service.syncAccount(accountId)).rejects.toThrow(
        "Queue error",
      );

      expect(mockEmailAccountService.recordSyncError).toHaveBeenCalledWith(
        accountId,
        "Queue error",
      );
    });

    it("should handle empty message list in full sync", async () => {
      const accountId = "account-empty";
      const account = {
        id: accountId,
        email: "test@example.com",
        workspaceId: "workspace-123",
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockGmailService.listMessages.mockResolvedValue({
        messages: undefined,
      });

      const loggerSpy = jest.spyOn(Logger.prototype, "log");

      await service.syncAccount(accountId, { fullSync: true });

      expect(mockQueue.add).not.toHaveBeenCalled();
      expect(loggerSpy).toHaveBeenCalledWith(
        "No messages found for test@example.com",
      );
      // recordSuccessfulSync is NOT called when no messages found due to early return
      expect(
        mockEmailAccountService.recordSuccessfulSync,
      ).not.toHaveBeenCalled();
      expect(mockGmailService.getProfile).not.toHaveBeenCalled();
    });

    it("should log sync completion for full sync", async () => {
      const accountId = "account-log";
      const account = {
        id: accountId,
        email: "log@example.com",
        workspaceId: "workspace-123",
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockGmailService.listMessages.mockResolvedValue({
        messages: [
          { id: "msg-1", threadId: "thread-1" },
          { id: "msg-2", threadId: "thread-2" },
          { id: "msg-3", threadId: "thread-3" },
        ],
      });
      mockGmailService.getProfile.mockResolvedValue({ historyId: "12345" });
      mockEmailAccountService.recordSuccessfulSync.mockResolvedValue(account);

      // Reset the mock to avoid conflicts with previous tests
      mockQueue.add.mockResolvedValue({});

      const loggerSpy = jest.spyOn(Logger.prototype, "log");

      await service.syncAccount(accountId, { fullSync: true });

      expect(loggerSpy).toHaveBeenCalledWith(
        "Queued 3 messages for log@example.com",
      );
    });
  });

  describe("downloadAttachment - lines 211-278", () => {
    it("should successfully download attachment", async () => {
      const accountId = "account-123";
      const messageId = "msg-123";
      const attachmentId = "attach-123";
      const filename = "document.pdf";

      const account = {
        id: accountId,
        email: "test@example.com",
        workspaceId: "workspace-123",
      };

      const email = {
        id: "email-123",
        messageId: messageId,
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockEmailService.findByMessageId.mockResolvedValue(email);
      mockGmailService.getAttachment.mockResolvedValue({
        data: "base64AttachmentData",
      });

      const loggerSpy = jest.spyOn(Logger.prototype, "debug");

      await service.downloadAttachment(
        accountId,
        messageId,
        attachmentId,
        filename,
      );

      expect(mockEmailAccountService.findOne).toHaveBeenCalledWith(accountId);
      expect(mockEmailAccountService.getFreshAccessToken).toHaveBeenCalledWith(
        accountId,
      );
      expect(mockEmailService.findByMessageId).toHaveBeenCalledWith(messageId);
      expect(mockGmailService.getAttachment).toHaveBeenCalledWith(
        "access-token",
        messageId,
        attachmentId,
      );
      expect(mockPrismaService.emailAttachment.updateMany).toHaveBeenCalledWith(
        {
          where: {
            emailId: "email-123",
            gmailId: attachmentId,
          },
          data: {
            url: `attachment://${messageId}/${attachmentId}/${filename}`,
          },
        },
      );
      expect(loggerSpy).toHaveBeenCalledWith(
        `Downloaded attachment ${filename} for message ${messageId}`,
      );
    });

    it("should throw error when account not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      await expect(
        service.downloadAttachment(
          "non-existent",
          "msg-1",
          "attach-1",
          "file.pdf",
        ),
      ).rejects.toThrow("Account not found");
    });

    it("should handle email not found", async () => {
      const accountId = "account-123";
      const messageId = "msg-not-found";

      mockEmailAccountService.findOne.mockResolvedValue({ id: accountId });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockEmailService.findByMessageId.mockResolvedValue(null);

      const loggerSpy = jest.spyOn(Logger.prototype, "warn");

      await service.downloadAttachment(
        accountId,
        messageId,
        "attach-1",
        "file.pdf",
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `Email ${messageId} not found for attachment`,
      );
      expect(mockGmailService.getAttachment).not.toHaveBeenCalled();
    });

    it("should handle attachment with no data", async () => {
      const accountId = "account-123";
      const messageId = "msg-123";
      const attachmentId = "attach-no-data";

      mockEmailAccountService.findOne.mockResolvedValue({ id: accountId });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockEmailService.findByMessageId.mockResolvedValue({ id: "email-123" });
      mockGmailService.getAttachment.mockResolvedValue({
        data: null,
      });

      const loggerSpy = jest.spyOn(Logger.prototype, "warn");

      await service.downloadAttachment(
        accountId,
        messageId,
        attachmentId,
        "file.pdf",
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `No data for attachment ${attachmentId}`,
      );
      expect(
        mockPrismaService.emailAttachment.updateMany,
      ).not.toHaveBeenCalled();
    });

    it("should handle attachment download error", async () => {
      const accountId = "account-123";
      const messageId = "msg-123";
      const attachmentId = "attach-error";

      mockEmailAccountService.findOne.mockResolvedValue({ id: accountId });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockEmailService.findByMessageId.mockResolvedValue({ id: "email-123" });
      mockGmailService.getAttachment.mockRejectedValue(
        new Error("Download failed"),
      );

      const loggerSpy = jest.spyOn(Logger.prototype, "error");

      await service.downloadAttachment(
        accountId,
        messageId,
        attachmentId,
        "file.pdf",
      );

      expect(loggerSpy).toHaveBeenCalledWith(
        `Failed to download attachment ${attachmentId}:`,
        expect.any(Error),
      );
      expect(
        mockPrismaService.emailAttachment.updateMany,
      ).not.toHaveBeenCalled();
    });
  });

  describe("getSyncStatus - lines 268-279", () => {
    it("should get sync status for multiple accounts", async () => {
      const workspaceId = "workspace-123";
      const accounts = [
        {
          id: "acc-1",
          email: "user1@example.com",
          lastHistoryId: "123",
          syncCursor: "cursor-1",
        },
        {
          id: "acc-2",
          email: "user2@example.com",
          lastHistoryId: "456",
          syncCursor: null,
        },
        {
          id: "acc-3",
          email: "user3@example.com",
          lastHistoryId: null,
          syncCursor: "cursor-3",
        },
      ];

      mockEmailAccountService.findByWorkspace.mockResolvedValue(accounts);
      mockPrismaService.email.count
        .mockResolvedValueOnce(100)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(75);

      const result = await service.getSyncStatus(workspaceId);

      expect(mockEmailAccountService.findByWorkspace).toHaveBeenCalledWith(
        workspaceId,
      );
      expect(mockPrismaService.email.count).toHaveBeenCalledTimes(3);
      expect(result).toEqual([
        {
          id: "acc-1",
          email: "user1@example.com",
          emailCount: 100,
          syncEnabled: undefined,
          syncMode: undefined,
          syncStatus: undefined,
          lastSyncAt: undefined,
          lastError: undefined,
          watchExpiration: undefined,
        },
        {
          id: "acc-2",
          email: "user2@example.com",
          emailCount: 50,
          syncEnabled: undefined,
          syncMode: undefined,
          syncStatus: undefined,
          lastSyncAt: undefined,
          lastError: undefined,
          watchExpiration: undefined,
        },
        {
          id: "acc-3",
          email: "user3@example.com",
          emailCount: 75,
          syncEnabled: undefined,
          syncMode: undefined,
          syncStatus: undefined,
          lastSyncAt: undefined,
          lastError: undefined,
          watchExpiration: undefined,
        },
      ]);
    });

    it("should handle empty accounts list", async () => {
      const workspaceId = "workspace-empty";

      mockEmailAccountService.findByWorkspace.mockResolvedValue([]);

      const result = await service.getSyncStatus(workspaceId);

      expect(result).toEqual([]);
      expect(mockPrismaService.email.count).not.toHaveBeenCalled();
    });
  });

  describe("fetchAndStoreMessage - lines 131-160", () => {
    it("should throw error when account not found", async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      await expect(
        service.fetchAndStoreMessage("non-existent", "msg-1", "thread-1"),
      ).rejects.toThrow("Account not found");
    });

    it("should fetch and store a message successfully", async () => {
      const accountId = "account-123";
      const messageId = "msg-123";
      const threadId = "thread-123";
      const account = {
        id: accountId,
        email: "test@example.com",
        workspaceId: "workspace-123",
      };

      const gmailMessage = {
        id: messageId,
        threadId: threadId,
        labelIds: ["INBOX"],
        internalDate: "1234567890000",
        payload: {
          headers: [
            { name: "From", value: "sender@example.com" },
            { name: "To", value: "test@example.com" },
            { name: "Subject", value: "Test Email" },
          ],
        },
      };

      const parsedEmail = {
        from: "sender@example.com",
        fromEmail: "sender@example.com",
        to: ["test@example.com"],
        subject: "Test Email",
        body: "Test body",
        attachments: [],
      };

      mockEmailAccountService.findOne.mockResolvedValue(account);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue(
        "access-token",
      );
      mockGmailService.getMessage.mockResolvedValue(gmailMessage);
      mockEmailParserService.parseGmailMessage.mockReturnValue(parsedEmail);
      mockEmailParserService.extractDirection.mockReturnValue("INBOUND");
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: "user-123",
        email: "sender@example.com",
      });
      mockEmailService.upsert.mockResolvedValue({ id: "email-123" });
      mockEmailService.createFromGmail.mockResolvedValue({ id: "email-123" });

      await service.fetchAndStoreMessage(accountId, messageId, threadId);

      expect(mockEmailAccountService.findOne).toHaveBeenCalledWith(accountId);
      expect(mockEmailAccountService.getFreshAccessToken).toHaveBeenCalledWith(
        accountId,
      );
      expect(mockGmailService.getMessage).toHaveBeenCalledWith(
        "access-token",
        messageId,
      );
      expect(mockEmailParserService.parseGmailMessage).toHaveBeenCalledWith(
        gmailMessage,
      );
      expect(mockEmailService.upsert).toHaveBeenCalled();
    });
  });

  describe("performFullSync - private method coverage", () => {
    it("should throw error when account not found during full sync", async () => {
      const accountId = "non-existent";

      // First call returns account for syncAccount
      // Second call returns null for performFullSync
      mockEmailAccountService.findOne
        .mockResolvedValueOnce({ id: accountId, email: "test@example.com" })
        .mockResolvedValueOnce(null);

      await expect(
        service.syncAccount(accountId, { fullSync: true }),
      ).rejects.toThrow("Account not found");
    });
  });
});
