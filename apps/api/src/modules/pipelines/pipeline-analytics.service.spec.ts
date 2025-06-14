import { Test, TestingModule } from '@nestjs/testing';
import { PipelineAnalyticsService } from './pipeline-analytics.service';
import { PrismaService } from '../prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

describe('PipelineAnalyticsService', () => {
  let service: PipelineAnalyticsService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    pipeline: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    deal: {
      findMany: jest.fn(),
      count: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    stage: {
      findMany: jest.fn(),
    },
    dealStageTransition: {
      findMany: jest.fn(),
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    pipelineMetrics: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockPipelineId = 'pipeline-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelineAnalyticsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PipelineAnalyticsService>(PipelineAnalyticsService);
    prismaService = module.get<PrismaService>(PrismaService);
    
    jest.clearAllMocks();
  });

  describe('calculateFunnelMetrics', () => {
    const mockPipeline = {
      id: mockPipelineId,
      name: 'Sales Pipeline',
      stages: [
        { id: 'stage-1', name: 'Lead', order: 0 },
        { id: 'stage-2', name: 'Qualified', order: 1 },
        { id: 'stage-3', name: 'Proposal', order: 2 },
        { id: 'stage-4', name: 'Closed', order: 3 },
      ],
    };

    it('should calculate funnel metrics for all stages', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          stageId: 'stage-1',
          stageTransitions: [
            { fromStageId: null, toStageId: 'stage-1' },
            { fromStageId: 'stage-1', toStageId: 'stage-2' },
          ],
        },
        {
          id: 'deal-2',
          stageId: 'stage-2',
          stageTransitions: [
            { fromStageId: null, toStageId: 'stage-1' },
            { fromStageId: 'stage-1', toStageId: 'stage-2' },
            { fromStageId: 'stage-2', toStageId: 'stage-3' },
          ],
        },
        {
          id: 'deal-3',
          stageId: 'stage-4',
          status: 'WON',
          stageTransitions: [
            { fromStageId: null, toStageId: 'stage-1' },
            { fromStageId: 'stage-1', toStageId: 'stage-2' },
            { fromStageId: 'stage-2', toStageId: 'stage-3' },
            { fromStageId: 'stage-3', toStageId: 'stage-4' },
          ],
        },
      ];

      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateFunnelMetrics(mockPipelineId);

      expect(result).toBeDefined();
      expect(result.stages).toHaveLength(4);
      expect(result.overallConversion).toBeDefined();
      expect(mockPrismaService.pipeline.findUnique).toHaveBeenCalledWith({
        where: { id: mockPipelineId },
        include: {
          stages: {
            orderBy: { order: 'asc' },
          },
        },
      });
    });

    it('should handle date range filtering', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      await service.calculateFunnelMetrics(mockPipelineId, dateRange);

      expect(mockPrismaService.deal.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: mockPipelineId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          stageTransitions: {
            orderBy: { transitionTime: 'asc' },
          },
        },
      });
    });

    it('should throw error if pipeline not found', async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateFunnelMetrics(mockPipelineId),
      ).rejects.toThrow('Pipeline not found');
    });

    it('should handle pipeline with no deals', async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      const result = await service.calculateFunnelMetrics(mockPipelineId);

      expect(result.stages).toHaveLength(4);
      result.stages.forEach(stage => {
        expect(stage.conversionRate).toBe(0);
      });
    });
  });

  describe('calculateVelocityMetrics', () => {
    it('should calculate velocity metrics correctly', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          createdAt: new Date('2024-01-01'),
          closedAt: new Date('2024-01-15'),
          status: 'WON',
          stageTransitions: [
            {
              fromStageId: 'stage-1',
              toStageId: 'stage-2',
              timeInStage: 5 * 24 * 60, // 5 days in minutes
              transitionTime: new Date('2024-01-05'),
            },
            {
              fromStageId: 'stage-2',
              toStageId: 'stage-3',
              timeInStage: 7 * 24 * 60, // 7 days in minutes
              transitionTime: new Date('2024-01-12'),
            },
            {
              fromStageId: 'stage-3',
              toStageId: 'stage-4',
              timeInStage: 3 * 24 * 60, // 3 days in minutes
              transitionTime: new Date('2024-01-15'),
            },
          ],
        },
        {
          id: 'deal-2',
          createdAt: new Date('2024-01-05'),
          closedAt: new Date('2024-01-25'),
          status: 'WON',
          stageTransitions: [
            {
              fromStageId: 'stage-1',
              toStageId: 'stage-2',
              timeInStage: 10 * 24 * 60, // 10 days in minutes
              transitionTime: new Date('2024-01-15'),
            },
            {
              fromStageId: 'stage-2',
              toStageId: 'stage-3',
              timeInStage: 8 * 24 * 60, // 8 days in minutes
              transitionTime: new Date('2024-01-23'),
            },
            {
              fromStageId: 'stage-3',
              toStageId: 'stage-4',
              timeInStage: 2 * 24 * 60, // 2 days in minutes
              transitionTime: new Date('2024-01-25'),
            },
          ],
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result).toBeDefined();
      expect(result.averageCycleLength).toBeDefined();
      expect(result.stageVelocities).toBeDefined();
      expect(result.velocityTrend).toBeDefined();
    });

    it('should handle deals without transitions', async () => {
      const mockDeals = [
        {
          id: 'deal-1',
          createdAt: new Date('2024-01-01'),
          closedAt: new Date('2024-01-15'),
          status: 'WON',
          stageTransitions: [],
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result.averageCycleLength).toBeGreaterThan(0);
      expect(result.stageVelocities).toEqual({});
    });

    it('should handle date range filtering', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-01-31'),
      };

      mockPrismaService.deal.findMany.mockResolvedValue([]);

      await service.calculateVelocityMetrics(mockPipelineId, dateRange);

      expect(mockPrismaService.deal.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: mockPipelineId,
          status: { in: ['WON', 'LOST'] },
          closedAt: { not: null },
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          stageTransitions: {
            orderBy: { transitionTime: 'asc' },
          },
        },
      });
    });

    it('should handle no closed deals', async () => {
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result.averageCycleLength).toBe(0);
      expect(result.stageVelocities).toEqual({});
      expect(result.velocityTrend).toEqual([]);
    });
  });

  describe('calculateWinRateMetrics', () => {
    it('should calculate win rate metrics correctly', async () => {
      mockPrismaService.deal.count.mockResolvedValueOnce(100); // total
      mockPrismaService.deal.count.mockResolvedValueOnce(30); // won
      mockPrismaService.deal.count.mockResolvedValueOnce(20); // lost

      mockPrismaService.deal.aggregate
        .mockResolvedValueOnce({ _sum: { value: new Decimal(500000) } }) // total
        .mockResolvedValueOnce({ _sum: { value: new Decimal(300000) } }) // won
        .mockResolvedValueOnce({ _sum: { value: new Decimal(100000) } }); // lost

      mockPrismaService.deal.groupBy.mockResolvedValue([
        {
          stageId: 'stage-1',
          status: 'WON',
          _count: { id: 10 },
          _sum: { value: new Decimal(100000) },
        },
        {
          stageId: 'stage-2',
          status: 'WON',
          _count: { id: 15 },
          _sum: { value: new Decimal(150000) },
        },
        {
          stageId: 'stage-3',
          status: 'WON',
          _count: { id: 5 },
          _sum: { value: new Decimal(50000) },
        },
      ]);

      const result = await service.calculateWinRateMetrics(mockPipelineId);

      expect(result).toBeDefined();
      expect(result.overallWinRate).toBe(0.6); // 30 won / (30 won + 20 lost)
      expect(result.totalDeals).toBe(100);
      expect(result.wonDeals).toBe(30);
      expect(result.lostDeals).toBe(20);
      expect(result.winRateByStage).toBeDefined();
    });

    it('should handle no deals', async () => {
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.aggregate.mockResolvedValue({ _sum: { value: null } });
      mockPrismaService.deal.groupBy.mockResolvedValue([]);

      const result = await service.calculateWinRateMetrics(mockPipelineId);

      expect(result.overallWinRate).toBe(0);
      expect(result.totalDeals).toBe(0);
      expect(result.averageDealSize).toBe(0);
    });

    it('should handle date range filtering', async () => {
      const dateRange = {
        start: new Date('2024-01-01'),
        end: new Date('2024-12-31'),
      };

      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.aggregate.mockResolvedValue({ _sum: { value: null } });
      mockPrismaService.deal.groupBy.mockResolvedValue([]);

      await service.calculateWinRateMetrics(mockPipelineId, dateRange);

      expect(mockPrismaService.deal.count).toHaveBeenCalledWith({
        where: {
          pipelineId: mockPipelineId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
      });
    });
  });

  describe('getStageBottlenecks', () => {
    it('should identify stage bottlenecks', async () => {
      const mockPipeline = {
        id: mockPipelineId,
        stages: [
          { id: 'stage-1', name: 'Lead', order: 0 },
          { id: 'stage-2', name: 'Qualified', order: 1 },
          { id: 'stage-3', name: 'Proposal', order: 2 },
        ],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      
      // Mock for each stage
      mockPrismaService.deal.count.mockResolvedValueOnce(50); // stage-1
      mockPrismaService.deal.count.mockResolvedValueOnce(30); // stage-2
      mockPrismaService.deal.count.mockResolvedValueOnce(10); // stage-3

      mockPrismaService.dealStageTransition.aggregate
        .mockResolvedValueOnce({ _avg: { timeInStage: 7200 } }) // stage-1: 5 days
        .mockResolvedValueOnce({ _avg: { timeInStage: 14400 } }) // stage-2: 10 days
        .mockResolvedValueOnce({ _avg: { timeInStage: 21600 } }); // stage-3: 15 days

      mockPrismaService.dealStageTransition.groupBy
        .mockResolvedValueOnce([]) // stage-1 exit reasons
        .mockResolvedValueOnce([]) // stage-2 exit reasons
        .mockResolvedValueOnce([]); // stage-3 exit reasons

      const result = await service.getStageBottlenecks(mockPipelineId);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({
        stageId: 'stage-1',
        stageName: 'Lead',
        dealsStuck: 50,
        averageTimeInStage: 5,
      });
    });

    it('should handle pipeline not found', async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(
        service.getStageBottlenecks(mockPipelineId),
      ).rejects.toThrow('Pipeline not found');
    });

    it('should handle stages with no deals', async () => {
      const mockPipeline = {
        id: mockPipelineId,
        stages: [{ id: 'stage-1', name: 'Lead', order: 0 }],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.dealStageTransition.aggregate.mockResolvedValue({
        _avg: { timeInStage: null },
      });
      mockPrismaService.dealStageTransition.groupBy.mockResolvedValue([]);

      const result = await service.getStageBottlenecks(mockPipelineId);

      expect(result[0].dealsStuck).toBe(0);
      expect(result[0].averageTimeInStage).toBe(0);
    });
  });

  describe('calculateDailyMetrics', () => {
    it('should calculate and store daily metrics', async () => {
      const mockPipelines = [
        { id: 'pipeline-1', workspaceId: 'workspace-1' },
        { id: 'pipeline-2', workspaceId: 'workspace-2' },
      ];

      mockPrismaService.pipeline.findMany.mockResolvedValue(mockPipelines);
      
      // Mock for calculateAndStorePipelineMetrics
      mockPrismaService.deal.count.mockResolvedValue(10);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _sum: { value: new Decimal(100000) },
      });
      mockPrismaService.pipelineMetrics.deleteMany.mockResolvedValue({});
      mockPrismaService.pipelineMetrics.create.mockResolvedValue({});

      await service.calculateDailyMetrics();

      expect(mockPrismaService.pipeline.findMany).toHaveBeenCalled();
      expect(mockPrismaService.pipelineMetrics.deleteMany).toHaveBeenCalledTimes(2);
      expect(mockPrismaService.pipelineMetrics.create).toHaveBeenCalledTimes(2);
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.pipeline.findMany.mockRejectedValue(new Error('DB Error'));
      
      // Should not throw
      await expect(service.calculateDailyMetrics()).resolves.not.toThrow();
    });
  });

  describe('calculateAndStorePipelineMetrics', () => {
    it('should calculate and store pipeline metrics', async () => {
      const pipelineId = 'pipeline-123';
      const period = 'daily';
      const date = new Date('2024-01-15');

      mockPrismaService.deal.count.mockResolvedValueOnce(50); // created
      mockPrismaService.deal.count.mockResolvedValueOnce(10); // won
      mockPrismaService.deal.count.mockResolvedValueOnce(5); // lost

      mockPrismaService.deal.aggregate
        .mockResolvedValueOnce({ _sum: { value: new Decimal(500000) } }) // total
        .mockResolvedValueOnce({ _sum: { value: new Decimal(200000) } }) // won
        .mockResolvedValueOnce({ _sum: { value: new Decimal(50000) } }); // lost

      mockPrismaService.pipelineMetrics.deleteMany.mockResolvedValue({});
      mockPrismaService.pipelineMetrics.create.mockResolvedValue({});

      await service['calculateAndStorePipelineMetrics'](pipelineId, period, date);

      expect(mockPrismaService.pipelineMetrics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pipelineId,
          period,
          date,
          dealsCreated: 50,
          dealsWon: 10,
          dealsLost: 5,
          winRate: 0.67, // 10 / (10 + 5)
        }),
      });
    });

    it('should handle no deals', async () => {
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.aggregate.mockResolvedValue({ _sum: { value: null } });
      mockPrismaService.pipelineMetrics.deleteMany.mockResolvedValue({});
      mockPrismaService.pipelineMetrics.create.mockResolvedValue({});

      await service['calculateAndStorePipelineMetrics']('pipeline-123', 'daily', new Date());

      expect(mockPrismaService.pipelineMetrics.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          dealsCreated: 0,
          dealsWon: 0,
          dealsLost: 0,
          winRate: 0,
          totalValue: new Decimal(0),
        }),
      });
    });
  });
});