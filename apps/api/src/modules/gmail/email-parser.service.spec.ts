import { Test, TestingModule } from '@nestjs/testing';
import { EmailParserService } from './email-parser.service';
import { gmail_v1 } from 'googleapis';

describe('EmailParserService', () => {
  let service: EmailParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailParserService],
    }).compile();

    service = module.get<EmailParserService>(EmailParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseGmailMessage', () => {
    it('should parse a complete email message', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        threadId: 'thread-123',
        labelIds: ['INBOX', 'IMPORTANT', 'STARRED'],
        snippet: 'This is a test email snippet...',
        internalDate: '1704067200000', // 2024-01-01 00:00:00 UTC
        payload: {
          headers: [
            { name: 'From', value: 'John Doe <john@example.com>' },
            { name: 'To', value: 'Jane Smith <jane@example.com>, Bob <bob@example.com>' },
            { name: 'Cc', value: 'Alice <alice@example.com>' },
            { name: 'Subject', value: 'Test Email Subject' },
            { name: 'Date', value: 'Mon, 1 Jan 2024 00:00:00 +0000' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('This is the plain text body').toString('base64'),
              },
            },
            {
              mimeType: 'text/html',
              body: {
                data: Buffer.from('<p>This is the HTML body</p>').toString('base64'),
              },
            },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result).toEqual({
        subject: 'Test Email Subject',
        snippet: 'This is a test email snippet...',
        bodyHtml: '<p>This is the HTML body</p>',
        bodyText: 'This is the plain text body',
        fromEmail: 'john@example.com',
        fromName: 'John Doe',
        toEmails: ['jane@example.com', 'bob@example.com'],
        toNames: ['Jane Smith', 'Bob'],
        ccEmails: ['alice@example.com'],
        ccNames: ['Alice'],
        bccEmails: [],
        bccNames: [],
        sentAt: new Date('2024-01-01T00:00:00.000Z'),
        receivedAt: new Date('2024-01-01T00:00:00.000Z'),
        gmailLabels: ['INBOX', 'IMPORTANT', 'STARRED'],
        isRead: true,
        isStarred: true,
        isImportant: true,
        isDraft: false,
        attachments: [],
      });
    });

    it('should handle email with attachments', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: ['INBOX'],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          parts: [
            {
              mimeType: 'text/plain',
              body: { data: Buffer.from('Email with attachment').toString('base64') },
            },
            {
              filename: 'document.pdf',
              mimeType: 'application/pdf',
              body: {
                attachmentId: 'attach-123',
                size: 102400,
              },
            },
            {
              filename: 'image.jpg',
              mimeType: 'image/jpeg',
              body: {
                attachmentId: 'attach-124',
                size: 204800,
              },
            },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.attachments).toHaveLength(2);
      expect(result.attachments).toEqual([
        {
          id: 'attach-123',
          filename: 'document.pdf',
          mimeType: 'application/pdf',
          size: 102400,
        },
        {
          id: 'attach-124',
          filename: 'image.jpg',
          mimeType: 'image/jpeg',
          size: 204800,
        },
      ]);
    });

    it('should handle email with UNREAD label', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: ['INBOX', 'UNREAD'],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.isRead).toBe(false);
      expect(result.isStarred).toBe(false);
      expect(result.isImportant).toBe(false);
    });

    it('should handle email with DRAFT label', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: ['DRAFT'],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.isDraft).toBe(true);
    });

    it('should handle multipart/alternative messages', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          mimeType: 'multipart/alternative',
          parts: [
            {
              mimeType: 'text/plain',
              body: {
                data: Buffer.from('Plain text version').toString('base64'),
              },
            },
            {
              mimeType: 'text/html',
              body: {
                data: Buffer.from('<p>HTML version</p>').toString('base64'),
              },
            },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.bodyText).toBe('Plain text version');
      expect(result.bodyHtml).toBe('<p>HTML version</p>');
    });

    it('should handle nested multipart messages', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          mimeType: 'multipart/mixed',
          parts: [
            {
              mimeType: 'multipart/alternative',
              parts: [
                {
                  mimeType: 'text/plain',
                  body: {
                    data: Buffer.from('Nested plain text').toString('base64'),
                  },
                },
                {
                  mimeType: 'text/html',
                  body: {
                    data: Buffer.from('<p>Nested HTML</p>').toString('base64'),
                  },
                },
              ],
            },
            {
              filename: 'attachment.txt',
              mimeType: 'text/plain',
              body: {
                attachmentId: 'attach-125',
                size: 1024,
              },
            },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.bodyText).toBe('Nested plain text');
      expect(result.bodyHtml).toBe('<p>Nested HTML</p>');
      expect(result.attachments).toHaveLength(1);
    });

    it('should handle missing headers gracefully', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.subject).toBeUndefined();
      expect(result.fromEmail).toBe('unknown@example.com');
      expect(result.fromName).toBeUndefined();
      expect(result.toEmails).toEqual([]);
      expect(result.ccEmails).toEqual([]);
      expect(result.bccEmails).toEqual([]);
    });

    it('should handle email addresses without names', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'noreply@example.com' },
            { name: 'To', value: 'user1@example.com, user2@example.com' },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.fromEmail).toBe('noreply@example.com');
      expect(result.fromName).toBeUndefined();
      expect(result.toEmails).toEqual(['user1@example.com', 'user2@example.com']);
      expect(result.toNames).toEqual(['', '']);
    });

    it('should decode base64 content correctly', () => {
      const originalText = 'This is a test with special characters: é à ñ';
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          body: {
            data: Buffer.from(originalText).toString('base64'),
          },
          mimeType: 'text/plain',
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.bodyText).toBe(originalText);
    });

    it('should handle URL-safe base64 encoding', () => {
      const originalText = 'Test content with padding issues';
      const base64 = Buffer.from(originalText).toString('base64');
      const urlSafeBase64 = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
      
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          body: {
            data: urlSafeBase64,
          },
          mimeType: 'text/plain',
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.bodyText).toBe(originalText);
    });

    it('should extract email addresses from complex formats', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: '"Last, First" <first.last@example.com>' },
            { name: 'To', value: '"Smith, John" <john.smith@example.com>, "Doe, Jane" <jane.doe@example.com>' },
            { name: 'Cc', value: 'no-brackets@example.com' },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.fromEmail).toBe('first.last@example.com');
      expect(result.fromName).toBe('Last, First');
      expect(result.toEmails).toEqual(['john.smith@example.com', 'jane.doe@example.com']);
      expect(result.toNames).toEqual(['Smith, John', 'Doe, Jane']);
      expect(result.ccEmails).toEqual(['no-brackets@example.com']);
    });

    it('should handle missing internalDate', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
        },
      };

      const beforeParse = new Date();
      const result = service.parseGmailMessage(mockMessage);
      const afterParse = new Date();

      expect(result.sentAt.getTime()).toBeGreaterThanOrEqual(beforeParse.getTime());
      expect(result.sentAt.getTime()).toBeLessThanOrEqual(afterParse.getTime());
      expect(result.receivedAt).toEqual(result.sentAt);
    });

    it('should handle inline images as attachments', () => {
      const mockMessage: gmail_v1.Schema$Message = {
        id: 'message-123',
        labelIds: [],
        payload: {
          headers: [
            { name: 'From', value: 'sender@example.com' },
            { name: 'To', value: 'recipient@example.com' },
          ],
          parts: [
            {
              mimeType: 'text/html',
              body: {
                data: Buffer.from('<img src="cid:image1">').toString('base64'),
              },
            },
            {
              mimeType: 'image/png',
              headers: [
                { name: 'Content-ID', value: '<image1>' },
                { name: 'Content-Disposition', value: 'inline; filename="logo.png"' },
              ],
              body: {
                attachmentId: 'attach-inline-123',
                size: 5120,
              },
              filename: 'logo.png',
            },
          ],
        },
      };

      const result = service.parseGmailMessage(mockMessage);

      expect(result.attachments).toHaveLength(1);
      expect(result.attachments[0]).toEqual({
        id: 'attach-inline-123',
        filename: 'logo.png',
        mimeType: 'image/png',
        size: 5120,
      });
    });
  });
});