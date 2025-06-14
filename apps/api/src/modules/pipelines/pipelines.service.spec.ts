import { Test, TestingModule } from "@nestjs/testing";
import { PipelinesService } from "./pipelines.service";
import { PrismaService } from "../prisma/prisma.service";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { PipelineType } from "../prisma/prisma-client";

describe("PipelinesService", () => {
  let service: PipelinesService;
  let prisma: PrismaService;

  const mockPrismaService = {
    pipeline: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    stage: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    deal: {
      count: jest.fn(),
      groupBy: jest.fn(),
      aggregate: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PipelinesService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PipelinesService>(PipelinesService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    Object.values(mockPrismaService).forEach((mock) => {
      if (typeof mock === "object") {
        Object.values(mock).forEach((fn) => {
          if (typeof fn === "function") {
            (fn as jest.Mock).mockReset();
          }
        });
      } else if (typeof mock === "function") {
        (mock as jest.Mock).mockReset();
      }
    });
  });

  describe("create", () => {
    it("should create a pipeline with default stages", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Sales Pipeline",
        type: PipelineType.SALES,
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: createData.type,
        color: "#4F46E5",
        order: 0,
        stages: [
          { id: "stage-1", name: "Lead", order: 0 },
          { id: "stage-2", name: "Qualified", order: 1 },
        ],
        _count: { deals: 0 },
      });

      const result = await service.create(workspaceId, createData);

      expect(result).toHaveProperty("id", "pipeline-1");
      expect(result.stages).toHaveLength(2);
      expect(mockPrismaService.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workspaceId,
          name: createData.name,
          type: createData.type,
          order: 0,
          stages: {
            create: expect.any(Array),
          },
        }),
        include: expect.any(Object),
      });
    });

    it("should throw ConflictException if pipeline name exists", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Existing Pipeline",
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue({
        id: "existing-pipeline",
      });

      await expect(service.create(workspaceId, createData)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("findAll", () => {
    it("should return all pipelines for a workspace", async () => {
      const workspaceId = "workspace-1";
      const pipelines = [
        {
          id: "pipeline-1",
          name: "Sales",
          stages: [],
          _count: { deals: 5 },
        },
        {
          id: "pipeline-2",
          name: "Investor",
          stages: [],
          _count: { deals: 3 },
        },
      ];

      mockPrismaService.pipeline.findMany.mockResolvedValue(pipelines);

      const result = await service.findAll(workspaceId);

      expect(result).toEqual(pipelines);
      expect(mockPrismaService.pipeline.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId,
          deletedAt: null,
        },
        include: expect.any(Object),
        orderBy: { order: "asc" },
      });
    });
  });

  describe("createStage", () => {
    it("should create a new stage", async () => {
      const pipelineId = "pipeline-1";
      const stageData = {
        name: "New Stage",
        color: "#10B981",
        probability: 75,
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue({
        id: pipelineId,
        stages: [],
      });
      mockPrismaService.stage.findUnique.mockResolvedValue(null);
      mockPrismaService.stage.findFirst.mockResolvedValue({
        order: 3,
      });
      mockPrismaService.stage.create.mockResolvedValue({
        id: "stage-1",
        pipelineId,
        ...stageData,
        order: 4,
      });

      const result = await service.createStage(pipelineId, stageData);

      expect(result).toHaveProperty("id", "stage-1");
      expect(result.order).toBe(4);
      expect(mockPrismaService.stage.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          pipelineId,
          ...stageData,
          order: 4,
        }),
      });
    });
  });

  describe("deleteStage", () => {
    it("should delete a stage without deals", async () => {
      const stageId = "stage-1";
      const stage = {
        id: stageId,
        pipelineId: "pipeline-1",
        order: 2,
      };

      mockPrismaService.stage.findUnique.mockResolvedValue(stage);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.stage.delete.mockResolvedValue(stage);

      const result = await service.deleteStage(stageId);

      expect(result).toEqual(stage);
      expect(mockPrismaService.stage.updateMany).toHaveBeenCalledWith({
        where: {
          pipelineId: stage.pipelineId,
          order: { gt: stage.order },
        },
        data: {
          order: { decrement: 1 },
        },
      });
    });

    it("should throw ConflictException if stage has deals", async () => {
      const stageId = "stage-1";

      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: stageId,
      });
      mockPrismaService.deal.count.mockResolvedValue(5);

      await expect(service.deleteStage(stageId)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe("getPipelineMetrics", () => {
    it("should calculate pipeline metrics", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        name: "Sales Pipeline",
        stages: [
          { id: "stage-1", name: "Lead", probability: 0 },
          { id: "stage-2", name: "Qualified", probability: 20 },
        ],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValueOnce(100); // total
      mockPrismaService.deal.count.mockResolvedValueOnce(20); // won
      mockPrismaService.deal.count.mockResolvedValueOnce(30); // lost
      mockPrismaService.deal.count.mockResolvedValueOnce(50); // open
      mockPrismaService.deal.groupBy.mockResolvedValue([
        {
          stageId: "stage-1",
          _count: 30,
          _sum: { value: 150000 },
        },
        {
          stageId: "stage-2",
          _count: 20,
          _sum: { value: 200000 },
        },
      ]);
      mockPrismaService.stage.findMany.mockResolvedValue(pipeline.stages);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _avg: { value: 10000 },
      });

      const result = await service.getPipelineMetrics(pipelineId);

      expect(result).toHaveProperty("pipeline");
      expect(result.metrics).toEqual({
        total: 100,
        won: 20,
        lost: 30,
        open: 50,
        conversionRate: 20,
        avgDealSize: 10000,
      });
      expect(result.stages).toHaveLength(2);
    });
  });
});
