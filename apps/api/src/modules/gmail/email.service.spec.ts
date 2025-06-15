import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "./email.service";
import { PrismaService } from "../prisma/prisma.service";

describe("EmailService", () => {
  let service: EmailService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    email: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
      count: jest.fn(),
      upsert: jest.fn(),
    },
    emailAttachment: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    emailAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockWorkspaceId = "workspace-123";
  const mockUserId = "user-123";
  const mockEmailAccountId = "email-account-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe("upsert", () => {
    it("should create an email with attachments", async () => {
      const emailData = {
        workspaceId: mockWorkspaceId,
        accountId: "account-123",
        messageId: "msg-123",
        threadId: "thread-123",
        subject: "Test Email",
        snippet: "Test email content",
        bodyHtml: "<p>Test email content</p>",
        bodyText: "Test email content",
        fromEmail: "sender@example.com",
        fromName: "Sender Name",
        toEmails: ["recipient@example.com"],
        toNames: ["Recipient Name"],
        ccEmails: [],
        ccNames: [],
        bccEmails: [],
        bccNames: [],
        direction: "INBOUND" as const,
        sentAt: new Date(),
        receivedAt: new Date(),
        gmailLabels: ["INBOX"],
        isRead: false,
        isStarred: false,
        isImportant: false,
        isDraft: false,
        senderId: "sender-123",
        attachments: [
          {
            filename: "attachment.pdf",
            mimeType: "application/pdf",
            size: 1024,
            gmailId: "attach-123",
          },
        ],
      };

      const mockCreatedEmail = {
        id: "email-123",
        ...emailData,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.email.upsert.mockResolvedValue(mockCreatedEmail);
      mockPrismaService.emailAttachment.deleteMany.mockResolvedValue({
        count: 0,
      });
      mockPrismaService.emailAttachment.createMany.mockResolvedValue({
        count: 1,
      });

      const result = await service.upsert(emailData);

      expect(result).toEqual(mockCreatedEmail);
      expect(mockPrismaService.email.upsert).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        create: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          messageId: "msg-123",
          subject: "Test Email",
        }),
        update: expect.objectContaining({
          workspaceId: mockWorkspaceId,
          messageId: "msg-123",
          subject: "Test Email",
        }),
        include: { attachments: true },
      });
    });

    it("should create an email without attachments", async () => {
      const emailWithoutAttachments = {
        workspaceId: mockWorkspaceId,
        accountId: "account-123",
        messageId: "msg-456",
        threadId: "thread-456",
        subject: "Another Test Email",
        snippet: "Another test email content",
        bodyHtml: "<p>Another test email content</p>",
        bodyText: "Another test email content",
        fromEmail: "sender2@example.com",
        fromName: "Sender 2",
        toEmails: ["recipient2@example.com"],
        toNames: ["Recipient 2"],
        ccEmails: [],
        ccNames: [],
        bccEmails: [],
        bccNames: [],
        direction: "OUTBOUND" as const,
        sentAt: new Date(),
        receivedAt: new Date(),
        gmailLabels: ["SENT"],
        isRead: true,
        isStarred: false,
        isImportant: false,
        isDraft: false,
        senderId: "sender-456",
      };

      const mockCreatedEmail = {
        id: "email-456",
        ...emailWithoutAttachments,
        attachments: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.email.upsert.mockResolvedValue(mockCreatedEmail);

      const result = await service.upsert(emailWithoutAttachments);

      expect(result).toEqual(mockCreatedEmail);
      expect(
        mockPrismaService.emailAttachment.createMany,
      ).not.toHaveBeenCalled();
    });

    it("should handle database errors", async () => {
      const emailData = {
        workspaceId: mockWorkspaceId,
        accountId: "account-123",
        messageId: "msg-123",
        threadId: "thread-123",
        subject: "Test Email",
        fromEmail: "sender@example.com",
        toEmails: ["recipient@example.com"],
        toNames: ["Recipient Name"],
        ccEmails: [],
        ccNames: [],
        bccEmails: [],
        bccNames: [],
        direction: "INBOUND" as const,
        sentAt: new Date(),
        receivedAt: new Date(),
        gmailLabels: ["INBOX"],
        isRead: false,
        isStarred: false,
        isImportant: false,
        isDraft: false,
        senderId: "sender-123",
      };

      mockPrismaService.email.upsert.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(service.upsert(emailData)).rejects.toThrow("Database error");
    });
  });

  describe("findByMessageId", () => {
    it("should find email by message ID", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        subject: "Test Email",
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);

      const result = await service.findByMessageId("msg-123");

      expect(result).toEqual(mockEmail);
      expect(mockPrismaService.email.findUnique).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        include: { attachments: true },
      });
    });

    it("should return null if email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      const result = await service.findByMessageId("non-existent");

      expect(result).toBeNull();
    });
  });

  describe("findByThread", () => {
    it("should find emails by thread ID", async () => {
      const mockEmails = [
        {
          id: "email-1",
          threadId: "thread-123",
          sentAt: new Date("2024-01-01"),
        },
        {
          id: "email-2",
          threadId: "thread-123",
          sentAt: new Date("2024-01-02"),
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.findByThread("thread-123");

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { threadId: "thread-123" },
        orderBy: { sentAt: "asc" },
        include: { attachments: true },
      });
    });

    it("should return empty array if no emails found", async () => {
      mockPrismaService.email.findMany.mockResolvedValue([]);

      const result = await service.findByThread("non-existent-thread");

      expect(result).toEqual([]);
    });
  });

  describe("findByWorkspace", () => {
    it("should find emails for a workspace with pagination", async () => {
      const mockEmails = [
        {
          id: "email-1",
          messageId: "msg-1",
          subject: "Email 1",
          workspaceId: mockWorkspaceId,
        },
        {
          id: "email-2",
          messageId: "msg-2",
          subject: "Email 2",
          workspaceId: mockWorkspaceId,
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);
      mockPrismaService.email.count.mockResolvedValue(10);

      const result = await service.findByWorkspace(mockWorkspaceId, {
        skip: 0,
        take: 20,
      });

      expect(result.emails).toEqual(mockEmails);
      expect(result.total).toBe(10);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
        skip: 0,
        take: 20,
        orderBy: { sentAt: "desc" },
        include: { attachments: true },
      });
    });

    it("should find emails with custom filters", async () => {
      const mockEmails = [];
      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);
      mockPrismaService.email.count.mockResolvedValue(0);

      const result = await service.findByWorkspace(mockWorkspaceId, {
        where: { isRead: false },
        orderBy: { sentAt: "asc" },
      });

      expect(result.emails).toEqual(mockEmails);
      expect(result.total).toBe(0);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId, isRead: false },
        skip: 0,
        take: 20,
        orderBy: { sentAt: "asc" },
        include: { attachments: true },
      });
    });
  });

  describe("findByContact", () => {
    it("should find emails by contact", async () => {
      const mockEmails = [
        {
          id: "email-1",
          messageId: "msg-1",
          subject: "Email 1",
          contactId: "contact-123",
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.findByContact("contact-123");

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { contactId: "contact-123" },
        orderBy: { sentAt: "desc" },
        include: { attachments: true },
      });
    });
  });

  describe("findByDeal", () => {
    it("should find emails by deal", async () => {
      const mockEmails = [
        {
          id: "email-1",
          messageId: "msg-1",
          subject: "Deal Email 1",
          dealId: "deal-123",
        },
        {
          id: "email-2",
          messageId: "msg-2",
          subject: "Deal Email 2",
          dealId: "deal-123",
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.findByDeal("deal-123");

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { dealId: "deal-123" },
        orderBy: { sentAt: "desc" },
        include: { attachments: true },
      });
    });

    it("should return empty array for non-existent deal", async () => {
      mockPrismaService.email.findMany.mockResolvedValue([]);

      const result = await service.findByDeal("non-existent");

      expect(result).toEqual([]);
    });
  });

  describe("search", () => {
    it("should search emails by query", async () => {
      const mockEmails = [
        {
          id: "email-1",
          subject: "Important meeting",
          bodyText: "Let's discuss the project",
          fromEmail: "john@example.com",
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);
      mockPrismaService.email.count.mockResolvedValue(1);

      const result = await service.search(mockWorkspaceId, "meeting");

      expect(result.emails).toEqual(mockEmails);
      expect(result.total).toBe(1);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          OR: [
            { subject: { contains: "meeting", mode: "insensitive" } },
            { bodyText: { contains: "meeting", mode: "insensitive" } },
            { fromEmail: { contains: "meeting", mode: "insensitive" } },
            { fromName: { contains: "meeting", mode: "insensitive" } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: { sentAt: "desc" },
        include: { attachments: true },
      });
    });

    it("should search with pagination", async () => {
      mockPrismaService.email.findMany.mockResolvedValue([]);
      mockPrismaService.email.count.mockResolvedValue(50);

      const result = await service.search(mockWorkspaceId, "test", {
        skip: 20,
        take: 10,
      });

      expect(result.total).toBe(50);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        skip: 20,
        take: 10,
        orderBy: { sentAt: "desc" },
        include: { attachments: true },
      });
    });
  });

  describe("markAsRead", () => {
    it("should mark email as read", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        isRead: true,
      };

      mockPrismaService.email.update.mockResolvedValue(mockEmail);

      const result = await service.markAsRead("msg-123");

      expect(result).toEqual(mockEmail);
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: { isRead: true },
      });
    });
  });

  describe("markAsUnread", () => {
    it("should mark email as unread", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        isRead: false,
      };

      mockPrismaService.email.update.mockResolvedValue(mockEmail);

      const result = await service.markAsUnread("msg-123");

      expect(result).toEqual(mockEmail);
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: { isRead: false },
      });
    });
  });

  describe("toggleStar", () => {
    it("should toggle star status on", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        isStarred: false,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        isStarred: true,
      });

      const result = await service.toggleStar("msg-123");

      expect(result.isStarred).toBe(true);
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: { isStarred: true },
      });
    });

    it("should toggle star status off", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        isStarred: true,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        isStarred: false,
      });

      const result = await service.toggleStar("msg-123");

      expect(result.isStarred).toBe(false);
    });

    it("should throw error if email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await expect(service.toggleStar("non-existent")).rejects.toThrow(
        "Email not found"
      );
    });
  });

  describe("markAsDeleted", () => {
    it("should delete email", async () => {
      mockPrismaService.email.deleteMany.mockResolvedValue({ count: 1 });

      await service.markAsDeleted(mockWorkspaceId, "msg-123");

      expect(mockPrismaService.email.deleteMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          messageId: "msg-123",
        },
      });
    });
  });

  describe("addLabels", () => {
    it("should add labels to email", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        workspaceId: mockWorkspaceId,
        gmailLabels: ["INBOX"],
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        gmailLabels: ["INBOX", "IMPORTANT", "STARRED"],
      });

      const result = await service.addLabels(mockWorkspaceId, "msg-123", [
        "IMPORTANT",
        "STARRED",
      ]);

      expect(result.gmailLabels).toContain("INBOX");
      expect(result.gmailLabels).toContain("IMPORTANT");
      expect(result.gmailLabels).toContain("STARRED");
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: { gmailLabels: ["INBOX", "IMPORTANT", "STARRED"] },
      });
    });

    it("should not duplicate existing labels", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        workspaceId: mockWorkspaceId,
        gmailLabels: ["INBOX", "IMPORTANT"],
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        gmailLabels: ["INBOX", "IMPORTANT"],
      });

      const result = await service.addLabels(mockWorkspaceId, "msg-123", [
        "IMPORTANT",
        "INBOX",
      ]);

      expect(result.gmailLabels).toHaveLength(2);
    });

    it("should throw error if email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await expect(
        service.addLabels(mockWorkspaceId, "non-existent", ["LABEL"])
      ).rejects.toThrow("Email not found");
    });

    it("should throw error if email belongs to different workspace", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        workspaceId: "different-workspace",
        gmailLabels: [],
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);

      await expect(
        service.addLabels(mockWorkspaceId, "msg-123", ["LABEL"])
      ).rejects.toThrow("Email not found");
    });
  });

  describe("removeLabels", () => {
    it("should remove labels from email", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        workspaceId: mockWorkspaceId,
        gmailLabels: ["INBOX", "IMPORTANT", "STARRED"],
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        gmailLabels: ["INBOX"],
      });

      const result = await service.removeLabels(mockWorkspaceId, "msg-123", [
        "IMPORTANT",
        "STARRED",
      ]);

      expect(result.gmailLabels).toEqual(["INBOX"]);
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: { gmailLabels: ["INBOX"] },
      });
    });

    it("should handle removing non-existent labels", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        workspaceId: mockWorkspaceId,
        gmailLabels: ["INBOX"],
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue(mockEmail);

      const result = await service.removeLabels(mockWorkspaceId, "msg-123", [
        "IMPORTANT",
        "STARRED",
      ]);

      expect(result.gmailLabels).toEqual(["INBOX"]);
    });

    it("should throw error if email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await expect(
        service.removeLabels(mockWorkspaceId, "non-existent", ["LABEL"])
      ).rejects.toThrow("Email not found");
    });
  });

  describe("getStats", () => {
    it("should return email statistics", async () => {
      mockPrismaService.email.count
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(25) // unread
        .mockResolvedValueOnce(10) // starred
        .mockResolvedValueOnce(40) // sent
        .mockResolvedValueOnce(60); // received

      const result = await service.getStats(mockWorkspaceId);

      expect(result).toEqual({
        total: 100,
        unread: 25,
        starred: 10,
        sent: 40,
        received: 60,
      });

      expect(mockPrismaService.email.count).toHaveBeenCalledTimes(5);
      expect(mockPrismaService.email.count).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId },
      });
      expect(mockPrismaService.email.count).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId, isRead: false },
      });
      expect(mockPrismaService.email.count).toHaveBeenCalledWith({
        where: { workspaceId: mockWorkspaceId, isStarred: true },
      });
    });
  });

  describe("recordOpen", () => {
    const mockEmailTrackingEvent = {
      create: jest.fn(),
    };

    beforeEach(() => {
      (mockPrismaService as any).emailTrackingEvent = mockEmailTrackingEvent;
    });

    it("should record email open", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        openCount: 0,
        firstOpenedAt: null,
        lastOpenedAt: null,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.$transaction.mockImplementation(async (operations) => {
        return Promise.all(operations);
      });
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        openCount: 1,
        firstOpenedAt: new Date(),
        lastOpenedAt: new Date(),
      });
      mockEmailTrackingEvent.create.mockResolvedValue({
        id: "event-123",
        emailId: "email-123",
        type: "open",
      });

      await service.recordOpen("msg-123", { userAgent: "Chrome" });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: {
          openCount: { increment: 1 },
          firstOpenedAt: expect.any(Date),
          lastOpenedAt: expect.any(Date),
        },
      });
    });

    it("should update lastOpenedAt for subsequent opens", async () => {
      const firstOpenedAt = new Date("2024-01-01");
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        openCount: 5,
        firstOpenedAt: firstOpenedAt,
        lastOpenedAt: new Date("2024-01-05"),
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.$transaction.mockImplementation(async (operations) => {
        return Promise.all(operations);
      });
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        openCount: 6,
        lastOpenedAt: new Date(),
      });

      await service.recordOpen("msg-123");

      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: {
          openCount: { increment: 1 },
          firstOpenedAt: firstOpenedAt,
          lastOpenedAt: expect.any(Date),
        },
      });
    });

    it("should handle email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await service.recordOpen("non-existent");

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("recordClick", () => {
    const mockEmailTrackingEvent = {
      create: jest.fn(),
    };

    beforeEach(() => {
      (mockPrismaService as any).emailTrackingEvent = mockEmailTrackingEvent;
    });

    it("should record email click", async () => {
      const mockEmail = {
        id: "email-123",
        messageId: "msg-123",
        clickCount: 0,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.$transaction.mockImplementation(async (operations) => {
        return Promise.all(operations);
      });
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        clickCount: 1,
      });
      mockEmailTrackingEvent.create.mockResolvedValue({
        id: "event-123",
        emailId: "email-123",
        type: "click",
        metadata: { url: "https://example.com" },
      });

      await service.recordClick("msg-123", "https://example.com", {
        browser: "Chrome",
      });

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { messageId: "msg-123" },
        data: {
          clickCount: { increment: 1 },
        },
      });
      expect(mockEmailTrackingEvent.create).toHaveBeenCalledWith({
        data: {
          emailId: "email-123",
          type: "click",
          metadata: {
            url: "https://example.com",
            browser: "Chrome",
          },
        },
      });
    });

    it("should handle email not found", async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await service.recordClick("non-existent", "https://example.com");

      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
