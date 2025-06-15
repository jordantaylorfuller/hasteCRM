import { Test, TestingModule } from "@nestjs/testing";
import { AiService } from "./ai.service";
import { ConfigService } from "@nestjs/config";
import { EmailService } from "../gmail/email.service";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";
import { Logger } from "@nestjs/common";
import Anthropic from "@anthropic-ai/sdk";

jest.mock("@anthropic-ai/sdk");

describe("AiService - Coverage Improvements", () => {
  let service: AiService;
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

    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        if (key === "ANTHROPIC_API_KEY") return "test-api-key";
        if (key === "USE_MOCK_AI") return false;
        return defaultValue;
      },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: EmailService, useValue: mockEmailService },
        { provide: ContactsService, useValue: mockContactsService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<AiService>(AiService);

    jest.spyOn(Logger.prototype, "error").mockImplementation();
    jest.spyOn(Logger.prototype, "warn").mockImplementation();
    jest.spyOn(Logger.prototype, "log").mockImplementation();
  });

  describe("generateSmartCompose - response parsing", () => {
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

    it("should handle non-text response type", async () => {
      // Mock a response where content[0] is not of type "text"
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: "tool_use", // Not "text"
            id: "tool-123",
            name: "some_tool",
            input: {},
          },
        ],
      });

      await expect(
        service.generateSmartCompose(mockEmailId, "test prompt"),
      ).rejects.toThrow();
    });

    it("should parse text response correctly", async () => {
      const expectedResponse = {
        suggestions: ["Option 1", "Option 2", "Option 3"],
        fullDraft: "Full email draft",
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(expectedResponse),
          },
        ],
      });

      const result = await service.generateSmartCompose(
        mockEmailId,
        "test prompt",
      );

      expect(result).toEqual(expectedResponse);
    });

    it("should handle malformed JSON response", async () => {
      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: "text",
            text: "Invalid JSON",
          },
        ],
      });

      await expect(
        service.generateSmartCompose(mockEmailId, "test prompt"),
      ).rejects.toThrow();
    });
  });

  describe("enrichContact - email content mapping", () => {
    const mockContactId = "contact-123";
    const mockContact = {
      id: mockContactId,
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      workspaceId: "workspace-123",
    };

    beforeEach(() => {
      mockContactsService.findOne.mockResolvedValue(mockContact);
    });

    it("should handle emails with different content types", async () => {
      const mockEmails = [
        {
          id: "email-1",
          bodyText: "Text content",
          bodyHtml: null,
          sentAt: new Date(),
        },
        {
          id: "email-2",
          bodyText: null,
          bodyHtml: "<p>HTML content</p>",
          sentAt: new Date(),
        },
        {
          id: "email-3",
          bodyText: null,
          bodyHtml: null,
          sentAt: new Date(),
        },
        {
          id: "email-4",
          bodyText: "Both text",
          bodyHtml: "<p>Both HTML</p>",
          sentAt: new Date(),
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const expectedEnrichment = {
        company: "Tech Corp",
        title: "Software Engineer",
        industry: "Technology",
        interests: ["AI", "Cloud"],
        communicationStyle: "Professional",
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(expectedEnrichment),
          },
        ],
      });

      // Mock the update to return the enriched contact
      const enrichedContact = {
        ...mockContact,
        customFields: {
          enrichedData: expectedEnrichment,
          lastEnriched: new Date(),
        },
      };
      mockContactsService.update.mockResolvedValue(enrichedContact);

      const result = await service.enrichContact(
        mockContactId,
        "workspace-123",
      );

      // Verify that the messages.create was called
      expect(mockAnthropicClient.messages.create).toHaveBeenCalled();
      
      expect(result).toEqual(expectedEnrichment);
    });

    it("should handle empty email content", async () => {
      const mockEmails = [
        {
          id: "email-1",
          bodyText: "",
          bodyHtml: "",
          sentAt: new Date(),
        },
        {
          id: "email-2",
          bodyText: null,
          bodyHtml: null,
          sentAt: new Date(),
        },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const expectedEnrichment = {
        company: "Unknown",
        title: "Unknown",
      };

      mockAnthropicClient.messages.create.mockResolvedValue({
        content: [
          {
            type: "text",
            text: JSON.stringify(expectedEnrichment),
          },
        ],
      });

      // Mock the update to return the enriched contact
      const enrichedContact = {
        ...mockContact,
        customFields: {
          enrichedData: expectedEnrichment,
          lastEnriched: new Date(),
        },
      };
      mockContactsService.update.mockResolvedValue(enrichedContact);

      const result = await service.enrichContact(
        mockContactId,
        "workspace-123",
      );

      expect(result).toEqual(expectedEnrichment);
    });
  });
});