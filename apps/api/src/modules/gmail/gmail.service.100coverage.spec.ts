import { Test, TestingModule } from "@nestjs/testing";
import { GmailService } from "./gmail.service";
import { PrismaService } from "../prisma/prisma.service";
import { google } from "googleapis";

jest.mock("googleapis");

describe("GmailService - 100% Coverage", () => {
  let service: GmailService;
  let _prismaService: PrismaService;

  const mockGmailClient = {
    users: {
      getProfile: jest.fn(),
      messages: {
        list: jest.fn(),
        get: jest.fn(),
        send: jest.fn(),
        modify: jest.fn(),
        trash: jest.fn(),
        attachments: {
          get: jest.fn(),
        },
      },
      drafts: {
        create: jest.fn(),
      },
      threads: {
        list: jest.fn(),
        get: jest.fn(),
      },
      history: {
        list: jest.fn(),
      },
      labels: {
        list: jest.fn(),
      },
    },
  };

  const mockOAuth2Client = {
    setCredentials: jest.fn(),
    refreshAccessToken: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Set up environment variables for the constructor
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/callback";

    (google.auth.OAuth2 as jest.Mock).mockImplementation(
      () => mockOAuth2Client,
    );
    (google.gmail as jest.Mock).mockReturnValue(mockGmailClient);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<GmailService>(GmailService);
    _prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("getGmailClient - lines 23-32", () => {
    it("should create and return gmail client", async () => {
      const accessToken = "test-access-token";

      const client = await service.getGmailClient(accessToken);

      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        "test-client-id",
        "test-client-secret",
        "http://localhost:3000/callback",
      );
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: accessToken,
      });
      expect(google.gmail).toHaveBeenCalledWith({
        version: "v1",
        auth: mockOAuth2Client,
      });
      expect(client).toBe(mockGmailClient);
    });

    it("should use default redirect URI when not set", async () => {
      delete process.env.GOOGLE_REDIRECT_URI;
      const accessToken = "test-access-token";

      const client = await service.getGmailClient(accessToken);

      expect(google.auth.OAuth2).toHaveBeenCalledWith(
        "test-client-id",
        "test-client-secret",
        "http://localhost:3001/auth/google/callback",
      );
      expect(client).toBe(mockGmailClient);
    });
  });

  describe("createDraft - lines 158-186", () => {
    it("should create draft with string recipient", async () => {
      const accessToken = "test-token";
      const to = "recipient@example.com";
      const subject = "Test Subject";
      const body = "<p>Test Body</p>";

      mockGmailClient.users.drafts.create.mockResolvedValue({
        data: {
          id: "draft-123",
          message: { id: "msg-123", threadId: "thread-123" },
        },
      });

      const result = await service.createDraft(accessToken, to, subject, body);

      expect(result).toEqual({
        id: "draft-123",
        message: { id: "msg-123", threadId: "thread-123" },
      });

      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      expect(createCall.userId).toBe("me");
      expect(createCall.requestBody.message.raw).toBeDefined();

      // Verify email encoding
      const raw = createCall.requestBody.message.raw;
      expect(raw).not.toContain("+");
      expect(raw).not.toContain("/");
      expect(raw).not.toContain("=");

      // Decode and verify content
      const decodedEmail = Buffer.from(
        raw.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8");
      expect(decodedEmail).toContain(`To: ${to}`);
      expect(decodedEmail).toContain(`Subject: ${subject}`);
      expect(decodedEmail).toContain(body);
    });

    it("should create draft with array of recipients", async () => {
      const accessToken = "test-token";
      const to = [
        "recipient1@example.com",
        "recipient2@example.com",
        "recipient3@example.com",
      ];
      const subject = "Multi-recipient Subject";
      const body = "<h1>HTML Content</h1><p>With multiple recipients</p>";

      mockGmailClient.users.drafts.create.mockResolvedValue({
        data: {
          id: "draft-456",
          message: { id: "msg-456" },
        },
      });

      const result = await service.createDraft(accessToken, to, subject, body);

      expect(result.id).toBe("draft-456");

      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      const raw = createCall.requestBody.message.raw;
      const decodedEmail = Buffer.from(
        raw.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8");

      expect(decodedEmail).toContain(
        "To: recipient1@example.com,recipient2@example.com,recipient3@example.com",
      );
      expect(decodedEmail).toContain("MIME-Version: 1.0");
      expect(decodedEmail).toContain(
        'Content-Type: text/html; charset="UTF-8"',
      );
    });
  });

  describe("listThreads - lines 191-205", () => {
    it("should list threads with all parameters", async () => {
      const accessToken = "test-token";
      const query = "is:unread in:inbox";
      const pageToken = "next-page-token";
      const maxResults = 100;

      mockGmailClient.users.threads.list.mockResolvedValue({
        data: {
          threads: [
            { id: "thread-1", snippet: "Thread 1" },
            { id: "thread-2", snippet: "Thread 2" },
          ],
          nextPageToken: "another-page-token",
          resultSizeEstimate: 200,
        },
      });

      const result = await service.listThreads(
        accessToken,
        query,
        pageToken,
        maxResults,
      );

      expect(result).toEqual({
        threads: [
          { id: "thread-1", snippet: "Thread 1" },
          { id: "thread-2", snippet: "Thread 2" },
        ],
        nextPageToken: "another-page-token",
        resultSizeEstimate: 200,
      });

      expect(mockGmailClient.users.threads.list).toHaveBeenCalledWith({
        userId: "me",
        q: query,
        pageToken,
        maxResults,
      });
    });

    it("should list threads with default parameters", async () => {
      const accessToken = "test-token";

      mockGmailClient.users.threads.list.mockResolvedValue({
        data: {
          threads: [],
          resultSizeEstimate: 0,
        },
      });

      const result = await service.listThreads(accessToken);

      expect(mockGmailClient.users.threads.list).toHaveBeenCalledWith({
        userId: "me",
        q: undefined,
        pageToken: undefined,
        maxResults: 20,
      });
      expect(result.threads).toEqual([]);
    });

    it("should list threads with only query parameter", async () => {
      const accessToken = "test-token";
      const query = "from:important@example.com";

      mockGmailClient.users.threads.list.mockResolvedValue({
        data: {
          threads: [{ id: "thread-important" }],
        },
      });

      await service.listThreads(accessToken, query);

      expect(mockGmailClient.users.threads.list).toHaveBeenCalledWith({
        userId: "me",
        q: query,
        pageToken: undefined,
        maxResults: 20,
      });
    });
  });

  describe("getThread - lines 210-218", () => {
    it("should get thread with full format", async () => {
      const accessToken = "test-token";
      const threadId = "thread-123";

      mockGmailClient.users.threads.get.mockResolvedValue({
        data: {
          id: threadId,
          historyId: "12345",
          messages: [
            {
              id: "msg-1",
              threadId: threadId,
              labelIds: ["INBOX"],
              snippet: "First message",
            },
            {
              id: "msg-2",
              threadId: threadId,
              labelIds: ["INBOX", "UNREAD"],
              snippet: "Second message",
            },
          ],
        },
      });

      const result = await service.getThread(accessToken, threadId);

      expect(result).toEqual({
        id: threadId,
        historyId: "12345",
        messages: [
          {
            id: "msg-1",
            threadId: threadId,
            labelIds: ["INBOX"],
            snippet: "First message",
          },
          {
            id: "msg-2",
            threadId: threadId,
            labelIds: ["INBOX", "UNREAD"],
            snippet: "Second message",
          },
        ],
      });

      expect(mockGmailClient.users.threads.get).toHaveBeenCalledWith({
        userId: "me",
        id: threadId,
        format: "full",
      });
    });
  });

  describe("modifyLabels - lines 245-253", () => {
    it("should add and remove labels", async () => {
      const accessToken = "test-token";
      const messageId = "msg-123";
      const addLabelIds = ["IMPORTANT", "STARRED"];
      const removeLabelIds = ["SPAM", "TRASH"];

      mockGmailClient.users.messages.modify.mockResolvedValue({
        data: {
          id: messageId,
          labelIds: ["INBOX", "IMPORTANT", "STARRED"],
        },
      });

      const result = await service.modifyLabels(
        accessToken,
        messageId,
        addLabelIds,
        removeLabelIds,
      );

      expect(result.id).toBe(messageId);
      expect(result.labelIds).toContain("IMPORTANT");
      expect(result.labelIds).toContain("STARRED");

      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds,
          removeLabelIds,
        },
      });
    });
  });

  describe("archiveMessage - lines 257-258", () => {
    it("should archive message by removing INBOX label", async () => {
      const accessToken = "test-token";
      const messageId = "msg-archive";

      mockGmailClient.users.messages.modify.mockResolvedValue({
        data: {
          id: messageId,
          labelIds: ["SENT"],
        },
      });

      const result = await service.archiveMessage(accessToken, messageId);

      expect(result.id).toBe(messageId);
      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: messageId,
        requestBody: {
          addLabelIds: [],
          removeLabelIds: ["INBOX"],
        },
      });
    });
  });

  describe("trashMessage - lines 263-269", () => {
    it("should move message to trash", async () => {
      const accessToken = "test-token";
      const messageId = "msg-trash";

      mockGmailClient.users.messages.trash.mockResolvedValue({
        data: {
          id: messageId,
          labelIds: ["TRASH"],
        },
      });

      const result = await service.trashMessage(accessToken, messageId);

      expect(result).toEqual({
        id: messageId,
        labelIds: ["TRASH"],
      });

      expect(mockGmailClient.users.messages.trash).toHaveBeenCalledWith({
        userId: "me",
        id: messageId,
      });
    });
  });

  describe("refreshAccessToken - lines 324-326", () => {
    it("should refresh access token successfully", async () => {
      const refreshToken = "refresh-token-123";
      const newAccessToken = "new-access-token-456";

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          access_token: newAccessToken,
          token_type: "Bearer",
          expires_in: 3599,
          refresh_token: refreshToken,
        },
      });

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toBe(newAccessToken);
      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        refresh_token: refreshToken,
      });
      expect(mockOAuth2Client.refreshAccessToken).toHaveBeenCalled();
    });

    it("should return empty string when access_token is missing", async () => {
      const refreshToken = "refresh-token-789";

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({
        credentials: {
          token_type: "Bearer",
          expires_in: 3599,
          refresh_token: refreshToken,
        },
      });

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toBe("");
    });

    it("should handle optional chaining for credentials", async () => {
      const refreshToken = "refresh-token-000";

      mockOAuth2Client.refreshAccessToken.mockResolvedValue({});

      const result = await service.refreshAccessToken(refreshToken);

      expect(result).toBe("");
    });
  });

  describe("Edge cases and error scenarios", () => {
    it("should handle special characters in email draft", async () => {
      const accessToken = "test-token";
      const to = "test+special@example.com";
      const subject = "Subject with = and + and / characters";
      const body = '<p>Body with special chars: = + / & < > "</p>';

      mockGmailClient.users.drafts.create.mockResolvedValue({
        data: { id: "draft-special" },
      });

      await service.createDraft(accessToken, to, subject, body);

      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      const raw = createCall.requestBody.message.raw;

      // Base64 URL-safe encoding should not contain these characters
      expect(raw).not.toMatch(/[+/=]/);
    });

    it("should handle empty recipient array", async () => {
      const accessToken = "test-token";
      const to: string[] = [];
      const subject = "No recipients";
      const body = "Test";

      mockGmailClient.users.drafts.create.mockResolvedValue({
        data: { id: "draft-empty" },
      });

      await service.createDraft(accessToken, to, subject, body);

      const createCall = mockGmailClient.users.drafts.create.mock.calls[0][0];
      const raw = createCall.requestBody.message.raw;
      const decodedEmail = Buffer.from(
        raw.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8");

      expect(decodedEmail).toContain("To: ");
    });
  });
});
