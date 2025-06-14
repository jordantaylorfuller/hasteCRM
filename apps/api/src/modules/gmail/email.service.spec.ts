import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EmailStatus } from '@hasteCRM/database';

describe('EmailService', () => {
  let service: EmailService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    email: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    emailAttachment: {
      create: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    contact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    emailAccount: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockWorkspaceId = 'workspace-123';
  const mockUserId = 'user-123';
  const mockEmailAccountId = 'email-account-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EmailService>(EmailService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('createEmail', () => {
    const createEmailDto = {
      messageId: 'msg-123',
      threadId: 'thread-123',
      emailAccountId: mockEmailAccountId,
      subject: 'Test Email',
      fromEmail: 'sender@example.com',
      fromName: 'Sender Name',
      toEmails: ['recipient@example.com'],
      ccEmails: ['cc@example.com'],
      bccEmails: ['bcc@example.com'],
      replyToEmail: 'replyto@example.com',
      bodyText: 'Test email body',
      bodyHtml: '<p>Test email body</p>',
      sentAt: new Date(),
      labelIds: ['INBOX', 'IMPORTANT'],
      attachments: [
        {
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          attachmentId: 'attach-123',
        },
      ],
    };

    it('should create an email with attachments', async () => {
      const mockCreatedEmail = {
        id: 'email-123',
        ...createEmailDto,
        workspaceId: mockWorkspaceId,
        status: EmailStatus.SENT,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.email.create.mockResolvedValue(mockCreatedEmail);
      mockPrismaService.emailAttachment.createMany.mockResolvedValue({ count: 1 });

      const result = await service.createEmail(mockWorkspaceId, createEmailDto);

      expect(result).toEqual(mockCreatedEmail);
      expect(mockPrismaService.email.create).toHaveBeenCalledWith({
        data: {
          workspaceId: mockWorkspaceId,
          messageId: createEmailDto.messageId,
          threadId: createEmailDto.threadId,
          emailAccountId: createEmailDto.emailAccountId,
          subject: createEmailDto.subject,
          fromEmail: createEmailDto.fromEmail,
          fromName: createEmailDto.fromName,
          toEmails: createEmailDto.toEmails,
          ccEmails: createEmailDto.ccEmails,
          bccEmails: createEmailDto.bccEmails,
          replyToEmail: createEmailDto.replyToEmail,
          bodyText: createEmailDto.bodyText,
          bodyHtml: createEmailDto.bodyHtml,
          sentAt: createEmailDto.sentAt,
          labelIds: createEmailDto.labelIds,
          status: EmailStatus.SENT,
        },
      });

      expect(mockPrismaService.emailAttachment.createMany).toHaveBeenCalledWith({
        data: [{
          emailId: mockCreatedEmail.id,
          filename: 'test.pdf',
          mimeType: 'application/pdf',
          size: 1024,
          attachmentId: 'attach-123',
          inline: false,
        }],
      });
    });

    it('should create an email without attachments', async () => {
      const emailWithoutAttachments = {
        ...createEmailDto,
        attachments: undefined,
      };

      const mockCreatedEmail = {
        id: 'email-123',
        ...emailWithoutAttachments,
        workspaceId: mockWorkspaceId,
        status: EmailStatus.SENT,
      };

      mockPrismaService.email.create.mockResolvedValue(mockCreatedEmail);

      const result = await service.createEmail(mockWorkspaceId, emailWithoutAttachments);

      expect(result).toEqual(mockCreatedEmail);
      expect(mockPrismaService.emailAttachment.createMany).not.toHaveBeenCalled();
    });

    it('should handle database errors', async () => {
      mockPrismaService.email.create.mockRejectedValue(new Error('Database error'));

      await expect(service.createEmail(mockWorkspaceId, createEmailDto)).rejects.toThrow('Database error');
    });
  });

  describe('findByMessageId', () => {
    it('should find email by message ID', async () => {
      const mockEmail = {
        id: 'email-123',
        messageId: 'msg-123',
        subject: 'Test Email',
      };

      mockPrismaService.email.findFirst.mockResolvedValue(mockEmail);

      const result = await service.findByMessageId('msg-123');

      expect(result).toEqual(mockEmail);
      expect(mockPrismaService.email.findFirst).toHaveBeenCalledWith({
        where: { messageId: 'msg-123' },
      });
    });

    it('should return null if email not found', async () => {
      mockPrismaService.email.findFirst.mockResolvedValue(null);

      const result = await service.findByMessageId('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByThread', () => {
    it('should find emails by thread ID', async () => {
      const mockEmails = [
        { id: 'email-1', threadId: 'thread-123', sentAt: new Date('2024-01-01') },
        { id: 'email-2', threadId: 'thread-123', sentAt: new Date('2024-01-02') },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.findByThread('thread-123');

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: { threadId: 'thread-123' },
        orderBy: { sentAt: 'asc' },
      });
    });

    it('should return empty array if no emails found', async () => {
      mockPrismaService.email.findMany.mockResolvedValue([]);

      const result = await service.findByThread('non-existent-thread');

      expect(result).toEqual([]);
    });
  });

  describe('syncEmails', () => {
    const mockEmailAccount = {
      id: mockEmailAccountId,
      email: 'user@example.com',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      provider: 'GOOGLE',
    };

    it('should sync emails for an account', async () => {
      mockPrismaService.emailAccount.findUnique.mockResolvedValue(mockEmailAccount);
      mockPrismaService.email.findFirst.mockResolvedValue(null); // No existing emails

      // Mock Gmail API responses would go here
      // This is a simplified version for the test

      const result = await service.syncEmails(mockWorkspaceId, mockEmailAccountId);

      expect(result).toHaveProperty('synced');
      expect(result).toHaveProperty('errors');
      expect(mockPrismaService.emailAccount.findUnique).toHaveBeenCalledWith({
        where: { id: mockEmailAccountId, workspaceId: mockWorkspaceId },
      });
    });

    it('should throw error if email account not found', async () => {
      mockPrismaService.emailAccount.findUnique.mockResolvedValue(null);

      await expect(
        service.syncEmails(mockWorkspaceId, 'non-existent-account'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateEmailStatus', () => {
    it('should update email status', async () => {
      const mockEmail = {
        id: 'email-123',
        status: EmailStatus.SENT,
        workspaceId: mockWorkspaceId,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        status: EmailStatus.READ,
      });

      const result = await service.updateEmailStatus(
        mockWorkspaceId,
        'email-123',
        EmailStatus.READ,
      );

      expect(result.status).toBe(EmailStatus.READ);
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: { status: EmailStatus.READ },
      });
    });

    it('should throw error if email not found', async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await expect(
        service.updateEmailStatus(mockWorkspaceId, 'non-existent', EmailStatus.READ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEmailsByContact', () => {
    it('should get emails for a contact', async () => {
      const contactEmail = 'contact@example.com';
      const mockEmails = [
        { id: 'email-1', fromEmail: contactEmail },
        { id: 'email-2', toEmails: [contactEmail] },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.getEmailsByContact(mockWorkspaceId, 'contact-123', contactEmail);

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          OR: [
            { fromEmail: contactEmail },
            { toEmails: { has: contactEmail } },
            { ccEmails: { has: contactEmail } },
            { bccEmails: { has: contactEmail } },
          ],
        },
        orderBy: { sentAt: 'desc' },
        include: {
          attachments: true,
        },
      });
    });

    it('should handle pagination', async () => {
      const contactEmail = 'contact@example.com';
      const mockEmails = [];
      for (let i = 0; i < 10; i++) {
        mockEmails.push({ id: `email-${i}`, fromEmail: contactEmail });
      }

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.getEmailsByContact(
        mockWorkspaceId,
        'contact-123',
        contactEmail,
        { page: 2, limit: 5 },
      );

      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: expect.any(Object),
        orderBy: { sentAt: 'desc' },
        include: { attachments: true },
        skip: 5,
        take: 5,
      });
    });
  });

  describe('searchEmails', () => {
    it('should search emails by query', async () => {
      const searchQuery = 'project update';
      const mockEmails = [
        { id: 'email-1', subject: 'Project Update Q1' },
        { id: 'email-2', bodyText: 'Here is the project update' },
      ];

      mockPrismaService.email.findMany.mockResolvedValue(mockEmails);

      const result = await service.searchEmails(mockWorkspaceId, searchQuery);

      expect(result).toEqual(mockEmails);
      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          OR: [
            { subject: { contains: searchQuery, mode: 'insensitive' } },
            { bodyText: { contains: searchQuery, mode: 'insensitive' } },
            { fromName: { contains: searchQuery, mode: 'insensitive' } },
            { fromEmail: { contains: searchQuery, mode: 'insensitive' } },
          ],
        },
        orderBy: { sentAt: 'desc' },
        include: {
          attachments: true,
          emailAccount: {
            select: {
              email: true,
              name: true,
            },
          },
        },
      });
    });

    it('should apply filters to search', async () => {
      const filters = {
        fromEmail: 'sender@example.com',
        labelIds: ['INBOX'],
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        hasAttachments: true,
      };

      mockPrismaService.email.findMany.mockResolvedValue([]);

      await service.searchEmails(mockWorkspaceId, 'test', filters);

      expect(mockPrismaService.email.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          AND: [
            {
              OR: expect.any(Array),
            },
            {
              fromEmail: 'sender@example.com',
              labelIds: { hasEvery: ['INBOX'] },
              sentAt: {
                gte: filters.startDate,
                lte: filters.endDate,
              },
              attachments: {
                some: {},
              },
            },
          ],
        },
        orderBy: { sentAt: 'desc' },
        include: expect.any(Object),
      });
    });
  });

  describe('deleteEmail', () => {
    it('should delete an email', async () => {
      const mockEmail = {
        id: 'email-123',
        workspaceId: mockWorkspaceId,
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.email.delete.mockResolvedValue(mockEmail);

      await service.deleteEmail(mockWorkspaceId, 'email-123');

      expect(mockPrismaService.email.delete).toHaveBeenCalledWith({
        where: { id: 'email-123' },
      });
    });

    it('should throw error if email not found', async () => {
      mockPrismaService.email.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteEmail(mockWorkspaceId, 'non-existent'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getEmailStats', () => {
    it('should get email statistics', async () => {
      mockPrismaService.email.count.mockResolvedValueOnce(100); // total
      mockPrismaService.email.count.mockResolvedValueOnce(10); // unread
      mockPrismaService.email.count.mockResolvedValueOnce(5); // starred

      const result = await service.getEmailStats(mockWorkspaceId);

      expect(result).toEqual({
        total: 100,
        unread: 10,
        starred: 5,
        readRate: 0.9,
      });
    });

    it('should handle zero emails', async () => {
      mockPrismaService.email.count.mockResolvedValue(0);

      const result = await service.getEmailStats(mockWorkspaceId);

      expect(result).toEqual({
        total: 0,
        unread: 0,
        starred: 0,
        readRate: 0,
      });
    });
  });

  describe('attachContact', () => {
    it('should attach contact to email', async () => {
      const mockEmail = {
        id: 'email-123',
        workspaceId: mockWorkspaceId,
        fromEmail: 'sender@example.com',
      };

      const mockContact = {
        id: 'contact-123',
        email: 'sender@example.com',
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.contact.findFirst.mockResolvedValue(mockContact);
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        contactId: 'contact-123',
      });

      const result = await service.attachContact(mockWorkspaceId, 'email-123');

      expect(result.contactId).toBe('contact-123');
      expect(mockPrismaService.email.update).toHaveBeenCalledWith({
        where: { id: 'email-123' },
        data: { contactId: 'contact-123' },
      });
    });

    it('should create contact if not found', async () => {
      const mockEmail = {
        id: 'email-123',
        workspaceId: mockWorkspaceId,
        fromEmail: 'new@example.com',
        fromName: 'New Contact',
      };

      mockPrismaService.email.findUnique.mockResolvedValue(mockEmail);
      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.create.mockResolvedValue({
        id: 'new-contact-123',
        email: 'new@example.com',
      });
      mockPrismaService.email.update.mockResolvedValue({
        ...mockEmail,
        contactId: 'new-contact-123',
      });

      const result = await service.attachContact(mockWorkspaceId, 'email-123');

      expect(mockPrismaService.contact.create).toHaveBeenCalledWith({
        data: {
          workspaceId: mockWorkspaceId,
          email: 'new@example.com',
          firstName: 'New',
          lastName: 'Contact',
        },
      });
    });
  });
});