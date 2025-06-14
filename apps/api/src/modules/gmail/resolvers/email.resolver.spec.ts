import { Test, TestingModule } from '@nestjs/testing';
import { EmailResolver } from './email.resolver';
import { EmailService } from '../email.service';
import { GmailService } from '../gmail.service';
import { EmailAccountService } from '../email-account.service';
import { CustomGqlAuthGuard } from '../../../common/guards/custom-gql-auth.guard';

describe('EmailResolver', () => {
  let resolver: EmailResolver;
  let emailService: EmailService;
  let gmailService: GmailService;
  let emailAccountService: EmailAccountService;

  const mockEmailService = {
    findByWorkspace: jest.fn(),
    findByMessageId: jest.fn(),
    findByThread: jest.fn(),
    search: jest.fn(),
    getStats: jest.fn(),
    markAsRead: jest.fn(),
    markAsUnread: jest.fn(),
    toggleStar: jest.fn(),
    removeLabels: jest.fn(),
    addLabels: jest.fn(),
  };

  const mockGmailService = {
    sendEmail: jest.fn(),
    createDraft: jest.fn(),
    archiveMessage: jest.fn(),
    trashMessage: jest.fn(),
  };

  const mockEmailAccountService = {
    findByUser: jest.fn(),
    findOne: jest.fn(),
    getFreshAccessToken: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        workspaceId: 'workspace-123',
        userId: 'user-123',
        email: 'test@example.com',
      },
    },
  };

  const mockEmail = {
    id: 'email-123',
    messageId: 'msg-123',
    subject: 'Test Email',
    fromEmail: 'sender@example.com',
    toEmails: ['recipient@example.com'],
    workspaceId: 'workspace-123',
    accountId: 'account-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailResolver,
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: GmailService,
          useValue: mockGmailService,
        },
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    resolver = module.get<EmailResolver>(EmailResolver);
    emailService = module.get<EmailService>(EmailService);
    gmailService = module.get<GmailService>(GmailService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('emails', () => {
    it('should return paginated emails', async () => {
      const mockEmails = [mockEmail];
      mockEmailService.findByWorkspace.mockResolvedValue({
        emails: mockEmails,
        total: 100,
      });

      const result = await resolver.emails(0, 20, null, mockContext);

      expect(emailService.findByWorkspace).toHaveBeenCalledWith('workspace-123', {
        skip: 0,
        take: 20,
        where: null,
      });
      expect(result).toEqual({
        emails: mockEmails,
        total: 100,
        hasMore: true,
      });
    });

    it('should handle filters', async () => {
      const filters = { isRead: false, labels: ['INBOX'] };
      mockEmailService.findByWorkspace.mockResolvedValue({
        emails: [],
        total: 0,
      });

      await resolver.emails(0, 20, filters, mockContext);

      expect(emailService.findByWorkspace).toHaveBeenCalledWith('workspace-123', {
        skip: 0,
        take: 20,
        where: filters,
      });
    });
  });

  describe('email', () => {
    it('should return single email and mark as read', async () => {
      mockEmailService.findByMessageId.mockResolvedValue(mockEmail);
      mockEmailService.markAsRead.mockResolvedValue(mockEmail);

      const result = await resolver.email('msg-123', mockContext);

      expect(emailService.findByMessageId).toHaveBeenCalledWith('msg-123');
      expect(emailService.markAsRead).toHaveBeenCalledWith('msg-123');
      expect(result).toEqual(mockEmail);
    });

    it('should return null when email not found', async () => {
      mockEmailService.findByMessageId.mockResolvedValue(null);

      const result = await resolver.email('non-existent', mockContext);

      expect(emailService.markAsRead).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('emailThread', () => {
    it('should return emails in thread', async () => {
      const threadEmails = [mockEmail, { ...mockEmail, id: 'email-456' }];
      mockEmailService.findByThread.mockResolvedValue(threadEmails);

      const result = await resolver.emailThread('thread-123', mockContext);

      expect(emailService.findByThread).toHaveBeenCalledWith('thread-123');
      expect(result).toEqual(threadEmails);
    });
  });

  describe('searchEmails', () => {
    it('should search emails', async () => {
      const searchResults = [mockEmail];
      mockEmailService.search.mockResolvedValue({
        emails: searchResults,
        total: 50,
      });

      const result = await resolver.searchEmails('test query', 0, 20, mockContext);

      expect(emailService.search).toHaveBeenCalledWith('workspace-123', 'test query', {
        skip: 0,
        take: 20,
      });
      expect(result).toEqual({
        emails: searchResults,
        total: 50,
        hasMore: true,
      });
    });
  });

  describe('emailStats', () => {
    it('should return email statistics', async () => {
      const mockStats = {
        total: 1000,
        unread: 50,
        starred: 25,
      };
      mockEmailService.getStats.mockResolvedValue(mockStats);

      const result = await resolver.emailStats(mockContext);

      expect(emailService.getStats).toHaveBeenCalledWith('workspace-123');
      expect(result).toEqual(mockStats);
    });
  });

  describe('sendEmail', () => {
    it('should send email successfully', async () => {
      const input = {
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test Subject',
        body: 'Test Body',
      };

      const mockAccount = {
        id: 'account-123',
        email: 'test@example.com',
      };

      mockEmailAccountService.findByUser.mockResolvedValue([mockAccount]);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue('fresh-token');
      mockGmailService.sendEmail.mockResolvedValue({ id: 'msg-sent-123' });

      const result = await resolver.sendEmail(input, mockContext);

      expect(emailAccountService.findByUser).toHaveBeenCalledWith('user-123');
      expect(emailAccountService.getFreshAccessToken).toHaveBeenCalledWith('account-123');
      expect(gmailService.sendEmail).toHaveBeenCalledWith(
        'fresh-token',
        input.to,
        input.subject,
        input.body,
        {
          cc: undefined,
          bcc: undefined,
          replyTo: undefined,
        },
      );
      expect(result).toEqual({
        success: true,
        messageId: 'msg-sent-123',
      });
    });

    it('should handle account not found', async () => {
      const input = {
        from: 'unknown@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Test',
      };

      mockEmailAccountService.findByUser.mockResolvedValue([]);

      const result = await resolver.sendEmail(input, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Email account not found',
      });
    });

    it('should handle send errors', async () => {
      const input = {
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Test',
        body: 'Test',
      };

      mockEmailAccountService.findByUser.mockResolvedValue([
        { id: 'account-123', email: 'test@example.com' },
      ]);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue('fresh-token');
      mockGmailService.sendEmail.mockRejectedValue(new Error('Send failed'));

      const result = await resolver.sendEmail(input, mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Send failed',
      });
    });
  });

  describe('createDraft', () => {
    it('should create draft successfully', async () => {
      const input = {
        from: 'test@example.com',
        to: ['recipient@example.com'],
        subject: 'Draft Subject',
        body: 'Draft Body',
      };

      mockEmailAccountService.findByUser.mockResolvedValue([
        { id: 'account-123', email: 'test@example.com' },
      ]);
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue('fresh-token');
      mockGmailService.createDraft.mockResolvedValue({ id: 'draft-123' });

      const result = await resolver.createDraft(input, mockContext);

      expect(gmailService.createDraft).toHaveBeenCalledWith(
        'fresh-token',
        input.to,
        input.subject,
        input.body,
      );
      expect(result).toEqual({
        success: true,
        draftId: 'draft-123',
      });
    });
  });

  describe('markEmailAsRead', () => {
    it('should mark email as read', async () => {
      mockEmailService.markAsRead.mockResolvedValue(mockEmail);

      const result = await resolver.markEmailAsRead('msg-123', mockContext);

      expect(emailService.markAsRead).toHaveBeenCalledWith('msg-123');
      expect(result).toEqual(mockEmail);
    });
  });

  describe('markEmailAsUnread', () => {
    it('should mark email as unread', async () => {
      mockEmailService.markAsUnread.mockResolvedValue(mockEmail);

      const result = await resolver.markEmailAsUnread('msg-123', mockContext);

      expect(emailService.markAsUnread).toHaveBeenCalledWith('msg-123');
      expect(result).toEqual(mockEmail);
    });
  });

  describe('toggleEmailStar', () => {
    it('should toggle email star', async () => {
      mockEmailService.toggleStar.mockResolvedValue(mockEmail);

      const result = await resolver.toggleEmailStar('msg-123', mockContext);

      expect(emailService.toggleStar).toHaveBeenCalledWith('msg-123');
      expect(result).toEqual(mockEmail);
    });
  });

  describe('archiveEmail', () => {
    it('should archive email successfully', async () => {
      mockEmailService.findByMessageId.mockResolvedValue(mockEmail);
      mockEmailAccountService.findOne.mockResolvedValue({
        id: 'account-123',
      });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue('fresh-token');
      mockGmailService.archiveMessage.mockResolvedValue(undefined);
      mockEmailService.removeLabels.mockResolvedValue(undefined);

      const result = await resolver.archiveEmail('msg-123', mockContext);

      expect(gmailService.archiveMessage).toHaveBeenCalledWith('fresh-token', 'msg-123');
      expect(emailService.removeLabels).toHaveBeenCalledWith(
        'workspace-123',
        'msg-123',
        ['INBOX'],
      );
      expect(result).toEqual({ success: true });
    });

    it('should handle email not found', async () => {
      mockEmailService.findByMessageId.mockResolvedValue(null);

      const result = await resolver.archiveEmail('non-existent', mockContext);

      expect(result).toEqual({
        success: false,
        error: 'Email not found',
      });
    });
  });

  describe('trashEmail', () => {
    it('should trash email successfully', async () => {
      mockEmailService.findByMessageId.mockResolvedValue(mockEmail);
      mockEmailAccountService.findOne.mockResolvedValue({
        id: 'account-123',
      });
      mockEmailAccountService.getFreshAccessToken.mockResolvedValue('fresh-token');
      mockGmailService.trashMessage.mockResolvedValue(undefined);
      mockEmailService.addLabels.mockResolvedValue(undefined);

      const result = await resolver.trashEmail('msg-123', mockContext);

      expect(gmailService.trashMessage).toHaveBeenCalledWith('fresh-token', 'msg-123');
      expect(emailService.addLabels).toHaveBeenCalledWith(
        'workspace-123',
        'msg-123',
        ['TRASH'],
      );
      expect(result).toEqual({ success: true });
    });
  });
});