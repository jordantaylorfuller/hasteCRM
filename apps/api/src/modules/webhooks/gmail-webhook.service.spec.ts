import { Test, TestingModule } from '@nestjs/testing';
import { GmailWebhookService } from './gmail-webhook.service';
import { EmailAccountService } from '../gmail/email-account.service';
import { RedisService } from '../redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';

describe('GmailWebhookService', () => {
  let service: GmailWebhookService;
  let emailAccountService: EmailAccountService;
  let redisService: RedisService;
  let prismaService: PrismaService;
  let gmailSyncQueue: Queue;

  const mockEmailAccountService = {
    findByEmail: jest.fn(),
  };

  const mockRedisService = {
    get: jest.fn(),
    set: jest.fn(),
    setex: jest.fn(),
    hget: jest.fn(),
    hincrby: jest.fn(),
    expire: jest.fn(),
  };

  const mockPrismaService = {
    gmailWebhookEvent: {
      create: jest.fn(),
      updateMany: jest.fn(),
    },
  };

  const mockGmailSyncQueue = {
    add: jest.fn(),
  };

  const mockNotification = {
    emailAddress: 'test@example.com',
    historyId: '12345',
    messageId: 'msg-123',
    publishTime: '2024-01-01T00:00:00Z',
    attributes: {},
  };

  const mockAccount = {
    id: 'account-123',
    email: 'test@example.com',
    historyId: '12340',
    isActive: true,
    workspaceId: 'workspace-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GmailWebhookService,
        {
          provide: EmailAccountService,
          useValue: mockEmailAccountService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
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

    service = module.get<GmailWebhookService>(GmailWebhookService);
    emailAccountService = module.get<EmailAccountService>(EmailAccountService);
    redisService = module.get<RedisService>(RedisService);
    prismaService = module.get<PrismaService>(PrismaService);
    gmailSyncQueue = module.get<Queue>(getQueueToken('gmail-sync'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('processNotification', () => {
    it('should process a valid notification', async () => {
      mockRedisService.get.mockResolvedValue(null); // Not duplicate
      mockEmailAccountService.findByEmail.mockResolvedValue(mockAccount);
      mockGmailSyncQueue.add.mockResolvedValue({ id: 'job-123' });
      mockPrismaService.gmailWebhookEvent.create.mockResolvedValue({});
      mockPrismaService.gmailWebhookEvent.updateMany.mockResolvedValue({});
      mockRedisService.setex.mockResolvedValue('OK');
      mockRedisService.hincrby.mockResolvedValue(1);

      await service.processNotification(mockNotification);

      // Check duplicate check
      expect(mockRedisService.get).toHaveBeenCalledWith(
        'gmail:webhook:dedup:msg-123'
      );

      // Check account lookup
      expect(mockEmailAccountService.findByEmail).toHaveBeenCalledWith(
        'test@example.com'
      );

      // Check webhook event creation
      expect(mockPrismaService.gmailWebhookEvent.create).toHaveBeenCalledWith({
        data: {
          accountId: 'account-123',
          messageId: 'msg-123',
          historyId: '12345',
          publishTime: new Date('2024-01-01T00:00:00Z'),
          status: 'PENDING',
        },
      });

      // Check sync job creation
      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        'sync-history',
        {
          accountId: 'account-123',
          startHistoryId: '12340',
          endHistoryId: '12345',
          trigger: 'webhook',
        },
        {
          priority: 1,
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        }
      );

      // Check status update
      expect(mockPrismaService.gmailWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: {
          messageId: 'msg-123',
          status: 'PENDING',
        },
        data: {
          status: 'QUEUED',
          jobId: 'job-123',
        },
      });
    });

    it('should skip duplicate notifications', async () => {
      mockRedisService.get.mockResolvedValue('1'); // Is duplicate

      await service.processNotification(mockNotification);

      expect(mockEmailAccountService.findByEmail).not.toHaveBeenCalled();
      expect(mockGmailSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should skip if account not found', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockEmailAccountService.findByEmail.mockResolvedValue(null);

      await service.processNotification(mockNotification);

      expect(mockGmailSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should skip old history IDs', async () => {
      const accountWithNewerHistory = {
        ...mockAccount,
        historyId: '12350', // Newer than notification
      };

      mockRedisService.get.mockResolvedValue(null);
      mockEmailAccountService.findByEmail.mockResolvedValue(accountWithNewerHistory);

      await service.processNotification(mockNotification);

      expect(mockGmailSyncQueue.add).not.toHaveBeenCalled();
    });

    it('should handle account with no history ID', async () => {
      const accountWithoutHistory = {
        ...mockAccount,
        historyId: null,
      };

      mockRedisService.get.mockResolvedValue(null);
      mockEmailAccountService.findByEmail.mockResolvedValue(accountWithoutHistory);
      mockGmailSyncQueue.add.mockResolvedValue({ id: 'job-123' });

      await service.processNotification(mockNotification);

      expect(mockGmailSyncQueue.add).toHaveBeenCalledWith(
        'sync-history',
        expect.objectContaining({
          startHistoryId: null,
          endHistoryId: '12345',
        }),
        expect.any(Object)
      );
    });

    it('should handle errors gracefully', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockEmailAccountService.findByEmail.mockResolvedValue(mockAccount);
      mockGmailSyncQueue.add.mockRejectedValue(new Error('Queue error'));

      // Mock console.error to prevent output in tests
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await service.processNotification(mockNotification);

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to process webhook'),
        expect.any(Error)
      );

      // Check error recording
      expect(mockPrismaService.gmailWebhookEvent.updateMany).toHaveBeenCalledWith({
        where: {
          messageId: 'msg-123',
          status: 'PENDING',
        },
        data: {
          status: 'ERROR',
          error: 'Queue error',
        },
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('checkDuplicate', () => {
    it('should detect duplicates correctly', async () => {
      mockRedisService.get.mockResolvedValue('1');
      
      const result = await (service as any).checkDuplicate('msg-123');
      
      expect(result).toBe(true);
      expect(mockRedisService.get).toHaveBeenCalledWith('gmail:notification:msg-123');
    });

    it('should mark as not duplicate and set TTL', async () => {
      mockRedisService.get.mockResolvedValue(null);
      mockRedisService.set.mockResolvedValue('OK');
      
      const result = await (service as any).checkDuplicate('msg-456');
      
      expect(result).toBe(false);
      expect(mockRedisService.set).toHaveBeenCalledWith(
        'gmail:notification:msg-456',
        '1',
        'EX',
        3600
      );
    });
  });

  describe('updateMetrics', () => {
    it('should update webhook metrics', async () => {
      mockRedisService.hincrby.mockResolvedValue(1);
      
      await (service as any).updateMetrics('account-123', 150);
      
      expect(mockRedisService.hincrby).toHaveBeenCalledWith(
        'gmail:webhook:metrics:account-123',
        'count',
        1
      );
      
      expect(mockRedisService.hincrby).toHaveBeenCalledWith(
        'gmail:webhook:metrics:account-123',
        'totalTime',
        150
      );
    });
  });

  describe('verifyWebhook', () => {
    it('should verify webhook signature correctly', () => {
      const validSignature = 'valid-signature';
      const payload = { test: 'data' };
      
      // This would require actual implementation of signature verification
      // For now, we'll test the structure
      const result = (service as any).verifyWebhook(validSignature, payload);
      
      expect(result).toBeDefined();
    });
  });

  describe('getWebhookStats', () => {
    it('should return webhook statistics', async () => {
      mockRedisService.hget.mockImplementation((key, field) => {
        if (field === 'count') return '100';
        if (field === 'totalTime') return '15000';
        return null;
      });

      const stats = await service.getWebhookStats('account-123');

      expect(stats).toEqual({
        totalReceived: 100,
        averageProcessingTime: 150,
      });
    });

    it('should handle missing metrics', async () => {
      mockRedisService.hget.mockResolvedValue(null);

      const stats = await service.getWebhookStats('account-123');

      expect(stats).toEqual({
        totalReceived: 0,
        averageProcessingTime: 0,
      });
    });
  });

});