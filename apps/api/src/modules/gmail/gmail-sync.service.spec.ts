import { Test, TestingModule } from "@nestjs/testing";
import { GmailSyncService } from "./gmail-sync.service";
import { GmailService } from "./gmail.service";
import { EmailAccountService } from "./email-account.service";
import { EmailService } from "./email.service";
import { EmailParserService } from "./email-parser.service";
import { PrismaService } from "../prisma/prisma.service";
import { getQueueToken } from "@nestjs/bullmq";
import { EmailDirection } from "../prisma/prisma-client"; // eslint-disable-line @typescript-eslint/no-unused-vars

describe("GmailSyncService", () => {
  let service: GmailSyncService;
  let gmailService: any;
  let emailService: any;
  let emailAccountService: any;
  let emailParserService: any;
  let prismaService: any;
  let gmailSyncQueue: any;

  const mockEmailAccount = {
    id: "account-123",
    workspaceId: "workspace-123",
    userId: "user-123",
    email: "user@example.com",
    accessToken: "access-token",
    refreshToken: "refresh-token",
    isActive: true,
    lastSyncAt: new Date(),
    lastHistoryId: "12345",
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockMessage = {
    id: "123",
    threadId: "thread-123",
    labelIds: ["INBOX"],
    snippet: "This is a test email",
    historyId: "12345",
    internalDate: "1234567890000",
    payload: {
      headers: [
        { name: "Subject", value: "Test Email" },
        { name: "From", value: "sender@example.com" },
        { name: "To", value: "recipient@example.com" },
      ],
    },
  };

  const mockParsedEmail = {
    subject: "Test Email",
    snippet: "This is a test email",
    fromEmail: "sender@example.com",
    fromName: "Sender",
    toEmails: ["recipient@example.com"],
    ccEmails: [],
    bccEmails: [],
    date: new Date(),
    htmlBody: "<p>This is a test email</p>",
    textBody: "This is a test email",
    body: undefined,
    labelIds: undefined,
    internalDate: undefined,
    attachments: [],
  };

  beforeEach(async () => {
    // Create mock queue object
    const mockQueue = {
      add: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailSyncService,
        {
          provide: GmailService,
          useValue: {
            listMessages: jest.fn(),
            getMessage: jest.fn(),
            getHistory: jest.fn(),
            watchMailbox: jest.fn(),
            getProfile: jest.fn(),
          },
        },
        {
          provide: EmailService,
          useValue: {
            upsert: jest.fn(),
            findByMessageId: jest.fn(),
          },
        },
        {
          provide: EmailAccountService,
          useValue: {
            findOne: jest.fn(),
            getFreshAccessToken: jest.fn(),
            updateLastSyncInfo: jest.fn(),
            recordSyncError: jest.fn(),
            recordSuccessfulSync: jest.fn(),
          },
        },
        {
          provide: EmailParserService,
          useValue: {
            parseGmailMessage: jest.fn(),
            extractDirection: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
            },
            emailAccount: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: getQueueToken("gmail-sync"),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<GmailSyncService>(GmailSyncService);
    gmailService = module.get(GmailService);
    emailService = module.get(EmailService);
    emailAccountService = module.get(EmailAccountService);
    emailParserService = module.get(EmailParserService);
    prismaService = module.get(PrismaService);
    gmailSyncQueue = module.get(getQueueToken("gmail-sync"));
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("syncAccount", () => {
    it("should perform full sync for account", async () => {
      (emailAccountService.findOne as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );
      (emailAccountService.getFreshAccessToken as jest.Mock).mockResolvedValue(
        mockEmailAccount.accessToken,
      );
      (gmailService.listMessages as jest.Mock).mockResolvedValue({
        messages: [{ id: "123", threadId: "thread-123" }],
        nextPageToken: null,
      });
      (gmailService.getProfile as jest.Mock).mockResolvedValue({
        emailAddress: "user@example.com",
        historyId: "12345",
      });
      (emailAccountService.recordSuccessfulSync as jest.Mock).mockResolvedValue(
        {},
      );
      (gmailSyncQueue.add as jest.Mock).mockResolvedValue({});

      await service.syncAccount("account-123", { fullSync: true });

      expect(emailAccountService.findOne).toHaveBeenCalledWith("account-123");
      expect(gmailService.listMessages).toHaveBeenCalled();
      expect(gmailSyncQueue.add).toHaveBeenCalledWith(
        "fetch-message",
        {
          accountId: "account-123",
          messageId: "123",
          threadId: "thread-123",
        },
        { priority: 2 },
      );
      expect(emailAccountService.recordSuccessfulSync).toHaveBeenCalled();
    });

    it("should handle sync errors gracefully", async () => {
      (emailAccountService.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.syncAccount("invalid-id")).rejects.toThrow(
        "Account not found",
      );
    });

    it("should record sync errors", async () => {
      const error = new Error("API Error");
      (emailAccountService.findOne as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );
      (emailAccountService.getFreshAccessToken as jest.Mock).mockRejectedValue(
        error,
      );
      (emailAccountService.recordSyncError as jest.Mock).mockResolvedValue({});

      await expect(
        service.syncAccount("account-123", { fullSync: true }),
      ).rejects.toThrow("API Error");

      expect(emailAccountService.recordSyncError).toHaveBeenCalledWith(
        "account-123",
        "API Error",
      );
    });
  });

  describe("fetchAndStoreMessage", () => {
    it("should fetch and store a single message", async () => {
      (emailAccountService.findOne as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );
      (emailAccountService.getFreshAccessToken as jest.Mock).mockResolvedValue(
        mockEmailAccount.accessToken,
      );
      (gmailService.getMessage as jest.Mock).mockResolvedValue(mockMessage);
      (emailParserService.parseGmailMessage as jest.Mock).mockReturnValue(
        mockParsedEmail,
      );
      (emailParserService.extractDirection as jest.Mock).mockReturnValue(
        "INBOUND",
      );
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue({
        id: "sender-user-123",
        email: "sender@example.com",
      });
      (emailService.upsert as jest.Mock).mockResolvedValue({});

      await service.fetchAndStoreMessage("account-123", "123", "thread-123");

      expect(gmailService.getMessage).toHaveBeenCalledWith(
        mockEmailAccount.accessToken,
        "123",
      );
      expect(emailParserService.parseGmailMessage).toHaveBeenCalledWith(
        mockMessage,
      );
      expect(emailService.upsert).toHaveBeenCalled();
      const upsertArgs = (emailService.upsert as jest.Mock).mock.calls[0][0];

      // Check only the fields we explicitly set
      expect(upsertArgs.workspaceId).toBe("workspace-123");
      expect(upsertArgs.accountId).toBe("account-123");
      expect(upsertArgs.messageId).toBe("123");
      expect(upsertArgs.threadId).toBe("thread-123");
      expect(upsertArgs.direction).toBe("INBOUND");
      expect(upsertArgs.senderId).toBe("sender-user-123");
      expect(upsertArgs.gmailHistoryId).toBe("12345");

      // The spread operator should have included all fields from mockParsedEmail
      // Just verify the call was made with the right structure
      expect(Object.keys(upsertArgs)).toContain("workspaceId");
      expect(Object.keys(upsertArgs)).toContain("accountId");
      expect(Object.keys(upsertArgs)).toContain("messageId");
    });

    it("should handle message not found", async () => {
      (emailAccountService.findOne as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );
      (emailAccountService.getFreshAccessToken as jest.Mock).mockResolvedValue(
        mockEmailAccount.accessToken,
      );
      (gmailService.getMessage as jest.Mock).mockResolvedValue(null);
      (emailParserService.parseGmailMessage as jest.Mock).mockResolvedValue({
        ...mockParsedEmail,
        attachments: [], // Ensure attachments array exists
      });

      await service.fetchAndStoreMessage("account-123", "123", "thread-123");

      expect(emailService.upsert).not.toHaveBeenCalled();
    });

    it("should queue attachment downloads", async () => {
      const messageWithAttachments = {
        ...mockMessage,
        payload: {
          ...mockMessage.payload,
          parts: [
            {
              filename: "attachment.pdf",
              body: {
                attachmentId: "attach-123",
                size: 1000,
              },
              mimeType: "application/pdf",
            },
          ],
        },
      };

      const parsedWithAttachments = {
        subject: "Test Email",
        snippet: "This is a test email",
        fromEmail: "sender@example.com",
        fromName: "Sender",
        toEmails: ["recipient@example.com"],
        ccEmails: [],
        bccEmails: [],
        date: new Date(),
        htmlBody: "<p>This is a test email</p>",
        textBody: "This is a test email",
        body: undefined,
        labelIds: undefined,
        internalDate: undefined,
        attachments: [
          {
            id: "attach-123",
            filename: "attachment.pdf",
            mimeType: "application/pdf",
            size: 1000,
          },
        ],
      };

      (emailAccountService.findOne as jest.Mock).mockResolvedValue(
        mockEmailAccount,
      );
      (emailAccountService.getFreshAccessToken as jest.Mock).mockResolvedValue(
        mockEmailAccount.accessToken,
      );
      (gmailService.getMessage as jest.Mock).mockResolvedValue(
        messageWithAttachments,
      );
      (emailParserService.parseGmailMessage as jest.Mock).mockReturnValue(
        parsedWithAttachments,
      );
      (emailParserService.extractDirection as jest.Mock).mockReturnValue(
        "INBOUND",
      );
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);
      (emailService.upsert as jest.Mock).mockResolvedValue({});

      await service.fetchAndStoreMessage("account-123", "123", "thread-123");

      // Verify the parser was called correctly
      expect(emailParserService.parseGmailMessage).toHaveBeenCalledWith(
        messageWithAttachments,
      );

      // Verify the email was stored
      expect(emailService.upsert).toHaveBeenCalled();

      // Verify attachment download was queued
      expect(gmailSyncQueue.add).toHaveBeenCalledTimes(1);
      expect(gmailSyncQueue.add).toHaveBeenCalledWith(
        "download-attachment",
        {
          accountId: "account-123",
          messageId: "123",
          attachmentId: "attach-123",
          filename: "attachment.pdf",
          mimeType: "application/pdf",
          size: 1000,
        },
        { priority: 3 },
      );
    });
  });
});
