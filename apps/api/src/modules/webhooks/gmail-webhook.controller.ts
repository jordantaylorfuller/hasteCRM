import {
  Controller,
  Post,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiExcludeEndpoint } from "@nestjs/swagger";
import { GmailWebhookService } from "./gmail-webhook.service";
import { PubSubAuthGuard } from "./guards/pubsub-auth.guard";

interface PubSubMessage {
  message: {
    data: string;
    messageId?: string;
    message_id?: string;
    publishTime?: string;
    publish_time?: string;
    attributes?: Record<string, string>;
  };
  subscription: string;
}

interface GmailPushNotification {
  emailAddress: string;
  historyId: string;
  messageId: string;
  publishTime: string;
  attributes: Record<string, string>;
}

@ApiTags("webhooks")
@Controller("webhooks")
export class GmailWebhookController {
  private readonly logger = new Logger(GmailWebhookController.name);

  constructor(private gmailWebhookService: GmailWebhookService) {}

  @Post("gmail")
  @HttpCode(HttpStatus.OK)
  @UseGuards(PubSubAuthGuard)
  @ApiExcludeEndpoint() // Hide from public API docs
  async handleGmailWebhook(
    @Body() body: PubSubMessage,
    @Headers() _headers: Record<string, string>,
  ) {
    this.logger.log("Received Gmail webhook", {
      subscription: body.subscription,
      messageId: body.message?.messageId || body.message?.message_id,
    });

    // Parse Pub/Sub message
    const message = this.parsePubSubMessage(body);
    if (!message) {
      throw new BadRequestException("Invalid Pub/Sub message");
    }

    // Process asynchronously
    setImmediate(() => {
      this.gmailWebhookService.processNotification(message).catch((error) => {
        this.logger.error("Failed to process Gmail notification:", error);
      });
    });

    // Acknowledge immediately
    return { status: "ok" };
  }

  private parsePubSubMessage(
    body: PubSubMessage,
  ): GmailPushNotification | null {
    try {
      const { message } = body;
      if (!message || !message.data) {
        return null;
      }

      // Decode base64 data
      const decodedData = Buffer.from(message.data, "base64").toString("utf-8");
      const data = JSON.parse(decodedData);

      return {
        emailAddress: data.emailAddress,
        historyId: data.historyId,
        messageId: message.messageId || message.message_id || "",
        publishTime:
          message.publishTime ||
          message.publish_time ||
          new Date().toISOString(),
        attributes: message.attributes || {},
      };
    } catch (error) {
      this.logger.error("Failed to parse Pub/Sub message:", error);
      return null;
    }
  }
}
