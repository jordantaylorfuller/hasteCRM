export interface Email {
  id: string;
  gmailId: string;
  threadId?: string;
  fromEmail: string;
  fromName?: string;
  toEmails: string[];
  ccEmails: string[];
  bccEmails: string[];
  subject: string;
  snippet: string;
  bodyText?: string;
  bodyHtml?: string;
  sentAt: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  gmailLabels?: string[];
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  id: string;
  gmailId: string;
  filename: string;
  mimeType: string;
  size: number;
  data?: string; // base64 encoded
}

export interface EmailAccount {
  id: string;
  email: string;
  displayName?: string;
  syncEnabled: boolean;
  syncStatus: string;
  lastSyncAt?: string;
}
