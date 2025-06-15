import { Test, TestingModule } from "@nestjs/testing";
import { MessageFetchProcessor } from "./message-fetch.processor";
import { GmailSyncService } from "../gmail-sync.service";
import { Job } from "bullmq";

describe("MessageFetchProcessor", () => {
  let processor: MessageFetchProcessor;
  let gmailSyncService: GmailSyncService;

  const mockGmailSyncService = {
    fetchAndStoreMessage: jest.fn(),
    downloadAttachment: jest.fn(),
    syncAccount: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MessageFetchProcessor,
        {
          provide: GmailSyncService,
          useValue: mockGmailSyncService,
        },
      ],
    }).compile();

    processor = module.get<MessageFetchProcessor>(MessageFetchProcessor);
    gmailSyncService = module.get<GmailSyncService>(GmailSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("process", () => {
    it("should process fetch-message job", async () => {
      const mockJob: Partial<Job> = {
        name: "fetch-message",
        data: {
          accountId: "account-123",
          messageId: "msg-123",
          threadId: "thread-123",
        },
      };

      await processor.process(mockJob as Job);

      expect(gmailSyncService.fetchAndStoreMessage).toHaveBeenCalledWith(
        "account-123",
        "msg-123",
        "thread-123",
      );
    });

    it("should process download-attachment job", async () => {
      const mockJob: Partial<Job> = {
        name: "download-attachment",
        data: {
          accountId: "account-123",
          messageId: "msg-123",
          attachmentId: "attach-123",
          filename: "document.pdf",
          mimeType: "application/pdf",
          size: 102400,
        },
      };

      await processor.process(mockJob as Job);

      expect(gmailSyncService.downloadAttachment).toHaveBeenCalledWith(
        "account-123",
        "msg-123",
        "attach-123",
        "document.pdf",
        "application/pdf",
        102400,
      );
    });

    it("should process full-sync job", async () => {
      const mockJob: Partial<Job> = {
        name: "full-sync",
        data: {
          accountId: "account-123",
          maxResults: 500,
        },
      };

      await processor.process(mockJob as Job);

      expect(gmailSyncService.syncAccount).toHaveBeenCalledWith("account-123", {
        fullSync: true,
        source: "job",
      });
    });

    it("should return undefined for unknown job types", async () => {
      const mockJob: Partial<Job> = {
        name: "unknown-job",
        data: {},
      };

      const result = await processor.process(mockJob as Job);

      expect(result).toBeUndefined();
      expect(gmailSyncService.fetchAndStoreMessage).not.toHaveBeenCalled();
    });
  });

  describe("processFetchMessage", () => {
    it("should fetch and store message successfully", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          messageId: "msg-456",
          threadId: "thread-456",
        },
      };

      mockGmailSyncService.fetchAndStoreMessage.mockResolvedValue(undefined);

      await processor.processFetchMessage(mockJob as Job);

      expect(gmailSyncService.fetchAndStoreMessage).toHaveBeenCalledWith(
        "account-123",
        "msg-456",
        "thread-456",
      );
    });

    it("should throw error when fetch fails", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          messageId: "msg-789",
          threadId: "thread-789",
        },
      };

      const error = new Error("Fetch failed");
      mockGmailSyncService.fetchAndStoreMessage.mockRejectedValue(error);

      await expect(
        processor.processFetchMessage(mockJob as Job),
      ).rejects.toThrow("Fetch failed");
    });
  });

  describe("processDownloadAttachment", () => {
    it("should download attachment successfully", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          messageId: "msg-123",
          attachmentId: "attach-456",
          filename: "image.png",
          mimeType: "image/png",
          size: 204800,
        },
      };

      mockGmailSyncService.downloadAttachment.mockResolvedValue(undefined);

      await processor.processDownloadAttachment(mockJob as Job);

      expect(gmailSyncService.downloadAttachment).toHaveBeenCalledWith(
        "account-123",
        "msg-123",
        "attach-456",
        "image.png",
        "image/png",
        204800,
      );
    });

    it("should not throw error when attachment download fails", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          messageId: "msg-123",
          attachmentId: "attach-789",
          filename: "large-file.zip",
          mimeType: "application/zip",
          size: 10485760,
        },
      };

      const error = new Error("Download failed");
      mockGmailSyncService.downloadAttachment.mockRejectedValue(error);

      // Should not throw
      await expect(
        processor.processDownloadAttachment(mockJob as Job),
      ).resolves.not.toThrow();

      expect(gmailSyncService.downloadAttachment).toHaveBeenCalled();
    });
  });

  describe("processFullSync", () => {
    it("should perform full sync successfully", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
        },
      };

      mockGmailSyncService.syncAccount.mockResolvedValue(undefined);

      await processor.processFullSync(mockJob as Job);

      expect(gmailSyncService.syncAccount).toHaveBeenCalledWith("account-123", {
        fullSync: true,
        source: "job",
      });
    });

    it("should throw error when full sync fails", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-456",
        },
      };

      const error = new Error("Full sync failed");
      mockGmailSyncService.syncAccount.mockRejectedValue(error);

      await expect(processor.processFullSync(mockJob as Job)).rejects.toThrow(
        "Full sync failed",
      );
    });
  });
});
