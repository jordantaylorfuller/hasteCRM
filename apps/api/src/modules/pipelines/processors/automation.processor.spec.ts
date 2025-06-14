import { Test, TestingModule } from '@nestjs/testing';
import { AutomationProcessor } from './automation.processor';
import { PipelineAutomationService } from '../pipeline-automation.service';
import { Job } from 'bullmq';
import { AutomationTrigger } from '@hasteCRM/database';

describe('AutomationProcessor', () => {
  let processor: AutomationProcessor;
  let automationService: PipelineAutomationService;

  const mockAutomationService = {
    executeAutomation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutomationProcessor,
        {
          provide: PipelineAutomationService,
          useValue: mockAutomationService,
        },
      ],
    }).compile();

    processor = module.get<AutomationProcessor>(AutomationProcessor);
    automationService = module.get<PipelineAutomationService>(PipelineAutomationService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('should process execute job successfully', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'execute',
        data: {
          automationId: 'automation-123',
          dealId: 'deal-123',
          context: {
            deal: { id: 'deal-123' },
            trigger: AutomationTrigger.STAGE_ENTER,
            userId: 'user-123',
          },
        },
      } as Job;

      mockAutomationService.executeAutomation.mockResolvedValue(undefined);

      await processor.process(mockJob);

      expect(mockAutomationService.executeAutomation).toHaveBeenCalledWith(
        'automation-123',
        'deal-123',
        mockJob.data.context
      );
    });

    it('should throw error for unknown job type', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'unknown',
        data: {},
      } as Job;

      await expect(processor.process(mockJob)).rejects.toThrow('Unknown job type: unknown');
    });

    it('should handle execution errors', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'execute',
        data: {
          automationId: 'automation-123',
          dealId: 'deal-123',
          context: {
            deal: { id: 'deal-123' },
            trigger: AutomationTrigger.DEAL_UPDATE,
            userId: 'user-123',
          },
        },
      } as Job;

      const error = new Error('Execution failed');
      mockAutomationService.executeAutomation.mockRejectedValue(error);

      // Mock logger.error to prevent output in tests
      const loggerErrorSpy = jest.spyOn(processor['logger'], 'error').mockImplementation();

      await expect(processor.process(mockJob)).rejects.toThrow(error);

      expect(mockAutomationService.executeAutomation).toHaveBeenCalled();
      expect(loggerErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to execute automation'),
        error
      );

      loggerErrorSpy.mockRestore();
    });

    it('should log successful execution', async () => {
      const mockJob = {
        id: 'job-123',
        name: 'execute',
        data: {
          automationId: 'automation-123',
          dealId: 'deal-123',
          context: {
            deal: { id: 'deal-123' },
            trigger: AutomationTrigger.TIME_BASED,
            userId: 'user-123',
          },
        },
      } as Job;

      mockAutomationService.executeAutomation.mockResolvedValue(undefined);

      // Mock logger.log to verify logging
      const loggerLogSpy = jest.spyOn(processor['logger'], 'log').mockImplementation();

      await processor.process(mockJob);

      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Processing automation job job-123')
      );
      expect(loggerLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully executed automation automation-123 for deal deal-123')
      );

      loggerLogSpy.mockRestore();
    });
  });
});