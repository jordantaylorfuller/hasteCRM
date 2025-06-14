import { Test, TestingModule } from "@nestjs/testing";
import { GmailWebhookController } from "./gmail-webhook.controller";
import { GmailWebhookService } from "./gmail-webhook.service";
import { BadRequestException, Logger } from "@nestjs/common";

describe("GmailWebhookController", () => {
  let controller: GmailWebhookController;
  let webhookService: GmailWebhookService;
  let logger: Logger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GmailWebhookController],
      providers: [
        {
          provide: GmailWebhookService,
          useValue: {
            processNotification: jest.fn().mockReturnValue(Promise.resolve()),
          },
        },
      ],
    }).compile();

    controller = module.get<GmailWebhookController>(GmailWebhookController);
    webhookService = module.get<GmailWebhookService>(GmailWebhookService);

    // Mock logger
    logger = controller["logger"];
    logger.log = jest.fn();
    logger.error = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("handleGmailWebhook", () => {
    it("should process valid Pub/Sub message", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
              historyId: "12345",
            }),
          ).toString("base64"),
          messageId: "msg-123",
          publishTime: new Date().toISOString(),
        },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      expect(result).toEqual({ status: "ok" });
      expect(logger.log).toHaveBeenCalledWith(
        "Received Gmail webhook",
        expect.objectContaining({
          messageId: "msg-123",
        }),
      );

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(webhookService.processNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAddress: "test@example.com",
          historyId: "12345",
          messageId: "msg-123",
        }),
      );
    });

    it("should handle missing message data", async () => {
      const pubsubMessage = {
        message: {},
      };

      await expect(
        controller.handleGmailWebhook(pubsubMessage, {}),
      ).rejects.toThrow("Invalid Pub/Sub message");
      expect(webhookService.processNotification).not.toHaveBeenCalled();
    });

    it("should handle invalid base64 data", async () => {
      const pubsubMessage = {
        message: {
          data: "invalid-base64!!!",
          messageId: "msg-invalid",
        },
      };

      await expect(
        controller.handleGmailWebhook(pubsubMessage, {}),
      ).rejects.toThrow("Invalid Pub/Sub message");
    });

    it("should handle invalid JSON in message", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from("invalid json").toString("base64"),
          messageId: "msg-json-error",
        },
      };

      await expect(
        controller.handleGmailWebhook(pubsubMessage, {}),
      ).rejects.toThrow("Invalid Pub/Sub message");
    });

    it("should handle webhook service errors gracefully", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
              historyId: "12345",
            }),
          ).toString("base64"),
          messageId: "msg-123",
        },
      };

      (webhookService.processNotification as jest.Mock).mockRejectedValue(
        new Error("Processing failed"),
      );

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      expect(result).toEqual({ status: "ok" });

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // The error should be logged but not thrown
      expect(webhookService.processNotification).toHaveBeenCalled();
    });

    it("should acknowledge message even on processing failure", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
              historyId: "12345",
            }),
          ).toString("base64"),
          messageId: "msg-ack",
        },
      };

      (webhookService.processNotification as jest.Mock).mockRejectedValue(
        new Error("Processing failed"),
      );

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      expect(result).toEqual({ status: "ok" });

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));
    });

    it("should handle missing email address in notification", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              historyId: "12345",
            }),
          ).toString("base64"),
          messageId: "msg-incomplete",
        },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      // Should still return ok even with incomplete data
      expect(result).toEqual({ status: "ok" });

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Process notification should still be called with incomplete data
      expect(webhookService.processNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAddress: undefined,
          historyId: "12345",
        }),
      );
    });

    it("should handle missing history ID in notification", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
            }),
          ).toString("base64"),
          messageId: "msg-123",
        },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      // Should still return ok even with incomplete data
      expect(result).toEqual({ status: "ok" });

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      // Process notification should still be called with incomplete data
      expect(webhookService.processNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          emailAddress: "test@example.com",
          historyId: undefined,
        }),
      );
    });

    it("should log message metadata", async () => {
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
              historyId: "12345",
            }),
          ).toString("base64"),
          messageId: "msg-123",
          publishTime: "2024-01-01T00:00:00Z",
          attributes: {
            source: "gmail",
            priority: "high",
          },
        },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      await controller.handleGmailWebhook(pubsubMessage, {});

      expect(logger.log).toHaveBeenCalledWith(
        "Received Gmail webhook",
        expect.objectContaining({
          subscription: "projects/test/subscriptions/gmail-push",
          messageId: "msg-123",
        }),
      );
    });
  });

  describe("edge cases", () => {
    it("should handle empty request body", async () => {
      await expect(
        controller.handleGmailWebhook({} as any, {}),
      ).rejects.toThrow("Invalid Pub/Sub message");
    });

    it("should handle null message data", async () => {
      const pubsubMessage = {
        message: {
          data: null,
          messageId: "msg-null",
        },
      };

      await expect(
        controller.handleGmailWebhook(pubsubMessage, {}),
      ).rejects.toThrow("Invalid Pub/Sub message");
    });

    it("should handle very large history IDs", async () => {
      const largeHistoryId = "9".repeat(100);
      const pubsubMessage = {
        message: {
          data: Buffer.from(
            JSON.stringify({
              emailAddress: "test@example.com",
              historyId: largeHistoryId,
            }),
          ).toString("base64"),
          messageId: "msg-123",
        },
        subscription: "projects/test/subscriptions/gmail-push",
      };

      const result = await controller.handleGmailWebhook(pubsubMessage, {});

      expect(result).toEqual({ status: "ok" });

      // Wait for async processing
      await new Promise((resolve) => setImmediate(resolve));

      expect(webhookService.processNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          historyId: largeHistoryId,
        }),
      );
    });
  });
});
