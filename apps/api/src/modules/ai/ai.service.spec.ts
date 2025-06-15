import { Test, TestingModule } from "@nestjs/testing";
import { AiService } from "./ai.service";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../gmail/email.service";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";
import { Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

jest.mock("@anthropic-ai/sdk");

describe("AiService", () => {
  let service: AiService;
  let configService: ConfigService;
  let emailService: EmailService;
  let contactsService: ContactsService;
  let prismaService: PrismaService;
  let mockAnthropicClient: any;

  const mockConfigService = {
    get: jest.fn(),
  };

  const mockEmailService = {
    findByMessageId: jest.fn(),
    findByThread: jest.fn(),
  };

  const mockContactsService = {
    findOne: jest.fn(),
    update: jest.fn(),
  };

  const mockPrismaService = {
    email: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    contact: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockAnthropicClient = {
      messages: {
        create: jest.fn(),
      },
    };

    (Anthropic as jest.MockedClass<typeof Anthropic>).mockImplementation(
      () => mockAnthropicClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: ContactsService,
          useValue: mockContactsService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AiService>(AiService);
    configService = module.get<ConfigService>(ConfigService);
    emailService = module.get<EmailService>(EmailService);
    contactsService = module.get<ContactsService>(ContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("initialization", () => {
    it("should use mock AI when USE_MOCK_AI is true", () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      expect(newService["useMockAi"]).toBe(true);
    });

    it("should use real AI when USE_MOCK_AI is false and API key exists", () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      expect(newService["useMockAi"]).toBe(false);
      expect(Anthropic).toHaveBeenCalledWith({ apiKey: "test-key" });
    });

    it("should warn when no API key is provided", () => {
      const loggerSpy = jest
        .spyOn(Logger.prototype, "warn")
        .mockImplementation();
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "";
          return defaultValue;
        },
      );

      new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });
  });

  describe("summarizeEmail", () => {
    const mockEmailId = "email-123";
    const mockEmail = {
      id: mockEmailId,
      subject: "Project Update",
      bodyText:
        "Here is the latest update on our project. We have completed phase 1.",
      bodyHtml:
        "<p>Here is the latest update on our project. We have completed phase 1.</p>",
      fromEmail: "sender@example.com",
      toEmails: ["recipient@example.com"],
      threadId: "thread-123",
    };

    beforeEach(() => {
      mockEmailService.findByMessageId.mockResolvedValue(mockEmail);
      mockEmailService.findByThread.mockResolvedValue([mockEmail]);
    });

    it("should summarize email using mock AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          return defaultValue;
        },
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );

      const result = await newService.summarizeEmail(mockEmailId, {
        includeActionItems: true,
        includeKeyPoints: true,
      });

      expect(result).toEqual({
        summary: expect.any(String),
        actionItems: expect.any(Array),
        keyPoints: expect.any(Array),
      });
      expect(mockEmailService.findByMessageId).toHaveBeenCalledWith(
        mockEmailId,
      );
    });

    it("should summarize email using real AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const aiResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary: "Project update showing completion of phase 1",
              keyPoints: ["Phase 1 completed", "Moving to phase 2"],
              actionItems: ["Begin phase 2 planning"],
            }),
          },
        ],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(aiResponse);

      // Create a new service instance with real AI mode
      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );

      const result = await newService.summarizeEmail(mockEmailId, {
        includeActionItems: true,
        includeKeyPoints: true,
      });

      expect(result.summary).toBe(
        "Project update showing completion of phase 1",
      );
      expect(result.keyPoints).toEqual([
        "Phase 1 completed",
        "Moving to phase 2",
      ]);
      expect(result.actionItems).toEqual(["Begin phase 2 planning"]);

      expect(mockAnthropicClient.messages.create).toHaveBeenCalledWith({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: expect.stringContaining("summarize"),
          },
        ],
      });
    });

    it("should handle email not found", async () => {
      mockEmailService.findByMessageId.mockResolvedValue(null);

      await expect(
        service.summarizeEmail("non-existent-email"),
      ).rejects.toThrow("Email not found");
    });

    it("should handle thread emails", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const threadEmails = [
        { ...mockEmail, id: "email-1", sentAt: new Date("2024-01-01") },
        { ...mockEmail, id: "email-2", sentAt: new Date("2024-01-02") },
      ];

      mockEmailService.findByThread.mockResolvedValue(threadEmails);

      const aiResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              summary: "Email thread about project update",
              keyPoints: ["Project update received", "Acknowledgment sent"],
              actionItems: ["Continue monitoring project"],
            }),
          },
        ],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(aiResponse);

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      await newService.summarizeEmail(mockEmailId);

      expect(mockEmailService.findByThread).toHaveBeenCalledWith(
        mockEmail.threadId,
      );
    });

    it("should handle API errors", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error("API Error"),
      );

      await expect(service.summarizeEmail(mockEmailId)).rejects.toThrow(
        "API Error",
      );
    });
  });

  describe("generateSmartCompose", () => {
    const mockEmailId = "email-123";
    const mockEmail = {
      id: mockEmailId,
      subject: "Meeting Request",
      bodyText: "Would you be available for a meeting next Tuesday at 2 PM?",
      fromEmail: "client@example.com",
      threadId: "thread-123",
    };

    beforeEach(() => {
      mockEmailService.findByMessageId.mockResolvedValue(mockEmail);
      mockEmailService.findByThread.mockResolvedValue([mockEmail]);
    });

    it("should generate smart compose using mock AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          return defaultValue;
        },
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );

      const result = await newService.generateSmartCompose(
        mockEmailId,
        "I would like to accept",
        {
          tone: "professional",
          includeContext: true,
        },
      );

      expect(result).toEqual({
        suggestions: expect.any(Array),
        fullDraft: expect.any(String),
      });
      expect(result.suggestions).toHaveLength(3);
    });

    it("should generate smart compose using real AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const aiResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              suggestions: [
                "Thank you for the meeting request. Tuesday at 2 PM works well for me.",
                "I appreciate your invitation. I'm available on Tuesday at 2 PM.",
                "Tuesday at 2 PM is perfect. Looking forward to our meeting.",
              ],
              fullDraft:
                "Dear Client,\n\nThank you for reaching out. I would be happy to meet on Tuesday at 2 PM.\n\nBest regards",
            }),
          },
        ],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(aiResponse);

      const result = await service.generateSmartCompose(
        mockEmailId,
        "I would like to accept",
      );

      expect(result.suggestions).toHaveLength(3);
      expect(result.fullDraft).toBeDefined();
    });

    it("should handle email not found", async () => {
      mockEmailService.findByMessageId.mockResolvedValue(null);

      await expect(
        service.generateSmartCompose("non-existent-email", "test"),
      ).rejects.toThrow("Email not found");
    });

    it("should handle AI API errors in generateSmartCompose", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();
      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error("API Error"),
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );

      await expect(
        newService.generateSmartCompose(mockEmailId, "test"),
      ).rejects.toThrow("API Error");

      expect(loggerSpy).toHaveBeenCalledWith(
        "Failed to generate smart compose",
        expect.any(Error),
      );
      loggerSpy.mockRestore();
    });
  });

  describe("generateInsights", () => {
    const mockWorkspaceId = "workspace-123";
    const timeRange = {
      start: new Date("2024-01-01"),
      end: new Date("2024-01-31"),
    };

    it("should generate insights using mock AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          return defaultValue;
        },
      );

      mockPrismaService.email.groupBy.mockResolvedValue([
        {
          fromEmail: "test@example.com",
          isRead: true,
          isStarred: false,
          _count: 10,
        },
      ]);

      mockPrismaService.contact.findMany.mockResolvedValue([
        {
          id: "contact-1",
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          _count: { emails: 5 },
        },
      ]);

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = await newService.generateInsights(
        mockWorkspaceId,
        timeRange,
      );

      expect(result).toEqual({
        communicationPatterns: expect.any(Object),
        topContacts: expect.any(Array),
        suggestions: expect.any(Array),
      });
    });

    it("should generate insights using real AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      mockPrismaService.email.groupBy.mockResolvedValue([]);
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const aiResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              communicationPatterns: {
                totalEmails: 100,
                peakHours: ["9-11 AM"],
              },
              topContacts: [{ name: "John Doe", interactionCount: 25 }],
              suggestions: ["Follow up with key contacts"],
            }),
          },
        ],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(aiResponse);

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = await newService.generateInsights(
        mockWorkspaceId,
        timeRange,
      );

      expect(result).toHaveProperty("communicationPatterns");
      expect(result).toHaveProperty("topContacts");
      expect(result).toHaveProperty("suggestions");
      expect(result.communicationPatterns).toMatchObject({
        totalEmails: expect.any(Number),
        peakHours: expect.any(Array),
      });
      expect(Array.isArray(result.topContacts)).toBe(true);
      expect(Array.isArray(result.suggestions)).toBe(true);
    });

    it("should handle AI API errors in generateInsights", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      mockPrismaService.email.groupBy.mockResolvedValue([]);
      mockPrismaService.contact.findMany.mockResolvedValue([]);

      const loggerSpy = jest
        .spyOn(Logger.prototype, "error")
        .mockImplementation();
      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error("API Error"),
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );

      await expect(
        newService.generateInsights(mockWorkspaceId, timeRange),
      ).rejects.toThrow("API Error");

      expect(loggerSpy).toHaveBeenCalledWith(
        "Failed to generate insights",
        expect.any(Error),
      );
      loggerSpy.mockRestore();
    });
  });

  describe("enrichContact", () => {
    const mockContactId = "contact-123";
    const mockWorkspaceId = "workspace-123";
    const mockContact = {
      id: mockContactId,
      email: "john@acme.com",
      firstName: "John",
      lastName: "Doe",
    };

    beforeEach(() => {
      mockContactsService.findOne.mockResolvedValue(mockContact);
      mockPrismaService.email.findMany.mockResolvedValue([]);
    });

    it("should enrich contact using mock AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          return defaultValue;
        },
      );

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = await newService.enrichContact(
        mockContactId,
        mockWorkspaceId,
      );

      expect(result).toEqual({
        company: expect.any(String),
        title: expect.any(String),
        linkedInUrl: expect.any(String),
        summary: expect.any(String),
        tags: expect.any(Array),
      });

      expect(mockContactsService.update).toHaveBeenCalled();
    });

    it("should enrich contact using real AI", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      const aiResponse = {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              company: "Acme Corporation",
              title: "Senior Project Manager",
              linkedInUrl: "https://linkedin.com/in/johndoe",
              summary: "Experienced project manager",
              tags: ["technology", "enterprise"],
            }),
          },
        ],
      };

      mockAnthropicClient.messages.create.mockResolvedValue(aiResponse);

      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = await newService.enrichContact(
        mockContactId,
        mockWorkspaceId,
      );

      expect(result).toEqual({
        company: "Acme Corporation",
        title: "Senior Project Manager",
        linkedInUrl: "https://linkedin.com/in/johndoe",
        summary: "Experienced project manager",
        tags: ["technology", "enterprise"],
      });

      expect(mockContactsService.update).toHaveBeenCalledWith(
        mockContactId,
        mockWorkspaceId,
        {
          title: "Senior Project Manager",
          linkedinUrl: "https://linkedin.com/in/johndoe",
        },
      );
    });

    it("should handle contact not found", async () => {
      mockContactsService.findOne.mockResolvedValue(null);

      await expect(
        service.enrichContact("non-existent-contact", mockWorkspaceId),
      ).rejects.toThrow("Contact not found");
    });

    it("should handle enrichment errors", async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return false;
          if (key === "ANTHROPIC_API_KEY") return "test-key";
          return defaultValue;
        },
      );

      mockAnthropicClient.messages.create.mockRejectedValue(
        new Error("API Error"),
      );

      await expect(
        service.enrichContact(mockContactId, mockWorkspaceId),
      ).rejects.toThrow("API Error");
    });
  });

  describe("mock implementations", () => {
    beforeEach(() => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: any) => {
          if (key === "USE_MOCK_AI") return true;
          return defaultValue;
        },
      );
    });

    it("should provide consistent mock summarization", async () => {
      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = newService["mockSummarizeEmail"]("Test email content", {
        includeActionItems: true,
        includeKeyPoints: true,
      });

      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("actionItems");
      expect(result).toHaveProperty("keyPoints");
      expect(result.actionItems).toHaveLength(3);
      expect(result.keyPoints).toHaveLength(3);
    });

    it("should provide consistent mock smart compose", async () => {
      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = newService["mockGenerateSmartCompose"](
        "prompt",
        "context",
        {
          tone: "professional",
        },
      );

      expect(result).toHaveProperty("suggestions");
      expect(result).toHaveProperty("fullDraft");
      expect(result.suggestions).toHaveLength(3);
    });

    it("should provide consistent mock insights", async () => {
      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = newService["mockGenerateInsights"]([], []);

      expect(result).toHaveProperty("communicationPatterns");
      expect(result).toHaveProperty("topContacts");
      expect(result).toHaveProperty("suggestions");
      expect(result.suggestions).toHaveLength(4);
    });

    it("should provide consistent mock enrichment", async () => {
      const newService = new AiService(
        configService,
        emailService,
        contactsService,
        prismaService,
      );
      const result = newService["mockEnrichContact"]({ firstName: "John" }, "");

      expect(result).toHaveProperty("company");
      expect(result).toHaveProperty("title");
      expect(result).toHaveProperty("linkedInUrl");
      expect(result).toHaveProperty("summary");
      expect(result).toHaveProperty("tags");
      expect(result.tags).toHaveLength(4);
    });
  });
});
