import { Test, TestingModule } from '@nestjs/testing';
import { EmailAccountResolver } from './email-account.resolver';
import { EmailAccountService } from '../email-account.service';
import { GmailSyncService } from '../gmail-sync.service';
import { CustomGqlAuthGuard } from '../../../common/guards/custom-gql-auth.guard';

describe('EmailAccountResolver', () => {
  let resolver: EmailAccountResolver;
  let emailAccountService: EmailAccountService;
  let gmailSyncService: GmailSyncService;

  const mockEmailAccountService = {
    findByWorkspace: jest.fn(),
    findOne: jest.fn(),
    delete: jest.fn(),
    enableSync: jest.fn(),
    disableSync: jest.fn(),
  };

  const mockGmailSyncService = {
    getSyncStatus: jest.fn(),
    syncAccount: jest.fn(),
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

  const mockEmailAccount = {
    id: 'account-123',
    workspaceId: 'workspace-123',
    email: 'user@example.com',
    provider: 'GMAIL',
    isActive: true,
    syncEnabled: true,
    lastSyncedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailAccountResolver,
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: GmailSyncService,
          useValue: mockGmailSyncService,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    resolver = module.get<EmailAccountResolver>(EmailAccountResolver);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    gmailSyncService = module.get<GmailSyncService>(GmailSyncService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('emailAccounts', () => {
    it('should return email accounts for workspace', async () => {
      const mockAccounts = [mockEmailAccount, { ...mockEmailAccount, id: 'account-456' }];
      mockEmailAccountService.findByWorkspace.mockResolvedValue(mockAccounts);

      const result = await resolver.emailAccounts(mockContext);

      expect(emailAccountService.findByWorkspace).toHaveBeenCalledWith('workspace-123');
      expect(result).toEqual(mockAccounts);
    });

    it('should return empty array when no accounts', async () => {
      mockEmailAccountService.findByWorkspace.mockResolvedValue([]);

      const result = await resolver.emailAccounts(mockContext);

      expect(result).toEqual([]);
    });
  });

  describe('emailAccount', () => {
    it('should return a single email account', async () => {
      mockEmailAccountService.findOne.mockResolvedValue(mockEmailAccount);

      const result = await resolver.emailAccount('account-123', mockContext);

      expect(emailAccountService.findOne).toHaveBeenCalledWith('account-123');
      expect(result).toEqual(mockEmailAccount);
    });

    it('should return null when account not found', async () => {
      mockEmailAccountService.findOne.mockResolvedValue(null);

      const result = await resolver.emailAccount('non-existent', mockContext);

      expect(result).toBeNull();
    });
  });

  describe('emailSyncStatus', () => {
    it('should return sync status for workspace', async () => {
      const mockStatus = [
        {
          accountId: 'account-123',
          status: 'SYNCING',
          lastSync: new Date(),
          nextSync: new Date(),
        },
      ];
      mockGmailSyncService.getSyncStatus.mockResolvedValue(mockStatus);

      const result = await resolver.emailSyncStatus(mockContext);

      expect(gmailSyncService.getSyncStatus).toHaveBeenCalledWith('workspace-123');
      expect(result).toEqual(mockStatus);
    });
  });

  describe('connectEmailAccount', () => {
    it('should return OAuth URL for connecting email', async () => {
      const input = { email: 'new@example.com', provider: 'GMAIL' };
      process.env.API_URL = 'http://localhost:3000';

      const result = await resolver.connectEmailAccount(input, mockContext);

      expect(result.authUrl).toContain('/auth/google/connect');
      expect(result.authUrl).toContain('email=new@example.com');
      expect(result.authUrl).toContain('workspace=workspace-123');
    });

    it('should handle missing API_URL', async () => {
      const input = { email: 'new@example.com', provider: 'GMAIL' };
      process.env.API_URL = undefined;

      const result = await resolver.connectEmailAccount(input, mockContext);

      expect(result.authUrl).toContain('undefined/auth/google/connect');
    });
  });

  describe('disconnectEmailAccount', () => {
    it('should disconnect email account', async () => {
      mockEmailAccountService.delete.mockResolvedValue(undefined);

      const result = await resolver.disconnectEmailAccount('account-123', mockContext);

      expect(emailAccountService.delete).toHaveBeenCalledWith('account-123');
      expect(result).toBe(true);
    });

    it('should handle delete errors', async () => {
      mockEmailAccountService.delete.mockRejectedValue(new Error('Delete failed'));

      await expect(
        resolver.disconnectEmailAccount('account-123', mockContext),
      ).rejects.toThrow('Delete failed');
    });
  });

  describe('enableEmailSync', () => {
    it('should enable email sync', async () => {
      const enabledAccount = { ...mockEmailAccount, syncEnabled: true };
      mockEmailAccountService.enableSync.mockResolvedValue(enabledAccount);

      const result = await resolver.enableEmailSync('account-123', mockContext);

      expect(emailAccountService.enableSync).toHaveBeenCalledWith('account-123');
      expect(result).toEqual(enabledAccount);
    });
  });

  describe('disableEmailSync', () => {
    it('should disable email sync', async () => {
      const disabledAccount = { ...mockEmailAccount, syncEnabled: false };
      mockEmailAccountService.disableSync.mockResolvedValue(disabledAccount);

      const result = await resolver.disableEmailSync('account-123', mockContext);

      expect(emailAccountService.disableSync).toHaveBeenCalledWith('account-123');
      expect(result).toEqual(disabledAccount);
    });
  });

  describe('syncEmailAccount', () => {
    it('should sync email account successfully', async () => {
      mockGmailSyncService.syncAccount.mockResolvedValue(undefined);

      const result = await resolver.syncEmailAccount('account-123', false, mockContext);

      expect(gmailSyncService.syncAccount).toHaveBeenCalledWith('account-123', {
        fullSync: false,
        source: 'manual',
      });
      expect(result).toEqual({
        success: true,
        message: 'Sync started successfully',
      });
    });

    it('should handle full sync', async () => {
      mockGmailSyncService.syncAccount.mockResolvedValue(undefined);

      const result = await resolver.syncEmailAccount('account-123', true, mockContext);

      expect(gmailSyncService.syncAccount).toHaveBeenCalledWith('account-123', {
        fullSync: true,
        source: 'manual',
      });
      expect(result.success).toBe(true);
    });

    it('should handle sync errors', async () => {
      mockGmailSyncService.syncAccount.mockRejectedValue(new Error('Sync failed'));

      const result = await resolver.syncEmailAccount('account-123', false, mockContext);

      expect(result).toEqual({
        success: false,
        message: 'Sync failed',
      });
    });

    it('should handle sync errors without message', async () => {
      mockGmailSyncService.syncAccount.mockRejectedValue({});

      const result = await resolver.syncEmailAccount('account-123', false, mockContext);

      expect(result).toEqual({
        success: false,
        message: 'Sync failed',
      });
    });
  });
});