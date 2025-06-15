import { Test, TestingModule } from "@nestjs/testing";
import { GmailService } from "./gmail.service";
import { PrismaService } from "../prisma/prisma.service";
import { google } from "googleapis";

jest.mock("googleapis");

describe("GmailService - Coverage Improvements", () => {
  let service: GmailService;
  let mockGmailClient: any;
  let mockPrismaService: any;

  beforeEach(async () => {
    // Mock the Gmail client
    mockGmailClient = {
      users: {
        getProfile: jest.fn(),
        messages: {
          list: jest.fn(),
          get: jest.fn(),
          send: jest.fn(),
          trash: jest.fn(),
          untrash: jest.fn(),
          modify: jest.fn(),
          attachments: {
            get: jest.fn(),
          },
        },
        drafts: {
          create: jest.fn(),
          update: jest.fn(),
          send: jest.fn(),
          list: jest.fn(),
          get: jest.fn(),
          delete: jest.fn(),
        },
        watch: jest.fn(),
        stop: jest.fn(),
        history: {
          list: jest.fn(),
        },
      },
    };

    // Mock the google.auth.OAuth2
    const mockOAuth2Client = {
      setCredentials: jest.fn(),
    };

    (google.auth as any).OAuth2 = jest.fn().mockImplementation(() => mockOAuth2Client);
    (google.gmail as any) = jest.fn().mockReturnValue(mockGmailClient);

    // Mock PrismaService
    mockPrismaService = {
      email: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
  });

  describe("getProfile", () => {
    it("should get user's Gmail profile", async () => {
      const mockAccessToken = "test-access-token";
      const mockProfile = {
        emailAddress: "user@example.com",
        messagesTotal: 1000,
        threadsTotal: 500,
        historyId: "12345",
      };

      mockGmailClient.users.getProfile.mockResolvedValue({
        data: mockProfile,
      });

      const result = await service.getProfile(mockAccessToken);

      expect(mockGmailClient.users.getProfile).toHaveBeenCalledWith({
        userId: "me",
      });
      expect(result).toEqual(mockProfile);
    });

    it("should handle getProfile errors", async () => {
      const mockAccessToken = "test-access-token";
      const mockError = new Error("Failed to get profile");

      mockGmailClient.users.getProfile.mockRejectedValue(mockError);

      await expect(service.getProfile(mockAccessToken)).rejects.toThrow(
        "Failed to get profile",
      );
    });
  });

  describe("markAsRead", () => {
    it("should mark message as read", async () => {
      const mockAccessToken = "test-access-token";
      const mockMessageId = "msg-123";

      mockGmailClient.users.messages.modify.mockResolvedValue({
        data: { id: mockMessageId },
      });

      await service.markAsRead(mockAccessToken, mockMessageId, true);

      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: mockMessageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
          addLabelIds: [],
        },
      });
    });

    it("should mark message as unread", async () => {
      const mockAccessToken = "test-access-token";
      const mockMessageId = "msg-123";

      mockGmailClient.users.messages.modify.mockResolvedValue({
        data: { id: mockMessageId },
      });

      await service.markAsRead(mockAccessToken, mockMessageId, false);

      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: mockMessageId,
        requestBody: {
          removeLabelIds: [],
          addLabelIds: ["UNREAD"],
        },
      });
    });

    it("should use default parameter value (true) when not specified", async () => {
      const mockAccessToken = "test-access-token";
      const mockMessageId = "msg-123";

      mockGmailClient.users.messages.modify.mockResolvedValue({
        data: { id: mockMessageId },
      });

      await service.markAsRead(mockAccessToken, mockMessageId);

      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: mockMessageId,
        requestBody: {
          removeLabelIds: ["UNREAD"],
          addLabelIds: [],
        },
      });
    });
  });
});