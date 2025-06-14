import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";
import { EmailService } from "../gmail/email.service";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";

describe("AiService", () => {
  let service: AiService;
  let emailService: EmailService;
  let contactsService: ContactsService;
  let prismaService: PrismaService;

  const mockEmail = {
    id: "email-123",
    messageId: "msg-123",
    threadId: "thread-123",
    from: "sender@example.com",
    to: ["recipient@example.com"],
    subject: "Project Update",
    textContent:
      "Please review the attached proposal and provide feedback by Friday.",
    htmlContent:
      "<p>Please review the attached proposal and provide feedback by Friday.</p>",
    sentAt: new Date(),
  };

  const mockContact = {
    id: "contact-123",
    workspaceId: "workspace-123",
    email: "john@example.com",
    firstName: "John",
    lastName: "Doe",
    company: null,
    title: null,
    customFields: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key) => {
              if (key === "USE_MOCK_AI") return true;
              return null;
            }),
          },
        },
        {
          provide: EmailService,
          useValue: {
            findByMessageId: jest.fn(),
            findByThread: jest.fn(),
          },
        },
        {
          provide: ContactsService,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            email: {
              groupBy: jest.fn(),
              findMany: jest.fn(),
            },
            contact: {
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    emailService = module.get<EmailService>(EmailService);
    contactsService = module.get<ContactsService>(ContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("summarizeEmail", () => {
    it("should summarize a single email", async () => {
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);
      (emailService.findByThread as jest.Mock).mockResolvedValue([mockEmail]);

      const result = await service.summarizeEmail("msg-123");

      expect(result).toHaveProperty("summary");
      expect(result.summary).toBeTruthy();
      expect(emailService.findByMessageId).toHaveBeenCalledWith("msg-123");
    });

    it("should summarize an email thread", async () => {
      const threadEmails = [
        mockEmail,
        { ...mockEmail, id: "email-124", messageId: "msg-124" },
      ];
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);
      (emailService.findByThread as jest.Mock).mockResolvedValue(threadEmails);

      const result = await service.summarizeEmail("msg-123");

      expect(result).toHaveProperty("summary");
      expect(emailService.findByThread).toHaveBeenCalledWith("thread-123");
    });

    it("should include action items when requested", async () => {
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);
      (emailService.findByThread as jest.Mock).mockResolvedValue([mockEmail]);

      const result = await service.summarizeEmail("msg-123", {
        includeActionItems: true,
      });

      expect(result).toHaveProperty("actionItems");
      expect(Array.isArray(result.actionItems)).toBe(true);
      expect(result.actionItems!.length).toBeGreaterThan(0);
    });

    it("should include key points when requested", async () => {
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);
      (emailService.findByThread as jest.Mock).mockResolvedValue([mockEmail]);

      const result = await service.summarizeEmail("msg-123", {
        includeKeyPoints: true,
      });

      expect(result).toHaveProperty("keyPoints");
      expect(Array.isArray(result.keyPoints)).toBe(true);
      expect(result.keyPoints!.length).toBeGreaterThan(0);
    });

    it("should throw error if email not found", async () => {
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(null);

      await expect(service.summarizeEmail("msg-123")).rejects.toThrow(
        "Email not found",
      );
    });
  });

  describe("generateSmartCompose", () => {
    it("should generate smart compose suggestions", async () => {
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);

      const result = await service.generateSmartCompose(
        "msg-123",
        "I want to accept their proposal",
      );

      expect(result).toHaveProperty("suggestions");
      expect(result).toHaveProperty("fullDraft");
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(result.suggestions.length).toBe(3);
      expect(result.fullDraft).toBeTruthy();
    });

    it("should include context when requested", async () => {
      const threadEmails = [
        mockEmail,
        { ...mockEmail, id: "email-124", messageId: "msg-124" },
      ];
      (emailService.findByMessageId as jest.Mock).mockResolvedValue(mockEmail);
      (emailService.findByThread as jest.Mock).mockResolvedValue(threadEmails);

      const result = await service.generateSmartCompose(
        "msg-123",
        "I want to accept their proposal",
        { includeContext: true },
      );

      expect(emailService.findByThread).toHaveBeenCalledWith("thread-123");
      expect(result.suggestions).toBeTruthy();
    });
  });

  describe("generateInsights", () => {
    it("should generate AI insights", async () => {
      const mockStats = [
        {
          from: "sender@example.com",
          isRead: true,
          isStarred: false,
          _count: 10,
        },
      ];
      const mockContacts = [{ ...mockContact, _count: { emails: 5 } }];

      (prismaService.email.groupBy as jest.Mock).mockResolvedValue(mockStats);
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        mockContacts,
      );

      const timeRange = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      const result = await service.generateInsights("workspace-123", timeRange);

      expect(result).toHaveProperty("communicationPatterns");
      expect(result).toHaveProperty("topContacts");
      expect(result).toHaveProperty("suggestions");
      expect(Array.isArray(result.suggestions)).toBe(true);
    });
  });

  describe("enrichContact", () => {
    it("should enrich contact information", async () => {
      const mockEmails = [
        {
          ...mockEmail,
          textContent:
            "John Doe is the Senior Project Manager at Acme Corporation",
        },
      ];

      (contactsService.findOne as jest.Mock).mockResolvedValue(mockContact);
      (prismaService.email.findMany as jest.Mock).mockResolvedValue(mockEmails);
      (contactsService.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        company: "Acme Corporation",
        title: "Senior Project Manager",
      });

      const result = await service.enrichContact("contact-123");

      expect(result).toHaveProperty("company");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("tags");
      // Update is not called in mock mode
      expect(contactsService.update).not.toHaveBeenCalled();
    });

    it("should throw error if contact not found", async () => {
      (contactsService.findOne as jest.Mock).mockResolvedValue(null);

      await expect(service.enrichContact("contact-123")).rejects.toThrow(
        "Contact not found",
      );
    });
  });
});
