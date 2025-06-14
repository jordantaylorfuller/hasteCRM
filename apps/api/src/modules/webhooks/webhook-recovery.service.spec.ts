import { Test, TestingModule } from '@nestjs/testing';
import { WebhookRecoveryService } from './webhook-recovery.service';
import { EmailAccountService } from '../gmail/email-account.service';
import { GmailSyncService } from '../gmail/gmail-sync.service';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

describe('WebhookRecoveryService', () => {
  let service: WebhookRecoveryService;
  let emailAccountService: EmailAccountService;
  let gmailSyncService: GmailSyncService;
  let prismaService: PrismaService;
  let gmailSyncQueue: Queue;

  const mockEmailAccountService = {
    findActive: jest.fn(),
  };

  const mockGmailSyncService = {
    syncAccount: jest.fn(),
  };

  const mockPrismaService = {
    gmailWebhookEvent: {
      findMany: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    emailAccount: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockGmailSyncQueue = {
    add: jest.fn(),
  };

  const mockAccounts = [
    {
      id: 'account-1',
      email: 'test1@example.com',
      lastSyncAt: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
      createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      id: 'account-2',
      email: 'test2@example.com',
      lastSyncAt: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000),
      isActive: true,
    },
    {
      id: 'account-3',
      email: 'test3@example.com',
      lastSyncAt: null,
      createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago, never synced
      isActive: true,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookRecoveryService,
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: GmailSyncService,
          useValue: mockGmailSyncService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: getQueueToken('gmail-sync'),
          useValue: mockGmailSyncQueue,
        },
      ],
    }).compile();

    service = module.get<WebhookRecoveryService>(WebhookRecoveryService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    gmailSyncService = module.get<GmailSyncService>(GmailSyncService);
    prismaService = module.get<PrismaService>(PrismaService);
    gmailSyncQueue = module.get<Queue>(getQueueToken('gmail-sync'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkMissedUpdates', () => {
    it('should sync accounts that haven\'t synced in over 2 hours', async () => {
      mockEmailAccountService.findActive.mockResolvedValue(mockAccounts);
      mockGmailSyncService.syncAccount.mockResolvedValue({});

      await service.checkMissedUpdates();

      expect(mockEmailAccountService.findActive).toHaveBeenCalled();
      
      // Should sync account-1 (3 hours) and account-3 (5 hours since creation)
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledTimes(2);
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledWith(
        'account-1',
        { fullSync: false, source: 'recovery' }
      );
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledWith(
        'account-3',
        { fullSync: false, source: 'recovery' }
      );
      
      // Should not sync account-2 (only 30 minutes)
      expect(mockGmailSyncService.syncAccount).not.toHaveBeenCalledWith(
        'account-2',
        expect.any(Object)
      );
    });

    it('should handle errors for individual accounts', async () => {
      mockEmailAccountService.findActive.mockResolvedValue(mockAccounts);
      mockGmailSyncService.syncAccount
        .mockResolvedValueOnce({}) // First account succeeds
        .mockRejectedValueOnce(new Error('Sync failed')); // Second account fails

      // Mock logger.error to prevent output in tests
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await service.checkMissedUpdates();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check missed updates'),
        expect.any(Error)
      );

      // Should still process all accounts despite error
      expect(mockGmailSyncService.syncAccount).toHaveBeenCalledTimes(2);

      loggerErrorSpy.mockRestore();
    });

    it('should handle empty account list', async () => {
      mockEmailAccountService.findActive.mockResolvedValue([]);

      await service.checkMissedUpdates();

      expect(mockGmailSyncService.syncAccount).not.toHaveBeenCalled();
    });
  });

  describe('cleanupFailedWebhooks', () => {
    it('should retry and cleanup old failed webhooks', async () => {
      const failedEvents = [
        {
          id: 'event-1',
          accountId: 'account-1',
          historyId: '12345',
          status: 'FAILED',
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
          account: mockAccounts[0],
        },
        {
          id: 'event-2',
          accountId: 'account-2',
          historyId: '12346',
          status: 'FAILED',
          createdAt: new Date(Date.now() - 30 * 60 * 60 * 1000), // 30 hours ago
          account: mockAccounts[1],
        },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(failedEvents);
      mockGmailSyncQueue.add.mockResolvedValue({ id: 'job-123' });
      mockPrismaService.gmailWebhookEvent.update.mockResolvedValue({});
      mockPrismaService.gmailWebhookEvent.deleteMany.mockResolvedValue({ count: 5 });

      await service.cleanupFailedWebhooks();

      // Should find failed events older than 24 hours
      expect(mockPrismaService.gmailWebhookEvent.findMany).toHaveBeenCalledWith({
        where: {
          status: 'FAILED',
          createdAt: {
            lt: expect.any(Date),
          },
        },
        include: {
          account: true,
        },
      });

      // Should queue retry for each failed event
      expect(mockGmailSyncQueue.add).toHaveBeenCalledTimes(2);
      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        'sync-history',
        {
          accountId: 'account-1',
          startHistoryId: mockAccounts[0].lastSyncAt ? expect.any(String) : null,
          endHistoryId: '12345',
          trigger: 'recovery',
        },
        {
          priority: 2,
          attempts: 1,
        }
      );

      // Should update event status
      expect(mockPrismaService.gmailWebhookEvent.update).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.gmailWebhookEvent.update).toHaveBeenCalledWith({
        where: { id: 'event-1' },
        data: { status: 'RETRIED' },
      });

      // Should cleanup very old events
      expect(mockPrismaService.gmailWebhookEvent.deleteMany).toHaveBeenCalledWith({
        where: {
          createdAt: {
            lt: expect.any(Date), // 7 days ago
          },
          status: {
            in: ['PROCESSED', 'RETRIED'],
          },
        },
      });
    });

    it('should handle retry errors gracefully', async () => {
      const failedEvents = [
        {
          id: 'event-1',
          accountId: 'account-1',
          historyId: '12345',
          status: 'FAILED',
          createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
          account: mockAccounts[0],
        },
      ];

      mockPrismaService.gmailWebhookEvent.findMany.mockResolvedValue(failedEvents);
      mockGmailSyncQueue.add.mockRejectedValue(new Error('Queue error'));

      // Mock logger.error to prevent output in tests
      const loggerErrorSpy = jest.spyOn(service['logger'], 'error').mockImplementation();

      await service.cleanupFailedWebhooks();

      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to retry webhook event'),
        expect.any(Error)
      );

      loggerErrorSpy.mockRestore();
    });
  });
});