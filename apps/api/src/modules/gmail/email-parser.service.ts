import { Injectable, Logger } from "@nestjs/common";
import { gmail_v1 } from "googleapis";

interface ParsedEmail {
  subject?: string;
  snippet?: string;
  bodyHtml?: string;
  bodyText?: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  toNames: string[];
  ccEmails: string[];
  ccNames: string[];
  bccEmails: string[];
  bccNames: string[];
  sentAt: Date;
  receivedAt: Date;
  gmailLabels: string[];
  isRead: boolean;
  isStarred: boolean;
  isImportant: boolean;
  isDraft: boolean;
  attachments: Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }>;
}

interface EmailAddress {
  email: string;
  name?: string;
}

@Injectable()
export class EmailParserService {
  private readonly logger = new Logger(EmailParserService.name);

  /**
   * Parse Gmail message into our format
   */
  parseGmailMessage(message: gmail_v1.Schema$Message): ParsedEmail {
    const headers = this.parseHeaders(message.payload?.headers || []);
    const labels = message.labelIds || [];

    // Parse body
    const { html, text } = this.parseMessageBody(message.payload);

    // Parse attachments
    const attachments = this.parseAttachments(message.payload);

    // Parse recipients
    const to = this.parseAddresses(headers.to);
    const cc = this.parseAddresses(headers.cc);
    const bcc = this.parseAddresses(headers.bcc);
    const from = this.parseAddresses(headers.from)[0] || {
      email: "unknown@example.com",
    };

    // Parse dates
    const internalDate = message.internalDate
      ? new Date(parseInt(message.internalDate))
      : new Date();

    return {
      subject: headers.subject,
      snippet: message.snippet || undefined,
      bodyHtml: html,
      bodyText: text,
      fromEmail: from.email,
      fromName: from.name,
      toEmails: to.map((a) => a.email),
      toNames: to.map((a) => a.name || ""),
      ccEmails: cc.map((a) => a.email),
      ccNames: cc.map((a) => a.name || ""),
      bccEmails: bcc.map((a) => a.email),
      bccNames: bcc.map((a) => a.name || ""),
      sentAt: internalDate,
      receivedAt: internalDate,
      gmailLabels: labels,
      isRead: !labels.includes("UNREAD"),
      isStarred: labels.includes("STARRED"),
      isImportant: labels.includes("IMPORTANT"),
      isDraft: labels.includes("DRAFT"),
      attachments,
    };
  }

  /**
   * Parse email headers
   */
  private parseHeaders(
    headers: gmail_v1.Schema$MessagePartHeader[],
  ): Record<string, string> {
    const result: Record<string, string> = {};

    headers.forEach((header) => {
      if (header.name && header.value) {
        result[header.name.toLowerCase()] = header.value;
      }
    });

    return result;
  }

  /**
   * Parse message body recursively
   */
  private parseMessageBody(part?: gmail_v1.Schema$MessagePart): {
    html?: string;
    text?: string;
  } {
    if (!part) {
      return {};
    }

    let html: string | undefined;
    let text: string | undefined;

    // Single part message
    if (part.body?.data && part.mimeType) {
      const decoded = this.decodeBase64(part.body.data);

      if (part.mimeType === "text/html") {
        html = decoded;
      } else if (part.mimeType === "text/plain") {
        text = decoded;
      }
    }

    // Multipart message
    if (part.parts) {
      part.parts.forEach((subPart) => {
        const result = this.parseMessageBody(subPart);
        if (result.html) html = result.html;
        if (result.text) text = result.text;
      });
    }

    return { html, text };
  }

  /**
   * Parse attachments
   */
  private parseAttachments(
    part?: gmail_v1.Schema$MessagePart,
    attachments: Array<{
      id: string;
      filename: string;
      mimeType: string;
      size: number;
    }> = [],
  ): Array<{
    id: string;
    filename: string;
    mimeType: string;
    size: number;
  }> {
    if (!part) {
      return attachments;
    }

    // Check if this part is an attachment
    if (part.body?.attachmentId && part.filename && part.mimeType) {
      attachments.push({
        id: part.body.attachmentId,
        filename: part.filename,
        mimeType: part.mimeType,
        size: part.body.size || 0,
      });
    }

    // Recursively check parts
    if (part.parts) {
      part.parts.forEach((subPart) => {
        this.parseAttachments(subPart, attachments);
      });
    }

    return attachments;
  }

  /**
   * Parse email addresses
   */
  private parseAddresses(addressString?: string): EmailAddress[] {
    if (!addressString) {
      return [];
    }

    const addresses: EmailAddress[] = [];
    const regex = /(?:"?([^"]*)"?\s)?<?([\w\-._]+@[\w\-._]+\.\w+)>?/g;
    let match;

    while ((match = regex.exec(addressString)) !== null) {
      addresses.push({
        name: match[1]?.trim(),
        email: match[2].toLowerCase(),
      });
    }

    // Fallback for simple email addresses
    if (addresses.length === 0 && addressString.includes("@")) {
      addresses.push({
        email: addressString.trim().toLowerCase(),
      });
    }

    return addresses;
  }

  /**
   * Decode base64 URL-safe string
   */
  private decodeBase64(data: string): string {
    // Replace URL-safe characters
    const base64 = data.replace(/-/g, "+").replace(/_/g, "/");

    // Add padding if necessary
    const padding = base64.length % 4;
    const paddedBase64 = padding ? base64 + "=".repeat(4 - padding) : base64;

    return Buffer.from(paddedBase64, "base64").toString("utf-8");
  }

  /**
   * Extract email direction based on account email
   */
  extractDirection(
    fromEmail: string,
    accountEmail: string,
  ): "INBOUND" | "OUTBOUND" {
    return fromEmail.toLowerCase() === accountEmail.toLowerCase()
      ? "OUTBOUND"
      : "INBOUND";
  }

  /**
   * Parse thread into individual messages
   */
  parseGmailThread(
    thread: gmail_v1.Schema$Thread,
  ): Array<ParsedEmail & { messageId: string; threadId: string }> {
    const messages: Array<
      ParsedEmail & { messageId: string; threadId: string }
    > = [];

    if (thread.messages) {
      thread.messages.forEach((message) => {
        if (message.id && thread.id) {
          const parsed = this.parseGmailMessage(message);
          messages.push({
            ...parsed,
            messageId: message.id,
            threadId: thread.id,
          });
        }
      });
    }

    return messages;
  }

  /**
   * Extract primary email content (for preview)
   */
  extractPrimaryContent(html?: string, text?: string): string {
    if (text) {
      // Remove excessive whitespace and truncate
      return text.replace(/\s+/g, " ").trim().substring(0, 500);
    }

    if (html) {
      // Simple HTML to text conversion
      return html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim()
        .substring(0, 500);
    }

    return "";
  }
}
