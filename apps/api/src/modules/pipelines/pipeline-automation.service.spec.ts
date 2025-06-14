import { Test, TestingModule } from '@nestjs/testing';
import { PipelineAutomationService } from './pipeline-automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { DealsService } from './deals.service';
import { Queue } from 'bullmq';
import {
  AutomationTrigger,
  AutomationAction,
  Deal,
  PipelineAutomation,
  AutomationLog,
  Prisma,
} from '@hasteCRM/database';
import { getQueueToken } from '@nestjs/bullmq';

describe('PipelineAutomationService', () => {
  let service: PipelineAutomationService;
  let prismaService: PrismaService;
  let emailService: EmailService;
  let dealsService: DealsService;
  let automationQueue: Queue;

  const mockPrismaService = {
    pipelineAutomation: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    automationLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    deal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    dealStageTransition: {
      aggregate: jest.fn(),
    },
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockDealsService = {
    setAutomationService: jest.fn(),
    update: jest.fn(),
  };

  const mockAutomationQueue = {
    add: jest.fn(),
  };

  const mockDeal: Deal = {
    id: 'deal-123',
    name: 'Test Deal',
    value: new Prisma.Decimal(1000),
    status: 'OPEN',
    pipelineId: 'pipeline-123',
    stageId: 'stage-123',
    contactId: 'contact-123',
    ownerId: 'user-123',
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    expectedCloseDate: null,
    workspaceId: 'workspace-123',
    stageEnteredAt: new Date(),
    description: null,
    probability: null,
    lostReason: null,
    nextActionDate: null,
    nextActionDescription: null,
    lastActivityDate: new Date(),
  };

  const mockAutomation: PipelineAutomation = {
    id: 'automation-123',
    name: 'Test Automation',
    pipelineId: 'pipeline-123',
    trigger: AutomationTrigger.STAGE_ENTER,
    triggerStageId: 'stage-123',
    conditions: {},
    actions: [
      {
        type: AutomationAction.SEND_EMAIL,
        config: {
          template: 'test-template',
          to: 'test@example.com',
        },
      },
    ],
    isActive: true,
    delay: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: 'workspace-123',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineAutomationService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: EmailService,
          useValue: mockEmailService,
        },
        {
          provide: DealsService,
          useValue: mockDealsService,
        },
        {
          provide: getQueueToken('automations'),
          useValue: mockAutomationQueue,
        },
      ],
    }).compile();

    service = module.get<PipelineAutomationService>(PipelineAutomationService);
    prismaService = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    dealsService = module.get<DealsService>(DealsService);
    automationQueue = module.get<Queue>(getQueueToken('automations'));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('onModuleInit', () => {
    it('should set automation service in deals service', () => {
      service.onModuleInit();
      expect(mockDealsService.setAutomationService).toHaveBeenCalledWith(service);
    });
  });

  describe('triggerAutomations', () => {
    it('should trigger automations for stage enter', async () => {
      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      mockPrismaService.pipelineAutomation.findMany.mockResolvedValue([mockAutomation]);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await service.triggerAutomations(context);

      expect(mockPrismaService.pipelineAutomation.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: 'pipeline-123',
          trigger: AutomationTrigger.STAGE_ENTER,
          isActive: true,
          triggerStageId: 'stage-123',
        },
      });

      expect(mockAutomationQueue.add).toHaveBeenCalledWith(
        'execute',
        {
          automationId: 'automation-123',
          dealId: 'deal-123',
          context,
        },
        { delay: 0 }
      );
    });

    it('should trigger automations with delay', async () => {
      const delayedAutomation = { ...mockAutomation, delay: 5 }; // 5 minutes
      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      mockPrismaService.pipelineAutomation.findMany.mockResolvedValue([delayedAutomation]);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await service.triggerAutomations(context);

      expect(mockAutomationQueue.add).toHaveBeenCalledWith(
        'execute',
        expect.any(Object),
        { delay: 300000 } // 5 minutes in ms
      );
    });

    it('should handle deal update trigger', async () => {
      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        previousValue: 500,
        newValue: 1000,
        userId: 'user-123',
      };

      const updateAutomation = { ...mockAutomation, trigger: AutomationTrigger.DEAL_UPDATE };
      mockPrismaService.pipelineAutomation.findMany.mockResolvedValue([updateAutomation]);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await service.triggerAutomations(context);

      expect(mockPrismaService.pipelineAutomation.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: 'pipeline-123',
          trigger: AutomationTrigger.DEAL_UPDATE,
          isActive: true,
        },
      });
    });

    it('should not trigger automations if conditions are not met', async () => {
      const automationWithConditions = {
        ...mockAutomation,
        conditions: {
          minValue: 5000,
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      mockPrismaService.pipelineAutomation.findMany.mockResolvedValue([automationWithConditions]);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      await service.triggerAutomations(context);

      expect(mockAutomationQueue.add).not.toHaveBeenCalled();
    });
  });

  describe('executeAutomation', () => {
    it('should execute email action', async () => {
      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      const mockLog = { id: 'log-123', status: 'PENDING' };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(mockAutomation);
      mockPrismaService.automationLog.create.mockResolvedValue(mockLog);
      mockPrismaService.automationLog.update.mockResolvedValue({ ...mockLog, status: 'SUCCESS' });
      mockPrismaService.deal.findUnique.mockResolvedValue({
        ...mockDeal,
        contact: { email: 'contact@example.com', firstName: 'John', lastName: 'Doe' },
        owner: { email: 'owner@example.com', firstName: 'Jane', lastName: 'Smith' },
      });
      mockEmailService.sendEmail.mockResolvedValue(true);

      await service.executeAutomation('automation-123', 'deal-123', context);

      expect(mockPrismaService.automationLog.create).toHaveBeenCalled();
      expect(mockEmailService.sendEmail).toHaveBeenCalled();
      expect(mockPrismaService.automationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: {
          status: 'SUCCESS',
          executedAt: expect.any(Date),
          results: expect.any(Array),
        },
      });
    });

    it('should handle inactive automation', async () => {
      const inactiveAutomation = { ...mockAutomation, isActive: false };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(inactiveAutomation);

      await service.executeAutomation('automation-123', 'deal-123', {} as any);

      expect(mockPrismaService.automationLog.create).not.toHaveBeenCalled();
    });

    it('should handle action errors', async () => {
      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      const mockLog = { id: 'log-123', status: 'PENDING' };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(mockAutomation);
      mockPrismaService.automationLog.create.mockResolvedValue(mockLog);
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockEmailService.sendEmail.mockRejectedValue(new Error('Email failed'));

      await service.executeAutomation('automation-123', 'deal-123', context);

      expect(mockPrismaService.automationLog.update).toHaveBeenCalledWith({
        where: { id: 'log-123' },
        data: {
          status: 'FAILED',
          actions: expect.arrayContaining([
            expect.objectContaining({
              success: false,
              error: 'Email failed',
            }),
          ]),
          executedAt: expect.any(Date),
          completedAt: expect.any(Date),
        },
      });
    });

    it('should execute update field action', async () => {
      const updateDealAutomation = {
        ...mockAutomation,
        actions: [AutomationAction.UPDATE_FIELD],
        actionConfig: {
          field: {
            updates: {
              probability: 80,
              expectedCloseDate: '2024-12-31',
            },
          },
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        newValue: 'stage-123',
        userId: 'user-123',
      };

      const mockLog = { id: 'log-123', status: 'PENDING' };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(updateDealAutomation);
      mockPrismaService.automationLog.create.mockResolvedValue(mockLog);
      mockPrismaService.automationLog.update.mockResolvedValue({ ...mockLog, status: 'SUCCESS' });
      mockPrismaService.pipelineAutomation.update.mockResolvedValue(updateDealAutomation);
      mockPrismaService.deal.update.mockResolvedValue({ ...mockDeal, probability: 80 });

      await service.executeAutomation('automation-123', 'deal-123', context);

      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: 'deal-123' },
        data: {
          probability: 80,
          expectedCloseDate: '2024-12-31',
        },
      });
    });

    it('should execute move to stage action', async () => {
      const moveStageAutomation = {
        ...mockAutomation,
        actions: [
          {
            type: AutomationAction.MOVE_TO_STAGE,
            config: {
              stageId: 'stage-456',
            },
          },
        ],
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        userId: 'user-123',
      };

      const mockLog = { id: 'log-123', status: 'PENDING' };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(moveStageAutomation);
      mockPrismaService.automationLog.create.mockResolvedValue(mockLog);
      mockDealsService.update.mockResolvedValue({ ...mockDeal, stageId: 'stage-456' });

      await service.executeAutomation('automation-123', 'deal-123', context);

      expect(mockDealsService.update).toHaveBeenCalledWith(
        'deal-123',
        { stageId: 'stage-456' },
        'user-123',
        true
      );
    });

    it('should execute assign to user action', async () => {
      const assignUserAutomation = {
        ...mockAutomation,
        actions: [
          {
            type: AutomationAction.ASSIGN_TO_USER,
            config: {
              userId: 'user-456',
            },
          },
        ],
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.STAGE_ENTER,
        userId: 'user-123',
      };

      const mockLog = { id: 'log-123', status: 'PENDING' };
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(assignUserAutomation);
      mockPrismaService.automationLog.create.mockResolvedValue(mockLog);
      mockPrismaService.user.findUnique.mockResolvedValue({ id: 'user-456' });
      mockDealsService.update.mockResolvedValue({ ...mockDeal, ownerId: 'user-456' });

      await service.executeAutomation('automation-123', 'deal-123', context);

      expect(mockDealsService.update).toHaveBeenCalledWith(
        'deal-123',
        { ownerId: 'user-456' },
        'user-123',
        true
      );
    });
  });

  describe('evaluateConditions', () => {
    it('should evaluate value conditions correctly', async () => {
      const automation = {
        ...mockAutomation,
        conditions: {
          value: { operator: 'gt', value: 500 },
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        userId: 'user-123',
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      const result = await (service as any).evaluateConditions(automation, context);
      expect(result).toBe(true);
    });

    it('should evaluate stage conditions correctly', async () => {
      const automation = {
        ...mockAutomation,
        conditions: {
          stage: { stageIds: ['stage-123', 'stage-456'] },
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        userId: 'user-123',
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      const result = await (service as any).evaluateConditions(automation, context);
      expect(result).toBe(true);
    });

    it('should evaluate time in stage conditions correctly', async () => {
      const automation = {
        ...mockAutomation,
        conditions: {
          timeInStage: { operator: 'gt', days: 1 },
        },
      };

      const context = {
        deal: {
          ...mockDeal,
          stageEnteredAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },
        trigger: AutomationTrigger.STAGE_EXIT,
        userId: 'user-123',
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(context.deal);

      const result = await (service as any).evaluateConditions(automation, context);
      expect(result).toBe(true);
    });

    it('should evaluate multiple conditions with AND logic', async () => {
      const automation = {
        ...mockAutomation,
        conditions: {
          value: { operator: 'gt', value: 500 },
          stage: { stageIds: ['stage-123'] },
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        userId: 'user-123',
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      const result = await (service as any).evaluateConditions(automation, context);
      expect(result).toBe(true);
    });

    it('should return false if any condition fails', async () => {
      const automation = {
        ...mockAutomation,
        conditions: {
          value: { operator: 'gt', value: 5000 }, // Deal value is 1000
          stage: { stageIds: ['stage-123'] },
        },
      };

      const context = {
        deal: mockDeal,
        trigger: AutomationTrigger.DEAL_UPDATE,
        userId: 'user-123',
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);

      const result = await (service as any).evaluateConditions(automation, context);
      expect(result).toBe(false);
    });
  });

});