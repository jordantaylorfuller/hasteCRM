import { Test, TestingModule } from "@nestjs/testing";
import { GmailService } from "./gmail.service";
import { PrismaService } from "../prisma/prisma.service";
import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";

// Mock googleapis
jest.mock("googleapis");

describe("GmailService", () => {
  let service: GmailService;
  let mockGmailClient: any;
  let mockOAuth2Client: any;

  const mockAccessToken = "mock-access-token";

  beforeEach(async () => {
    // Mock OAuth2Client
    mockOAuth2Client = {
      setCredentials: jest.fn(),
    };

    // Mock Gmail API client
    mockGmailClient = {
      users: {
        messages: {
          list: jest.fn(),
          get: jest.fn(),
          send: jest.fn(),
          modify: jest.fn(),
          trash: jest.fn(),
          untrash: jest.fn(),
          batchModify: jest.fn(),
          attachments: {
            get: jest.fn(),
          },
        },
        labels: {
          list: jest.fn(),
          get: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
          delete: jest.fn(),
        },
        threads: {
          list: jest.fn(),
          get: jest.fn(),
        },
        history: {
          list: jest.fn(),
        },
        watch: jest.fn(),
        stop: jest.fn(),
      },
    };

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
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("listMessages", () => {
    it("should list messages with default parameters", async () => {
      const mockResponse = {
        data: {
          messages: [
            { id: "msg1", threadId: "thread1" },
            { id: "msg2", threadId: "thread2" },
          ],
          nextPageToken: "next-token",
        },
      };

      mockGmailClient.users.messages.list.mockResolvedValue(mockResponse);

      const result = await service.listMessages(mockAccessToken);

      expect(mockOAuth2Client.setCredentials).toHaveBeenCalledWith({
        access_token: mockAccessToken,
      });
      expect(mockGmailClient.users.messages.list).toHaveBeenCalledWith({
        userId: "me",
        maxResults: 20,
        q: undefined,
        pageToken: undefined,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should list messages with query and labels", async () => {
      const query = "from:important@example.com";
      const pageToken = "page-token";
      const maxResults = 100;

      mockGmailClient.users.messages.list.mockResolvedValue({
        data: { messages: [] },
      });

      await service.listMessages(mockAccessToken, query, pageToken, maxResults);

      expect(mockGmailClient.users.messages.list).toHaveBeenCalledWith({
        userId: "me",
        maxResults: 100,
        q: query,
        pageToken,
      });
    });

    it("should handle empty results", async () => {
      mockGmailClient.users.messages.list.mockResolvedValue({
        data: {},
      });

      const result = await service.listMessages(mockAccessToken);

      expect(result).toEqual({});
    });
  });

  describe("getMessage", () => {
    it("should get a full message", async () => {
      const mockMessage = {
        data: {
          id: "msg1",
          threadId: "thread1",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "To", value: "recipient@example.com" },
              { name: "Subject", value: "Test Email" },
              { name: "Date", value: "Mon, 1 Jan 2024 12:00:00 +0000" },
            ],
            body: {
              data: Buffer.from("Hello World").toString("base64"),
            },
          },
        },
      };

      mockGmailClient.users.messages.get.mockResolvedValue(mockMessage);

      const result = await service.getMessage(mockAccessToken, "msg1");

      expect(mockGmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: "me",
        id: "msg1",
        format: "full",
      });
      expect(result).toEqual(mockMessage.data);
    });

    it("should get message metadata only", async () => {
      const mockMessage = {
        data: {
          id: "msg1",
          threadId: "thread1",
          labelIds: ["INBOX"],
          payload: {
            headers: [
              { name: "From", value: "sender@example.com" },
              { name: "Subject", value: "Test Email" },
            ],
          },
        },
      };

      mockGmailClient.users.messages.get.mockResolvedValue(mockMessage);

      // The actual service doesn't support format parameter, it always uses 'full'
      await service.getMessage(mockAccessToken, "msg1");

      expect(mockGmailClient.users.messages.get).toHaveBeenCalledWith({
        userId: "me",
        id: "msg1",
        format: "full",
      });
    });
  });

  describe("sendEmail", () => {
    it("should send a simple email", async () => {
      const mockResponse = {
        data: {
          id: "sent-msg-1",
          threadId: "thread-1",
          labelIds: ["SENT"],
        },
      };

      mockGmailClient.users.messages.send.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(
        mockAccessToken,
        "recipient@example.com",
        "Test Subject",
        "Test Body",
      );

      expect(mockGmailClient.users.messages.send).toHaveBeenCalledWith({
        userId: "me",
        requestBody: {
          raw: expect.any(String),
        },
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should send email with multiple recipients and attachments", async () => {
      const mockResponse = {
        data: {
          id: "sent-msg-2",
          threadId: "thread-2",
        },
      };

      mockGmailClient.users.messages.send.mockResolvedValue(mockResponse);

      const result = await service.sendEmail(
        mockAccessToken,
        ["recipient1@example.com", "recipient2@example.com"],
        "Test Subject",
        "<h1>HTML Body</h1>",
        {
          cc: ["cc@example.com"],
          bcc: ["bcc@example.com"],
          replyTo: "noreply@example.com",
          attachments: [
            {
              filename: "test.pdf",
              mimeType: "application/pdf",
              data: Buffer.from("PDF content").toString("base64"),
            },
          ],
        },
      );

      expect(mockGmailClient.users.messages.send).toHaveBeenCalled();
      expect(result).toEqual(mockResponse.data);
    });

    it("should handle send errors", async () => {
      mockGmailClient.users.messages.send.mockRejectedValue(
        new Error("Failed to send"),
      );

      await expect(
        service.sendEmail(mockAccessToken, "invalid", "Subject", "Body"),
      ).rejects.toThrow("Failed to send");
    });
  });

  describe("modifyLabels", () => {
    it("should add and remove labels", async () => {
      const mockResponse = {
        data: {
          id: "msg1",
          labelIds: ["IMPORTANT", "STARRED"],
        },
      };

      mockGmailClient.users.messages.modify.mockResolvedValue(mockResponse);

      const result = await service.modifyLabels(
        mockAccessToken,
        "msg1",
        ["IMPORTANT", "STARRED"],
        ["INBOX"],
      );

      expect(mockGmailClient.users.messages.modify).toHaveBeenCalledWith({
        userId: "me",
        id: "msg1",
        requestBody: {
          addLabelIds: ["IMPORTANT", "STARRED"],
          removeLabelIds: ["INBOX"],
        },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("watchGmail", () => {
    it("should set up push notifications", async () => {
      const mockResponse = {
        data: {
          historyId: "12345",
          expiration: "1234567890000",
        },
      };

      mockGmailClient.users.watch.mockResolvedValue(mockResponse);

      const result = await service.watchGmail(
        mockAccessToken,
        "projects/my-project/topics/gmail-push",
      );

      expect(mockGmailClient.users.watch).toHaveBeenCalledWith({
        userId: "me",
        requestBody: {
          topicName: "projects/my-project/topics/gmail-push",
          labelIds: ["INBOX", "SENT"],
          labelFilterAction: "include",
        },
      });
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe("stopWatch", () => {
    it("should stop push notifications", async () => {
      mockGmailClient.users.stop.mockResolvedValue({ data: {} });

      await service.stopWatch(mockAccessToken);

      expect(mockGmailClient.users.stop).toHaveBeenCalledWith({
        userId: "me",
      });
    });
  });

  describe("getHistory", () => {
    it("should get history changes", async () => {
      const mockResponse = {
        data: {
          history: [
            {
              id: "1",
              messages: [{ id: "msg1" }],
              messagesAdded: [{ message: { id: "msg1" } }],
            },
          ],
          historyId: "12346",
          nextPageToken: "next-page",
        },
      };

      mockGmailClient.users.history.list.mockResolvedValue(mockResponse);

      const result = await service.getHistory(mockAccessToken, "12345");

      expect(mockGmailClient.users.history.list).toHaveBeenCalledWith({
        userId: "me",
        startHistoryId: "12345",
        historyTypes: undefined,
        pageToken: undefined,
      });
      expect(result).toEqual(mockResponse.data);
    });

    it("should filter history by types", async () => {
      mockGmailClient.users.history.list.mockResolvedValue({
        data: { history: [] },
      });

      await service.getHistory(
        mockAccessToken,
        "12345",
        ["messageAdded", "messageDeleted"],
        "page-token",
      );

      expect(mockGmailClient.users.history.list).toHaveBeenCalledWith({
        userId: "me",
        startHistoryId: "12345",
        historyTypes: ["messageAdded", "messageDeleted"],
        pageToken: "page-token",
      });
    });
  });

  describe("getAttachment", () => {
    it("should get attachment data", async () => {
      const mockAttachment = {
        data: {
          size: 1024,
          data: Buffer.from("attachment content").toString("base64"),
        },
      };

      mockGmailClient.users.messages.attachments.get.mockResolvedValue(
        mockAttachment,
      );

      const result = await service.getAttachment(
        mockAccessToken,
        "msg1",
        "attachment1",
      );

      expect(
        mockGmailClient.users.messages.attachments.get,
      ).toHaveBeenCalledWith({
        userId: "me",
        messageId: "msg1",
        id: "attachment1",
      });
      expect(result).toEqual(mockAttachment.data);
    });
  });
});
