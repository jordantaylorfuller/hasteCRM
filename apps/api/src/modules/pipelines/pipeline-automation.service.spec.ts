import { Test, TestingModule } from '@nestjs/testing';
import { PipelineAutomationService } from './pipeline-automation.service';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { Queue } from 'bullmq';
import { getQueueToken } from '@nestjs/bullmq';
import { 
  BadRequestException, 
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AutomationTrigger, AutomationAction } from '@hasteCRM/database';

describe('PipelineAutomationService', () => {
  let service: PipelineAutomationService;
  let prismaService: PrismaService;
  let emailService: EmailService;
  let automationQueue: Queue;

  const mockPrismaService = {
    pipelineAutomation: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    deal: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    task: {
      create: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    automationLog: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockEmailService = {
    sendEmail: jest.fn(),
  };

  const mockAutomationQueue = {
    add: jest.fn(),
  };

  const mockWorkspaceId = 'workspace-123';
  const mockPipelineId = 'pipeline-123';
  const mockUserId = 'user-123';

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
          provide: getQueueToken('automation'),
          useValue: mockAutomationQueue,
        },
      ],
    }).compile();

    service = module.get<PipelineAutomationService>(PipelineAutomationService);
    prismaService = module.get<PrismaService>(PrismaService);
    emailService = module.get<EmailService>(EmailService);
    automationQueue = module.get<Queue>(getQueueToken('automation'));

    jest.clearAllMocks();
  });

  describe('createAutomation', () => {
    const createAutomationDto = {
      name: 'Test Automation',
      description: 'Test description',
      trigger: AutomationTrigger.STAGE_ENTER,
      triggerStageId: 'stage-123',
      conditions: { minValue: 10000 },
      actions: [AutomationAction.SEND_EMAIL],
      actionConfig: {
        emailTemplate: 'template-123',
        recipients: ['sales@example.com'],
      },
      isActive: true,
      delay: 300, // 5 minutes
    };

    it('should create a new automation', async () => {
      const mockAutomation = {
        id: 'automation-123',
        ...createAutomationDto,
        pipelineId: mockPipelineId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.pipelineAutomation.findFirst.mockResolvedValue(null);
      mockPrismaService.pipelineAutomation.create.mockResolvedValue(mockAutomation);

      const result = await service.createAutomation(
        mockWorkspaceId,
        mockPipelineId,
        createAutomationDto,
      );

      expect(result).toEqual(mockAutomation);
      expect(mockPrismaService.pipelineAutomation.create).toHaveBeenCalledWith({
        data: {
          pipelineId: mockPipelineId,
          ...createAutomationDto,
        },
      });
    });

    it('should throw conflict error if automation with same name exists', async () => {
      mockPrismaService.pipelineAutomation.findFirst.mockResolvedValue({
        id: 'existing-automation',
        name: createAutomationDto.name,
      });

      await expect(
        service.createAutomation(mockWorkspaceId, mockPipelineId, createAutomationDto),
      ).rejects.toThrow(ConflictException);
    });

    it('should validate trigger and action combination', async () => {
      const invalidDto = {
        ...createAutomationDto,
        trigger: AutomationTrigger.DEAL_WON,
        actions: [AutomationAction.MOVE_STAGE], // Invalid for DEAL_WON trigger
      };

      mockPrismaService.pipelineAutomation.findFirst.mockResolvedValue(null);

      await expect(
        service.createAutomation(mockWorkspaceId, mockPipelineId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require triggerStageId for stage-specific triggers', async () => {
      const invalidDto = {
        ...createAutomationDto,
        trigger: AutomationTrigger.STAGE_ENTER,
        triggerStageId: null,
      };

      mockPrismaService.pipelineAutomation.findFirst.mockResolvedValue(null);

      await expect(
        service.createAutomation(mockWorkspaceId, mockPipelineId, invalidDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateAutomation', () => {
    const automationId = 'automation-123';
    const updateDto = {
      name: 'Updated Automation',
      isActive: false,
    };

    it('should update an existing automation', async () => {
      const existingAutomation = {
        id: automationId,
        pipelineId: mockPipelineId,
        name: 'Original Automation',
        isActive: true,
      };

      const updatedAutomation = {
        ...existingAutomation,
        ...updateDto,
        updatedAt: new Date(),
      };

      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(existingAutomation);
      mockPrismaService.pipelineAutomation.update.mockResolvedValue(updatedAutomation);

      const result = await service.updateAutomation(
        mockWorkspaceId,
        mockPipelineId,
        automationId,
        updateDto,
      );

      expect(result).toEqual(updatedAutomation);
      expect(mockPrismaService.pipelineAutomation.update).toHaveBeenCalledWith({
        where: { id: automationId },
        data: updateDto,
      });
    });

    it('should throw not found error if automation does not exist', async () => {
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAutomation(mockWorkspaceId, mockPipelineId, automationId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw error if automation belongs to different pipeline', async () => {
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue({
        id: automationId,
        pipelineId: 'different-pipeline',
      });

      await expect(
        service.updateAutomation(mockWorkspaceId, mockPipelineId, automationId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteAutomation', () => {
    const automationId = 'automation-123';

    it('should delete an automation', async () => {
      const mockAutomation = {
        id: automationId,
        pipelineId: mockPipelineId,
      };

      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(mockAutomation);
      mockPrismaService.pipelineAutomation.delete.mockResolvedValue(mockAutomation);

      await service.deleteAutomation(mockWorkspaceId, mockPipelineId, automationId);

      expect(mockPrismaService.pipelineAutomation.delete).toHaveBeenCalledWith({
        where: { id: automationId },
      });
    });

    it('should throw not found error if automation does not exist', async () => {
      mockPrismaService.pipelineAutomation.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteAutomation(mockWorkspaceId, mockPipelineId, automationId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getAutomations', () => {
    it('should return all automations for a pipeline', async () => {
      const mockAutomations = [
        {
          id: 'automation-1',
          name: 'Automation 1',
          isActive: true,
          trigger: AutomationTrigger.STAGE_ENTER,
          _count: { logs: 10 },
        },
        {
          id: 'automation-2',
          name: 'Automation 2',
          isActive: false,
          trigger: AutomationTrigger.DEAL_WON,
          _count: { logs: 5 },
        },
      ];

      mockPrismaService.pipelineAutomation.findMany.mockResolvedValue(mockAutomations);

      const result = await service.getAutomations(mockWorkspaceId, mockPipelineId);

      expect(result).toEqual(mockAutomations);
      expect(mockPrismaService.pipelineAutomation.findMany).toHaveBeenCalledWith({
        where: { pipelineId: mockPipelineId },
        include: {
          _count: {
            select: { logs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should filter by active status', async () => {
      await service.getAutomations(mockWorkspaceId, mockPipelineId, true);

      expect(mockPrismaService.pipelineAutomation.findMany).toHaveBeenCalledWith({
        where: { 
          pipelineId: mockPipelineId,
          isActive: true,
        },
        include: {
          _count: {
            select: { logs: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('processAutomation', () => {
    const mockAutomation = {
      id: 'automation-123',
      name: 'Test Automation',
      trigger: AutomationTrigger.STAGE_ENTER,
      conditions: { minValue: 10000 },
      actions: [AutomationAction.SEND_EMAIL],
      actionConfig: {
        emailTemplate: 'Welcome to {{stageName}}!',
        recipients: ['{{contactEmail}}'],
      },
      delay: 0,
    };

    const mockDeal = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 15000,
      stageId: 'stage-123',
      ownerId: 'user-123',
      contact: {
        email: 'contact@example.com',
        firstName: 'John',
        lastName: 'Doe',
      },
      stage: {
        name: 'Negotiation',
      },
    };

    it('should process automation successfully', async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      await service.processAutomation(mockAutomation.id, mockDeal.id, {
        fromStageId: 'stage-old',
        toStageId: 'stage-123',
      });

      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: ['contact@example.com'],
        subject: expect.any(String),
        html: expect.stringContaining('Welcome to Negotiation!'),
        text: expect.stringContaining('Welcome to Negotiation!'),
      });

      expect(mockPrismaService.automationLog.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: {
          status: 'SUCCESS',
          executedAt: expect.any(Date),
          completedAt: expect.any(Date),
          results: expect.any(Object),
        },
      });
    });

    it('should skip automation if conditions are not met', async () => {
      const dealWithLowValue = {
        ...mockDeal,
        value: 5000, // Below minimum value condition
      };

      mockPrismaService.deal.findUnique.mockResolvedValue(dealWithLowValue);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });

      await service.processAutomation(mockAutomation.id, dealWithLowValue.id, {});

      expect(mockEmailService.sendEmail).not.toHaveBeenCalled();
      expect(mockPrismaService.automationLog.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: {
          status: 'SKIPPED',
          executedAt: expect.any(Date),
          completedAt: expect.any(Date),
          results: { reason: 'Conditions not met' },
        },
      });
    });

    it('should handle automation with delay', async () => {
      const automationWithDelay = {
        ...mockAutomation,
        delay: 300, // 5 minutes
      };

      await service.processAutomation(automationWithDelay.id, mockDeal.id, {});

      expect(mockAutomationQueue.add).toHaveBeenCalledWith(
        'process-automation',
        {
          automationId: automationWithDelay.id,
          dealId: mockDeal.id,
          context: {},
        },
        {
          delay: 300000, // 5 minutes in milliseconds
        },
      );
    });

    it('should handle automation errors', async () => {
      mockPrismaService.deal.findUnique.mockResolvedValue(mockDeal);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        return callback(mockPrismaService);
      });
      mockEmailService.sendEmail.mockRejectedValue(new Error('Email service error'));

      await service.processAutomation(mockAutomation.id, mockDeal.id, {});

      expect(mockPrismaService.automationLog.update).toHaveBeenCalledWith({
        where: { id: expect.any(String) },
        data: {
          status: 'FAILED',
          executedAt: expect.any(Date),
          completedAt: expect.any(Date),
          error: 'Email service error',
          results: expect.any(Object),
        },
      });
    });
  });

  describe('executeActions', () => {
    const mockDeal = {
      id: 'deal-123',
      title: 'Test Deal',
      value: 15000,
      stageId: 'stage-123',
      ownerId: 'user-123',
      workspaceId: mockWorkspaceId,
    };

    it('should execute SEND_EMAIL action', async () => {
      const config = {
        emailTemplate: 'Hello {{dealTitle}}!',
        recipients: ['sales@example.com'],
      };

      mockEmailService.sendEmail.mockResolvedValue({ success: true });

      const result = await service['executeAction'](
        AutomationAction.SEND_EMAIL,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockEmailService.sendEmail).toHaveBeenCalledWith({
        to: ['sales@example.com'],
        subject: expect.any(String),
        html: expect.stringContaining('Hello Test Deal!'),
        text: expect.stringContaining('Hello Test Deal!'),
      });
    });

    it('should execute CREATE_TASK action', async () => {
      const config = {
        taskTitle: 'Follow up on {{dealTitle}}',
        taskDescription: 'Deal value: {{dealValue}}',
        dueInDays: 3,
        assignToOwner: true,
      };

      const mockTask = {
        id: 'task-123',
        title: 'Follow up on Test Deal',
        description: 'Deal value: 15000',
      };

      mockPrismaService.task.create.mockResolvedValue(mockTask);

      const result = await service['executeAction'](
        AutomationAction.CREATE_TASK,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(result.taskId).toBe('task-123');
      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: {
          workspaceId: mockWorkspaceId,
          title: 'Follow up on Test Deal',
          description: 'Deal value: 15000',
          dueDate: expect.any(Date),
          assignedToId: mockDeal.ownerId,
          dealId: mockDeal.id,
          status: 'TODO',
          priority: 'MEDIUM',
        },
      });
    });

    it('should execute UPDATE_FIELD action', async () => {
      const config = {
        field: 'probability',
        value: 80,
      };

      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        probability: 80,
      });

      const result = await service['executeAction'](
        AutomationAction.UPDATE_FIELD,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: mockDeal.id },
        data: { probability: 80 },
      });
    });

    it('should execute ADD_TAG action', async () => {
      const config = {
        tagId: 'tag-123',
      };

      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        tags: [{ id: 'tag-123' }],
      });

      const result = await service['executeAction'](
        AutomationAction.ADD_TAG,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: mockDeal.id },
        data: {
          tags: {
            connect: { id: 'tag-123' },
          },
        },
      });
    });

    it('should execute ASSIGN_OWNER action', async () => {
      const config = {
        userId: 'new-owner-123',
      };

      mockPrismaService.deal.update.mockResolvedValue({
        ...mockDeal,
        ownerId: 'new-owner-123',
      });

      const result = await service['executeAction'](
        AutomationAction.ASSIGN_OWNER,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.deal.update).toHaveBeenCalledWith({
        where: { id: mockDeal.id },
        data: { ownerId: 'new-owner-123' },
      });
    });

    it('should execute CREATE_ACTIVITY action', async () => {
      const config = {
        activityType: 'NOTE_ADDED',
        title: 'Automation triggered for {{dealTitle}}',
        description: 'Deal entered new stage',
      };

      mockPrismaService.activity.create.mockResolvedValue({
        id: 'activity-123',
        title: 'Automation triggered for Test Deal',
      });

      const result = await service['executeAction'](
        AutomationAction.CREATE_ACTIVITY,
        mockDeal,
        config,
        {},
      );

      expect(result.success).toBe(true);
      expect(mockPrismaService.activity.create).toHaveBeenCalled();
    });

    it('should handle unsupported action', async () => {
      const result = await service['executeAction'](
        'UNSUPPORTED_ACTION' as any,
        mockDeal,
        {},
        {},
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported action');
    });
  });

  describe('validateTrigger', () => {
    it('should validate stage entry trigger', async () => {
      const automation = {
        trigger: AutomationTrigger.STAGE_ENTER,
        triggerStageId: 'stage-123',
      };

      const context = {
        fromStageId: 'stage-old',
        toStageId: 'stage-123',
      };

      const result = await service['validateTrigger'](automation, context);
      expect(result).toBe(true);
    });

    it('should validate stage exit trigger', async () => {
      const automation = {
        trigger: AutomationTrigger.STAGE_EXIT,
        triggerStageId: 'stage-123',
      };

      const context = {
        fromStageId: 'stage-123',
        toStageId: 'stage-new',
      };

      const result = await service['validateTrigger'](automation, context);
      expect(result).toBe(true);
    });

    it('should validate deal status triggers', async () => {
      const wonAutomation = {
        trigger: AutomationTrigger.DEAL_WON,
      };

      const wonContext = {
        dealStatus: 'WON',
        previousStatus: 'OPEN',
      };

      expect(await service['validateTrigger'](wonAutomation, wonContext)).toBe(true);

      const lostContext = {
        dealStatus: 'LOST',
        previousStatus: 'OPEN',
      };

      expect(await service['validateTrigger'](wonAutomation, lostContext)).toBe(false);
    });

    it('should validate value changed trigger', async () => {
      const automation = {
        trigger: AutomationTrigger.VALUE_CHANGED,
      };

      const context = {
        previousValue: 10000,
        currentValue: 15000,
      };

      const result = await service['validateTrigger'](automation, context);
      expect(result).toBe(true);
    });

    it('should return false for invalid trigger context', async () => {
      const automation = {
        trigger: AutomationTrigger.STAGE_ENTER,
        triggerStageId: 'stage-123',
      };

      const context = {
        toStageId: 'different-stage',
      };

      const result = await service['validateTrigger'](automation, context);
      expect(result).toBe(false);
    });
  });

  describe('checkConditions', () => {
    const mockDeal = {
      value: 15000,
      probability: 75,
      owner: { id: 'user-123' },
      tags: [{ id: 'tag-1' }, { id: 'tag-2' }],
      customFields: [
        { fieldId: 'field-1', value: 'high-priority' },
      ],
    };

    it('should check minimum value condition', () => {
      const conditions = { minValue: 10000 };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const highConditions = { minValue: 20000 };
      expect(service['checkConditions'](highConditions, mockDeal)).toBe(false);
    });

    it('should check maximum value condition', () => {
      const conditions = { maxValue: 20000 };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const lowConditions = { maxValue: 10000 };
      expect(service['checkConditions'](lowConditions, mockDeal)).toBe(false);
    });

    it('should check probability condition', () => {
      const conditions = { minProbability: 70 };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const highConditions = { minProbability: 80 };
      expect(service['checkConditions'](highConditions, mockDeal)).toBe(false);
    });

    it('should check owner condition', () => {
      const conditions = { ownerId: 'user-123' };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const differentOwner = { ownerId: 'user-456' };
      expect(service['checkConditions'](differentOwner, mockDeal)).toBe(false);
    });

    it('should check tag conditions', () => {
      const conditions = { hasAnyTag: ['tag-1', 'tag-3'] };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const noMatchingTags = { hasAnyTag: ['tag-3', 'tag-4'] };
      expect(service['checkConditions'](noMatchingTags, mockDeal)).toBe(false);

      const hasAllTags = { hasAllTags: ['tag-1', 'tag-2'] };
      expect(service['checkConditions'](hasAllTags, mockDeal)).toBe(true);

      const missingTag = { hasAllTags: ['tag-1', 'tag-3'] };
      expect(service['checkConditions'](missingTag, mockDeal)).toBe(false);
    });

    it('should check custom field conditions', () => {
      const conditions = {
        customFields: [
          { fieldId: 'field-1', value: 'high-priority' },
        ],
      };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const wrongValue = {
        customFields: [
          { fieldId: 'field-1', value: 'low-priority' },
        ],
      };
      expect(service['checkConditions'](wrongValue, mockDeal)).toBe(false);
    });

    it('should check multiple conditions (AND logic)', () => {
      const conditions = {
        minValue: 10000,
        minProbability: 70,
        ownerId: 'user-123',
      };
      expect(service['checkConditions'](conditions, mockDeal)).toBe(true);

      const oneFailingCondition = {
        minValue: 10000,
        minProbability: 80, // This fails
        ownerId: 'user-123',
      };
      expect(service['checkConditions'](oneFailingCondition, mockDeal)).toBe(false);
    });

    it('should return true if no conditions specified', () => {
      expect(service['checkConditions']({}, mockDeal)).toBe(true);
      expect(service['checkConditions'](null, mockDeal)).toBe(true);
    });
  });

  describe('interpolateTemplate', () => {
    const context = {
      dealTitle: 'Big Enterprise Deal',
      dealValue: 50000,
      contactName: 'John Doe',
      contactEmail: 'john@example.com',
      stageName: 'Negotiation',
      ownerName: 'Jane Smith',
    };

    it('should interpolate single variable', () => {
      const template = 'Deal: {{dealTitle}}';
      const result = service['interpolateTemplate'](template, context);
      expect(result).toBe('Deal: Big Enterprise Deal');
    });

    it('should interpolate multiple variables', () => {
      const template = '{{contactName}} - {{dealTitle}} (${{dealValue}})';
      const result = service['interpolateTemplate'](template, context);
      expect(result).toBe('John Doe - Big Enterprise Deal ($50000)');
    });

    it('should handle missing variables', () => {
      const template = '{{missingVar}} - {{dealTitle}}';
      const result = service['interpolateTemplate'](template, context);
      expect(result).toBe(' - Big Enterprise Deal');
    });

    it('should handle nested objects', () => {
      const nestedContext = {
        deal: {
          title: 'Nested Deal',
          contact: {
            name: 'Nested Contact',
          },
        },
      };
      
      const template = '{{deal.title}} - {{deal.contact.name}}';
      const result = service['interpolateTemplate'](template, nestedContext);
      expect(result).toBe('Nested Deal - Nested Contact');
    });

    it('should handle arrays in template', () => {
      const template = '{{contactEmail}}';
      const arrayContext = {
        contactEmail: ['john@example.com', 'jane@example.com'],
      };
      
      const result = service['interpolateTemplate'](template, arrayContext);
      expect(result).toBe('john@example.com,jane@example.com');
    });

    it('should return original template if no context', () => {
      const template = 'Hello {{name}}!';
      expect(service['interpolateTemplate'](template, null)).toBe(template);
      expect(service['interpolateTemplate'](template, {})).toBe('Hello !');
    });
  });
});