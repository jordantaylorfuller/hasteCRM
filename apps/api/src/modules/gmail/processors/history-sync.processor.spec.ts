import { Test, TestingModule } from "@nestjs/testing";
import { HistorySyncProcessor } from "./history-sync.processor";
import { GmailHistoryService } from "../gmail-history.service";
import { EmailAccountService } from "../email-account.service";
import { Job } from "bullmq";

describe("HistorySyncProcessor", () => {
  let processor: HistorySyncProcessor;
  let gmailHistoryService: GmailHistoryService;
  let emailAccountService: EmailAccountService;

  const mockGmailHistoryService = {
    syncHistory: jest.fn(),
  };

  const mockEmailAccountService = {
    recordSyncError: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistorySyncProcessor,
        {
          provide: GmailHistoryService,
          useValue: mockGmailHistoryService,
        },
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
      ],
    }).compile();

    processor = module.get<HistorySyncProcessor>(HistorySyncProcessor);
    gmailHistoryService = module.get<GmailHistoryService>(GmailHistoryService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("process", () => {
    it("should process sync-history job", async () => {
      const mockJob: Partial<Job> = {
        name: "sync-history",
        data: {
          accountId: "account-123",
          trigger: "webhook",
        },
      };

      const mockResults = {
        messagesAdded: 10,
        messagesDeleted: 2,
        labelsChanged: 5,
        newHistoryId: "new-history-123",
      };

      mockGmailHistoryService.syncHistory.mockResolvedValue(mockResults);

      const result = await processor.process(mockJob as Job);

      expect(gmailHistoryService.syncHistory).toHaveBeenCalledWith(
        "account-123",
        undefined,
      );
      expect(result).toEqual(mockResults);
    });

    it("should handle unknown job names", async () => {
      const mockJob: Partial<Job> = {
        name: "unknown-job",
        data: {},
      };

      const result = await processor.process(mockJob as Job);

      expect(result).toBeUndefined();
      expect(gmailHistoryService.syncHistory).not.toHaveBeenCalled();
    });
  });

  describe("processHistorySync", () => {
    it("should process history sync successfully", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          startHistoryId: "start-history-456",
          trigger: "manual",
        },
      };

      const mockResults = {
        messagesAdded: 15,
        messagesDeleted: 3,
        labelsChanged: 8,
        newHistoryId: "new-history-789",
      };

      mockGmailHistoryService.syncHistory.mockResolvedValue(mockResults);

      const result = await processor.processHistorySync(mockJob as Job);

      expect(gmailHistoryService.syncHistory).toHaveBeenCalledWith(
        "account-123",
        "start-history-456",
      );
      expect(result).toEqual(mockResults);
    });

    it("should handle sync errors", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          trigger: "scheduled",
        },
      };

      const error = new Error("Sync failed");
      mockGmailHistoryService.syncHistory.mockRejectedValue(error);

      await expect(
        processor.processHistorySync(mockJob as Job),
      ).rejects.toThrow("Sync failed");

      expect(emailAccountService.recordSyncError).toHaveBeenCalledWith(
        "account-123",
        "Sync failed",
      );
    });

    it("should handle errors without message", async () => {
      const mockJob: Partial<Job> = {
        data: {
          accountId: "account-123",
          trigger: "webhook",
        },
      };

      const error = { code: 500 };
      mockGmailHistoryService.syncHistory.mockRejectedValue(error);

      await expect(
        processor.processHistorySync(mockJob as Job),
      ).rejects.toEqual(error);

      expect(emailAccountService.recordSyncError).toHaveBeenCalledWith(
        "account-123",
        "History sync failed",
      );
    });
  });
});
