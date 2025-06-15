import { Test, TestingModule } from "@nestjs/testing";
import { AiResolver } from "./ai.resolver";
import { AiService } from "./ai.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

describe("AiResolver", () => {
  let resolver: AiResolver;
  let aiService: AiService;

  const mockAiService = {
    summarizeEmail: jest.fn(),
    generateInsights: jest.fn(),
    generateSmartCompose: jest.fn(),
    enrichContact: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        workspaceId: "workspace-123",
        userId: "user-123",
        email: "test@example.com",
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiResolver,
        {
          provide: AiService,
          useValue: mockAiService,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    resolver = module.get<AiResolver>(AiResolver);
    aiService = module.get<AiService>(AiService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("summarizeEmail", () => {
    it("should summarize email with all options", async () => {
      const input = {
        emailId: "email-123",
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      };

      const mockSummary = {
        summary: "This is a summary of the email...",
        actionItems: ["Follow up with client", "Send proposal"],
        keyPoints: ["Budget approved", "Timeline confirmed"],
        originalLength: 2500,
        summaryLength: 150,
      };

      mockAiService.summarizeEmail.mockResolvedValue(mockSummary);

      const result = await resolver.summarizeEmail(input, mockContext);

      expect(aiService.summarizeEmail).toHaveBeenCalledWith("email-123", {
        includeActionItems: true,
        includeKeyPoints: true,
        maxLength: 500,
      });
      expect(result).toEqual(mockSummary);
    });

    it("should summarize email with minimal options", async () => {
      const input = {
        emailId: "email-456",
      };

      const mockSummary = {
        summary: "Basic email summary...",
        originalLength: 1000,
        summaryLength: 100,
      };

      mockAiService.summarizeEmail.mockResolvedValue(mockSummary);

      const result = await resolver.summarizeEmail(input, mockContext);

      expect(aiService.summarizeEmail).toHaveBeenCalledWith("email-456", {
        includeActionItems: undefined,
        includeKeyPoints: undefined,
        maxLength: undefined,
      });
      expect(result).toEqual(mockSummary);
    });
  });

  describe("getAiInsights", () => {
    it("should get AI insights for time range", async () => {
      const timeRange = {
        start: "2024-01-01T00:00:00Z",
        end: "2024-01-31T23:59:59Z",
      };

      const mockInsights = {
        emailPatterns: {
          totalEmails: 500,
          peakHours: ["9AM", "2PM"],
          topSenders: ["client@example.com", "partner@example.com"],
        },
        contactInsights: {
          mostActive: ["John Doe", "Jane Smith"],
          newContacts: 25,
        },
        dealInsights: {
          wonDeals: 10,
          lostDeals: 5,
          avgDealSize: 50000,
        },
      };

      mockAiService.generateInsights.mockResolvedValue(mockInsights);

      const result = await resolver.getAiInsights(timeRange, mockContext);

      expect(aiService.generateInsights).toHaveBeenCalledWith("workspace-123", {
        start: new Date("2024-01-01T00:00:00Z"),
        end: new Date("2024-01-31T23:59:59Z"),
      });
      expect(result).toEqual(mockInsights);
    });
  });

  describe("generateSmartCompose", () => {
    it("should generate smart compose with all options", async () => {
      const input = {
        emailId: "email-123",
        prompt: "Reply thanking for the proposal",
        tone: "professional",
        length: "medium",
        includeContext: true,
      };

      const mockCompose = {
        suggestion: "Thank you for sending over the proposal...",
        alternativeSuggestions: [
          "I appreciate you taking the time to send the proposal...",
          "Thanks for the detailed proposal...",
        ],
        contextUsed: [
          "Previous email mentioned budget",
          "Sender is key client",
        ],
      };

      mockAiService.generateSmartCompose.mockResolvedValue(mockCompose);

      const result = await resolver.generateSmartCompose(input, mockContext);

      expect(aiService.generateSmartCompose).toHaveBeenCalledWith(
        "email-123",
        "Reply thanking for the proposal",
        {
          tone: "professional",
          length: "medium",
          includeContext: true,
        },
      );
      expect(result).toEqual(mockCompose);
    });

    it("should generate smart compose with minimal options", async () => {
      const input = {
        emailId: "email-456",
        prompt: "Quick follow up",
      };

      const mockCompose = {
        suggestion: "Following up on our previous conversation...",
      };

      mockAiService.generateSmartCompose.mockResolvedValue(mockCompose);

      await resolver.generateSmartCompose(input, mockContext);

      expect(aiService.generateSmartCompose).toHaveBeenCalledWith(
        "email-456",
        "Quick follow up",
        {
          tone: undefined,
          length: undefined,
          includeContext: undefined,
        },
      );
    });
  });

  describe("enrichContact", () => {
    it("should enrich contact information", async () => {
      const contactId = "contact-123";

      const mockEnrichedData = {
        contactId: "contact-123",
        enrichedData: {
          company: {
            name: "Tech Corp",
            size: "100-500",
            industry: "Software",
            website: "techcorp.com",
          },
          social: {
            linkedin: "linkedin.com/in/johndoe",
            twitter: "@johndoe",
          },
          insights: ["Senior decision maker", "Interested in automation tools"],
        },
        confidence: 0.85,
        sources: ["Public data", "Email signature analysis"],
      };

      mockAiService.enrichContact.mockResolvedValue(mockEnrichedData);

      const result = await resolver.enrichContact(contactId, mockContext);

      expect(aiService.enrichContact).toHaveBeenCalledWith(
        "contact-123",
        "workspace-123",
      );
      expect(result).toEqual(mockEnrichedData);
    });

    it("should handle enrichment failures", async () => {
      const contactId = "contact-456";

      mockAiService.enrichContact.mockRejectedValue(
        new Error("Enrichment service unavailable"),
      );

      await expect(
        resolver.enrichContact(contactId, mockContext),
      ).rejects.toThrow("Enrichment service unavailable");
    });
  });
});
