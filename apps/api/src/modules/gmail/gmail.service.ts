import { Injectable, Logger } from "@nestjs/common";
import { google, gmail_v1 } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class GmailService {
  private readonly logger = new Logger(GmailService.name);
  private oauth2Client: OAuth2Client;

  constructor(private prisma: PrismaService) {
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI ||
        "http://localhost:3001/auth/google/callback",
    );
  }

  /**
   * Get Gmail client for a user
   */
  async getGmailClient(accessToken: string): Promise<gmail_v1.Gmail> {
    this.oauth2Client.setCredentials({ access_token: accessToken });
    return google.gmail({ version: "v1", auth: this.oauth2Client });
  }

  /**
   * Get user's Gmail profile
   */
  async getProfile(accessToken: string) {
    const gmail = await this.getGmailClient(accessToken);
    const profile = await gmail.users.getProfile({ userId: "me" });
    return profile.data;
  }

  /**
   * List messages
   */
  async listMessages(
    accessToken: string,
    query?: string,
    pageToken?: string,
    maxResults = 20,
  ) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      pageToken,
      maxResults,
    });
    return response.data;
  }

  /**
   * Get a single message
   */
  async getMessage(accessToken: string, messageId: string) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });
    return response.data;
  }

  /**
   * Get message attachments
   */
  async getAttachment(
    accessToken: string,
    messageId: string,
    attachmentId: string,
  ) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId,
      id: attachmentId,
    });
    return response.data;
  }

  /**
   * Send an email
   */
  async sendEmail(
    accessToken: string,
    to: string | string[],
    subject: string,
    body: string,
    options?: {
      cc?: string | string[];
      bcc?: string | string[];
      replyTo?: string;
      attachments?: Array<{
        filename: string;
        mimeType: string;
        data: string; // base64
      }>;
    },
  ) {
    const gmail = await this.getGmailClient(accessToken);

    // Build email
    const toAddresses = Array.isArray(to) ? to.join(",") : to;
    const ccAddresses = options?.cc
      ? Array.isArray(options.cc)
        ? options.cc.join(",")
        : options.cc
      : "";
    const bccAddresses = options?.bcc
      ? Array.isArray(options.bcc)
        ? options.bcc.join(",")
        : options.bcc
      : "";

    const email = [
      `To: ${toAddresses}`,
      ...(ccAddresses ? [`Cc: ${ccAddresses}`] : []),
      ...(bccAddresses ? [`Bcc: ${bccAddresses}`] : []),
      ...(options?.replyTo ? [`Reply-To: ${options.replyTo}`] : []),
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      body,
    ].join("\n");

    // Convert to base64
    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.messages.send({
      userId: "me",
      requestBody: {
        raw: encodedEmail,
      },
    });

    return response.data;
  }

  /**
   * Create a draft
   */
  async createDraft(
    accessToken: string,
    to: string | string[],
    subject: string,
    body: string,
  ) {
    const gmail = await this.getGmailClient(accessToken);

    const toAddresses = Array.isArray(to) ? to.join(",") : to;
    const email = [
      `To: ${toAddresses}`,
      `Subject: ${subject}`,
      "MIME-Version: 1.0",
      'Content-Type: text/html; charset="UTF-8"',
      "",
      body,
    ].join("\n");

    const encodedEmail = Buffer.from(email)
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const response = await gmail.users.drafts.create({
      userId: "me",
      requestBody: {
        message: {
          raw: encodedEmail,
        },
      },
    });

    return response.data;
  }

  /**
   * Get threads
   */
  async listThreads(
    accessToken: string,
    query?: string,
    pageToken?: string,
    maxResults = 20,
  ) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.threads.list({
      userId: "me",
      q: query,
      pageToken,
      maxResults,
    });
    return response.data;
  }

  /**
   * Get a single thread
   */
  async getThread(accessToken: string, threadId: string) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.threads.get({
      userId: "me",
      id: threadId,
      format: "full",
    });
    return response.data;
  }

  /**
   * Modify message labels
   */
  async modifyLabels(
    accessToken: string,
    messageId: string,
    addLabelIds?: string[],
    removeLabelIds?: string[],
  ) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.messages.modify({
      userId: "me",
      id: messageId,
      requestBody: {
        addLabelIds,
        removeLabelIds,
      },
    });
    return response.data;
  }

  /**
   * Mark as read/unread
   */
  async markAsRead(accessToken: string, messageId: string, isRead = true) {
    return this.modifyLabels(
      accessToken,
      messageId,
      isRead ? [] : ["UNREAD"],
      isRead ? ["UNREAD"] : [],
    );
  }

  /**
   * Archive message
   */
  async archiveMessage(accessToken: string, messageId: string) {
    return this.modifyLabels(accessToken, messageId, [], ["INBOX"]);
  }

  /**
   * Trash message
   */
  async trashMessage(accessToken: string, messageId: string) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.messages.trash({
      userId: "me",
      id: messageId,
    });
    return response.data;
  }

  /**
   * Get history of changes
   */
  async getHistory(
    accessToken: string,
    startHistoryId: string,
    historyTypes?: Array<
      "messageAdded" | "messageDeleted" | "labelAdded" | "labelRemoved"
    >,
    pageToken?: string,
  ) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.history.list({
      userId: "me",
      startHistoryId,
      historyTypes,
      pageToken,
    });
    return response.data;
  }

  /**
   * Set up Gmail push notifications
   */
  async watchGmail(accessToken: string, topicName: string) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.watch({
      userId: "me",
      requestBody: {
        topicName,
        labelIds: ["INBOX", "SENT"],
        labelFilterAction: "include",
      },
    });
    return response.data;
  }

  /**
   * Stop Gmail push notifications
   */
  async stopWatch(accessToken: string) {
    const gmail = await this.getGmailClient(accessToken);
    const response = await gmail.users.stop({
      userId: "me",
    });
    return response.data;
  }

  /**
   * Refresh access token
   */
  async refreshAccessToken(refreshToken: string): Promise<string> {
    this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    const { credentials } = await this.oauth2Client.refreshAccessToken();
    return credentials.access_token || "";
  }
}
