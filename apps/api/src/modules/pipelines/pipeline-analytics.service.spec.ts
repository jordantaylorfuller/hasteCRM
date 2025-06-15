import { Test, TestingModule } from "@nestjs/testing";
import { PipelineAnalyticsService } from "./pipeline-analytics.service";
import { PrismaService } from "../prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

describe("PipelineAnalyticsService", () => {
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
      upsert: jest.fn(),
    },
  };

  const mockPipelineId = "pipeline-123";

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

  describe("calculateFunnelMetrics", () => {
    const mockPipeline = {
      id: mockPipelineId,
      name: "Sales Pipeline",
      stages: [
        { id: "stage-1", name: "Lead", order: 0 },
        { id: "stage-2", name: "Qualified", order: 1 },
        { id: "stage-3", name: "Proposal", order: 2 },
        { id: "stage-4", name: "Closed", order: 3 },
      ],
    };

    it("should calculate funnel metrics for all stages", async () => {
      const mockDeals = [
        {
          id: "deal-1",
          stageId: "stage-1",
          stageTransitions: [
            { fromStageId: null, toStageId: "stage-1" },
            { fromStageId: "stage-1", toStageId: "stage-2" },
          ],
        },
        {
          id: "deal-2",
          stageId: "stage-2",
          stageTransitions: [
            { fromStageId: null, toStageId: "stage-1" },
            { fromStageId: "stage-1", toStageId: "stage-2" },
            { fromStageId: "stage-2", toStageId: "stage-3" },
          ],
        },
        {
          id: "deal-3",
          stageId: "stage-4",
          status: "WON",
          stageTransitions: [
            { fromStageId: null, toStageId: "stage-1" },
            { fromStageId: "stage-1", toStageId: "stage-2" },
            { fromStageId: "stage-2", toStageId: "stage-3" },
            { fromStageId: "stage-3", toStageId: "stage-4" },
          ],
        },
      ];

      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateFunnelMetrics(mockPipelineId);

      expect(result).toBeDefined();
      expect(result.funnel).toHaveLength(4);
      expect(result.totalDeals).toBe(3);
      expect(mockPrismaService.pipeline.findUnique).toHaveBeenCalledWith({
        where: { id: mockPipelineId },
        include: {
          stages: {
            orderBy: { order: "asc" },
          },
        },
      });
    });

    it("should handle date range filtering", async () => {
      const dateRange = {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
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
            orderBy: { transitionTime: "asc" },
          },
        },
      });
    });

    it("should throw error if pipeline not found", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(
        service.calculateFunnelMetrics(mockPipelineId),
      ).rejects.toThrow("Pipeline not found");
    });

    it("should handle pipeline with no deals", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(mockPipeline);
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      const result = await service.calculateFunnelMetrics(mockPipelineId);

      expect(result.funnel).toHaveLength(4);
      result.funnel.forEach((stageData) => {
        expect(stageData.conversionRate).toBe(0);
      });
    });
  });

  describe("calculateVelocityMetrics", () => {
    it("should calculate velocity metrics correctly", async () => {
      const mockDeals = [
        {
          id: "deal-1",
          createdAt: new Date("2024-01-01"),
          closedAt: new Date("2024-01-15"),
          status: "WON",
          stageTransitions: [
            {
              fromStageId: "stage-1",
              toStageId: "stage-2",
              timeInStage: 5 * 24 * 60, // 5 days in minutes
              transitionTime: new Date("2024-01-05"),
            },
            {
              fromStageId: "stage-2",
              toStageId: "stage-3",
              timeInStage: 7 * 24 * 60, // 7 days in minutes
              transitionTime: new Date("2024-01-12"),
            },
            {
              fromStageId: "stage-3",
              toStageId: "stage-4",
              timeInStage: 3 * 24 * 60, // 3 days in minutes
              transitionTime: new Date("2024-01-15"),
            },
          ],
        },
        {
          id: "deal-2",
          createdAt: new Date("2024-01-05"),
          closedAt: new Date("2024-01-25"),
          status: "WON",
          stageTransitions: [
            {
              fromStageId: "stage-1",
              toStageId: "stage-2",
              timeInStage: 10 * 24 * 60, // 10 days in minutes
              transitionTime: new Date("2024-01-15"),
            },
            {
              fromStageId: "stage-2",
              toStageId: "stage-3",
              timeInStage: 8 * 24 * 60, // 8 days in minutes
              transitionTime: new Date("2024-01-23"),
            },
            {
              fromStageId: "stage-3",
              toStageId: "stage-4",
              timeInStage: 2 * 24 * 60, // 2 days in minutes
              transitionTime: new Date("2024-01-25"),
            },
          ],
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result).toBeDefined();
      expect(result.avgCycleTime).toBeDefined();
      expect(result.stageVelocities).toBeDefined();
      expect(result.totalDealsAnalyzed).toBe(2);
    });

    it("should handle deals without transitions", async () => {
      const mockDeals = [
        {
          id: "deal-1",
          createdAt: new Date("2024-01-01"),
          closedAt: new Date("2024-01-15"),
          status: "WON",
          stageTransitions: [],
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result.avgCycleTime).toBeGreaterThan(0);
      expect(result.stageVelocities).toEqual([]);
    });

    it("should handle date range filtering", async () => {
      const dateRange = {
        start: new Date("2024-01-01"),
        end: new Date("2024-01-31"),
      };

      mockPrismaService.deal.findMany.mockResolvedValue([]);

      await service.calculateVelocityMetrics(mockPipelineId, dateRange);

      expect(mockPrismaService.deal.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: mockPipelineId,
          status: { in: ["WON", "LOST"] },
          closedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          stageTransitions: {
            orderBy: { transitionTime: "asc" },
          },
        },
      });
    });

    it("should handle no closed deals", async () => {
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      const result = await service.calculateVelocityMetrics(mockPipelineId);

      expect(result.avgCycleTime).toBe(0);
      expect(result.stageVelocities).toEqual([]);
      expect(result.totalDealsAnalyzed).toBe(0);
    });
  });

  describe("calculateWinRateMetrics", () => {
    it("should calculate win rate metrics correctly", async () => {
      const mockDeals = [
        {
          id: "deal-1",
          status: "WON",
          value: new Decimal(10000),
          owner: {
            id: "user-1",
            firstName: "John",
            lastName: "Doe",
          },
          closedAt: new Date(),
        },
        {
          id: "deal-2",
          status: "LOST",
          value: new Decimal(5000),
          owner: {
            id: "user-1",
            firstName: "John",
            lastName: "Doe",
          },
          closedAt: new Date(),
        },
      ];

      mockPrismaService.deal.findMany.mockResolvedValue(mockDeals);

      const result = await service.calculateWinRateMetrics(
        mockPipelineId,
        "owner",
      );

      expect(result).toBeDefined();
      expect(result.pipelineId).toBe(mockPipelineId);
      expect(result.groupBy).toBe("owner");
      expect(result.results).toHaveLength(1);
      expect(result.results[0].winRate).toBe(50);
      expect(result.results[0].key).toBe("John Doe");
    });

    it("should handle no deals", async () => {
      mockPrismaService.deal.findMany.mockResolvedValue([]);

      const result = await service.calculateWinRateMetrics(
        mockPipelineId,
        "owner",
      );

      expect(result.results).toEqual([]);
    });

    it("should handle date range filtering", async () => {
      const dateRange = {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      };

      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _sum: { value: null },
      });
      mockPrismaService.deal.groupBy.mockResolvedValue([]);

      await service.calculateWinRateMetrics(mockPipelineId, "owner", dateRange);

      expect(mockPrismaService.deal.findMany).toHaveBeenCalledWith({
        where: {
          pipelineId: mockPipelineId,
          status: { in: ["WON", "LOST"] },
          closedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        },
        include: {
          owner: true,
        },
      });
    });
  });

  describe("getStageBottlenecks", () => {
    it("should identify stage bottlenecks", async () => {
      const mockStages = [
        { id: "stage-1", name: "Lead", order: 0, pipelineId: mockPipelineId },
        {
          id: "stage-2",
          name: "Qualified",
          order: 1,
          pipelineId: mockPipelineId,
        },
        {
          id: "stage-3",
          name: "Proposal",
          order: 2,
          pipelineId: mockPipelineId,
        },
      ];

      mockPrismaService.stage.findMany.mockResolvedValue(mockStages);

      // Mock for each stage (current deals, avg time, stalled deals)
      mockPrismaService.deal.count
        .mockResolvedValueOnce(50) // stage-1 current
        .mockResolvedValueOnce(5) // stage-1 stalled
        .mockResolvedValueOnce(30) // stage-2 current
        .mockResolvedValueOnce(3) // stage-2 stalled
        .mockResolvedValueOnce(10) // stage-3 current
        .mockResolvedValueOnce(1); // stage-3 stalled

      mockPrismaService.dealStageTransition.aggregate
        .mockResolvedValueOnce({ _avg: { timeInStage: 7200 } }) // stage-1: 5 days
        .mockResolvedValueOnce({ _avg: { timeInStage: 14400 } }) // stage-2: 10 days
        .mockResolvedValueOnce({ _avg: { timeInStage: 21600 } }); // stage-3: 15 days

      const result = await service.getStageBottlenecks(mockPipelineId);

      expect(result.stages).toHaveLength(3);
      expect(result.stages[0]).toMatchObject({
        stage: {
          id: "stage-1",
          name: "Lead",
        },
        currentDeals: 50,
        avgTimeInStage: 5,
        stalledDeals: 5,
        isBottleneck: true, // 50 > 10
      });
    });

    it("should handle no stages", async () => {
      mockPrismaService.stage.findMany.mockResolvedValue([]);

      const result = await service.getStageBottlenecks(mockPipelineId);

      expect(result.stages).toEqual([]);
      expect(result.identifiedBottlenecks).toEqual([]);
    });

    it("should handle stages with no deals", async () => {
      const mockStages = [
        { id: "stage-1", name: "Lead", order: 0, pipelineId: mockPipelineId },
      ];

      mockPrismaService.stage.findMany.mockResolvedValue(mockStages);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.dealStageTransition.aggregate.mockResolvedValue({
        _avg: { timeInStage: null },
      });

      const result = await service.getStageBottlenecks(mockPipelineId);

      expect(result.stages[0].currentDeals).toBe(0);
      expect(result.stages[0].avgTimeInStage).toBe(0);
      expect(result.stages[0].isBottleneck).toBe(false);
    });
  });

  describe("calculateDailyMetrics", () => {
    it("should calculate and store daily metrics", async () => {
      const mockPipelines = [
        { id: "pipeline-1", workspaceId: "workspace-1" },
        { id: "pipeline-2", workspaceId: "workspace-2" },
      ];

      mockPrismaService.pipeline.findMany.mockResolvedValue(mockPipelines);

      // Mock for calculateAndStorePipelineMetrics
      mockPrismaService.deal.count.mockResolvedValue(10);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _sum: { value: new Decimal(100000) },
      });
      mockPrismaService.pipelineMetrics.upsert.mockResolvedValue({});

      await service.calculateDailyMetrics();

      expect(mockPrismaService.pipeline.findMany).toHaveBeenCalled();
      expect(mockPrismaService.pipelineMetrics.upsert).toHaveBeenCalledTimes(2);
    });

    it("should handle errors gracefully", async () => {
      mockPrismaService.pipeline.findMany.mockRejectedValue(
        new Error("DB Error"),
      );

      // Mock console.error to prevent output in tests
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // Should not throw
      await service.calculateDailyMetrics();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("calculateAndStorePipelineMetrics", () => {
    it("should calculate and store pipeline metrics", async () => {
      const pipelineId = "pipeline-123";
      const period = "daily";
      const date = new Date("2024-01-15");

      mockPrismaService.deal.count.mockResolvedValueOnce(50); // created
      mockPrismaService.deal.count.mockResolvedValueOnce(10); // won
      mockPrismaService.deal.count.mockResolvedValueOnce(5); // lost

      mockPrismaService.deal.aggregate
        .mockResolvedValueOnce({ _sum: { value: new Decimal(500000) } }) // total
        .mockResolvedValueOnce({ _sum: { value: new Decimal(200000) } }) // won
        .mockResolvedValueOnce({ _sum: { value: new Decimal(50000) } }); // lost

      mockPrismaService.pipelineMetrics.upsert.mockResolvedValue({});

      await service["calculateAndStorePipelineMetrics"](
        pipelineId,
        period,
        date,
      );

      expect(mockPrismaService.pipelineMetrics.upsert).toHaveBeenCalledWith({
        where: {
          pipelineId_period_date: {
            pipelineId,
            period,
            date,
          },
        },
        update: expect.objectContaining({
          dealsCreated: 50,
          dealsWon: 10,
          dealsLost: 5,
          winRate: 0.6666666666666666, // 10 / (10 + 5)
        }),
        create: expect.objectContaining({
          pipelineId,
          period,
          date,
          dealsCreated: 50,
          dealsWon: 10,
          dealsLost: 5,
          winRate: 0.6666666666666666, // 10 / (10 + 5)
        }),
      });
    });

    it("should handle no deals", async () => {
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _sum: { value: null },
      });
      mockPrismaService.pipelineMetrics.upsert.mockResolvedValue({});

      await service["calculateAndStorePipelineMetrics"](
        "pipeline-123",
        "daily",
        new Date(),
      );

      expect(mockPrismaService.pipelineMetrics.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        update: expect.objectContaining({
          dealsCreated: 0,
          dealsWon: 0,
          dealsLost: 0,
          winRate: 0,
          totalValue: new Decimal(0),
        }),
        create: expect.objectContaining({
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
