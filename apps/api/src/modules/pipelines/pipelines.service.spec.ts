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

  describe("findOne", () => {
    it("should find a pipeline by id", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        name: "Sales Pipeline",
        workspaceId: "workspace-1",
        deletedAt: null,
        stages: [],
        _count: { deals: 5 },
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);

      const result = await service.findOne(pipelineId);

      expect(result).toEqual(pipeline);
      expect(mockPrismaService.pipeline.findUnique).toHaveBeenCalledWith({
        where: { id: pipelineId },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if pipeline not found", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(service.findOne("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });

    it("should throw NotFoundException if pipeline is deleted", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue({
        id: "pipeline-1",
        deletedAt: new Date(),
      });

      await expect(service.findOne("pipeline-1")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("update", () => {
    it("should update a pipeline", async () => {
      const pipelineId = "pipeline-1";
      const updateData = {
        name: "Updated Pipeline",
        color: "#EF4444",
        settings: { autoMove: true },
      };
      const existingPipeline = {
        id: pipelineId,
        workspaceId: "workspace-1",
        name: "Original Pipeline",
        stages: [],
        _count: { deals: 5 },
      };
      const updatedPipeline = {
        ...existingPipeline,
        ...updateData,
      };

      mockPrismaService.pipeline.findUnique
        .mockResolvedValueOnce(existingPipeline) // findOne call
        .mockResolvedValueOnce(null); // name conflict check
      mockPrismaService.pipeline.update.mockResolvedValue(updatedPipeline);

      const result = await service.update(pipelineId, updateData);

      expect(result).toEqual(updatedPipeline);
      expect(mockPrismaService.pipeline.update).toHaveBeenCalledWith({
        where: { id: pipelineId },
        data: updateData,
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if pipeline not found", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(
        service.update("non-existent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if new name already exists", async () => {
      const pipelineId = "pipeline-1";
      const existingPipeline = {
        id: pipelineId,
        workspaceId: "workspace-1",
        name: "Original Pipeline",
        stages: [],
        _count: { deals: 5 },
      };

      mockPrismaService.pipeline.findUnique
        .mockResolvedValueOnce(existingPipeline) // findOne call
        .mockResolvedValueOnce({ id: "another-pipeline" }); // name conflict check

      await expect(
        service.update(pipelineId, { name: "Existing Name" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should not check name conflict if name is not changed", async () => {
      const pipelineId = "pipeline-1";
      const existingPipeline = {
        id: pipelineId,
        workspaceId: "workspace-1",
        name: "Same Name",
        stages: [],
        _count: { deals: 5 },
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValueOnce(
        existingPipeline,
      );
      mockPrismaService.pipeline.update.mockResolvedValue(existingPipeline);

      await service.update(pipelineId, { name: "Same Name" });

      // Should only call findUnique once for findOne
      expect(mockPrismaService.pipeline.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  describe("delete", () => {
    it("should soft delete pipeline with deals", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        workspaceId: "workspace-1",
        name: "Pipeline",
        stages: [],
        _count: { deals: 5 },
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValue(5);
      mockPrismaService.pipeline.update.mockResolvedValue({
        ...pipeline,
        deletedAt: new Date(),
      });

      const result = await service.delete(pipelineId);

      expect(result.deletedAt).toBeDefined();
      expect(mockPrismaService.pipeline.update).toHaveBeenCalledWith({
        where: { id: pipelineId },
        data: { deletedAt: expect.any(Date) },
        include: expect.any(Object),
      });
    });

    it("should hard delete pipeline without deals", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        workspaceId: "workspace-1",
        name: "Pipeline",
        stages: [],
        _count: { deals: 0 },
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.pipeline.delete.mockResolvedValue(pipeline);

      const result = await service.delete(pipelineId);

      expect(result).toEqual(pipeline);
      expect(mockPrismaService.pipeline.delete).toHaveBeenCalledWith({
        where: { id: pipelineId },
        include: expect.any(Object),
      });
    });

    it("should throw NotFoundException if pipeline not found", async () => {
      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);

      await expect(service.delete("non-existent")).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe("reorderPipelines", () => {
    it("should reorder pipelines", async () => {
      const workspaceId = "workspace-1";
      const pipelineIds = ["pipeline-2", "pipeline-1", "pipeline-3"];
      const pipelines = [
        { id: "pipeline-1", workspaceId },
        { id: "pipeline-2", workspaceId },
        { id: "pipeline-3", workspaceId },
      ];

      mockPrismaService.pipeline.findMany
        .mockResolvedValueOnce(pipelines) // validation
        .mockResolvedValueOnce(pipelines); // findAll return
      mockPrismaService.$transaction.mockResolvedValue(undefined);
      mockPrismaService.pipeline.update.mockImplementation(({ where }) => ({
        id: where.id,
      }));

      const result = await service.reorderPipelines(workspaceId, pipelineIds);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(pipelines);
    });

    it("should throw NotFoundException if pipeline not found", async () => {
      const workspaceId = "workspace-1";
      const pipelineIds = ["pipeline-1", "non-existent"];

      mockPrismaService.pipeline.findMany.mockResolvedValue([
        { id: "pipeline-1", workspaceId },
      ]);

      await expect(
        service.reorderPipelines(workspaceId, pipelineIds),
      ).rejects.toThrow(NotFoundException);
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

    it("should create first stage with order 0", async () => {
      const pipelineId = "pipeline-1";
      const stageData = {
        name: "First Stage",
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue({
        id: pipelineId,
        stages: [],
      });
      mockPrismaService.stage.findUnique.mockResolvedValue(null);
      mockPrismaService.stage.findFirst.mockResolvedValue(null);
      mockPrismaService.stage.create.mockResolvedValue({
        id: "stage-1",
        pipelineId,
        name: stageData.name,
        color: "#6B7280",
        probability: 0,
        order: 0,
      });

      const result = await service.createStage(pipelineId, stageData);

      expect(result.order).toBe(0);
      expect(result.color).toBe("#6B7280");
      expect(result.probability).toBe(0);
    });

    it("should throw ConflictException if stage name exists", async () => {
      const pipelineId = "pipeline-1";
      const stageData = {
        name: "Existing Stage",
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue({
        id: pipelineId,
        stages: [],
      });
      mockPrismaService.stage.findUnique.mockResolvedValue({
        id: "existing-stage",
      });

      await expect(
        service.createStage(pipelineId, stageData),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe("updateStage", () => {
    it("should update a stage", async () => {
      const stageId = "stage-1";
      const updateData = {
        name: "Updated Stage",
        color: "#EF4444",
        probability: 80,
      };
      const existingStage = {
        id: stageId,
        pipelineId: "pipeline-1",
        name: "Original Stage",
        color: "#6B7280",
        probability: 50,
      };

      mockPrismaService.stage.findUnique
        .mockResolvedValueOnce(existingStage) // initial find
        .mockResolvedValueOnce(null); // name conflict check
      mockPrismaService.stage.update.mockResolvedValue({
        ...existingStage,
        ...updateData,
      });

      const result = await service.updateStage(stageId, updateData);

      expect(result).toMatchObject(updateData);
      expect(mockPrismaService.stage.update).toHaveBeenCalledWith({
        where: { id: stageId },
        data: updateData,
      });
    });

    it("should throw NotFoundException if stage not found", async () => {
      mockPrismaService.stage.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStage("non-existent", { name: "New Name" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("should throw ConflictException if new name already exists", async () => {
      const stageId = "stage-1";
      const existingStage = {
        id: stageId,
        pipelineId: "pipeline-1",
        name: "Original Stage",
      };

      mockPrismaService.stage.findUnique
        .mockResolvedValueOnce(existingStage) // initial find
        .mockResolvedValueOnce({ id: "another-stage" }); // name conflict check

      await expect(
        service.updateStage(stageId, { name: "Existing Name" }),
      ).rejects.toThrow(ConflictException);
    });

    it("should not check name conflict if name is not changed", async () => {
      const stageId = "stage-1";
      const existingStage = {
        id: stageId,
        pipelineId: "pipeline-1",
        name: "Same Name",
      };

      mockPrismaService.stage.findUnique.mockResolvedValueOnce(existingStage);
      mockPrismaService.stage.update.mockResolvedValue(existingStage);

      await service.updateStage(stageId, { name: "Same Name" });

      // Should only call findUnique once
      expect(mockPrismaService.stage.findUnique).toHaveBeenCalledTimes(1);
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

    it("should throw NotFoundException if stage not found", async () => {
      mockPrismaService.stage.findUnique.mockResolvedValue(null);

      await expect(service.deleteStage("non-existent")).rejects.toThrow(
        NotFoundException,
      );
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

  describe("reorderStages", () => {
    it("should reorder stages", async () => {
      const pipelineId = "pipeline-1";
      const stageIds = ["stage-2", "stage-1", "stage-3"];
      const stages = [
        { id: "stage-1", pipelineId },
        { id: "stage-2", pipelineId },
        { id: "stage-3", pipelineId },
      ];

      mockPrismaService.stage.findMany
        .mockResolvedValueOnce(stages) // validation
        .mockResolvedValueOnce(stages); // return
      mockPrismaService.$transaction.mockResolvedValue(undefined);
      mockPrismaService.stage.update.mockImplementation(({ where }) => ({
        id: where.id,
      }));

      const result = await service.reorderStages(pipelineId, stageIds);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
      expect(result).toEqual(stages);
    });

    it("should throw NotFoundException if stage not found", async () => {
      const pipelineId = "pipeline-1";
      const stageIds = ["stage-1", "non-existent"];

      mockPrismaService.stage.findMany.mockResolvedValue([
        { id: "stage-1", pipelineId },
      ]);

      await expect(
        service.reorderStages(pipelineId, stageIds),
      ).rejects.toThrow(NotFoundException);
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

    it("should handle empty pipeline metrics", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        name: "Empty Pipeline",
        stages: [],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _avg: { value: null },
      });

      const result = await service.getPipelineMetrics(pipelineId);

      expect(result.metrics).toEqual({
        total: 0,
        won: 0,
        lost: 0,
        open: 0,
        conversionRate: 0,
        avgDealSize: 0,
      });
    });

    it("should calculate metrics with date range", async () => {
      const pipelineId = "pipeline-1";
      const dateRange = {
        start: new Date("2024-01-01"),
        end: new Date("2024-12-31"),
      };
      const pipeline = {
        id: pipelineId,
        name: "Sales Pipeline",
        stages: [],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValue(10);
      mockPrismaService.deal.groupBy.mockResolvedValue([]);
      mockPrismaService.stage.findMany.mockResolvedValue([]);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _avg: { value: 5000 },
      });

      await service.getPipelineMetrics(pipelineId, dateRange);

      expect(mockPrismaService.deal.count).toHaveBeenCalledWith({
        where: expect.objectContaining({
          pipelineId,
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }),
      });
    });

    it("should handle stages with missing metrics data", async () => {
      const pipelineId = "pipeline-1";
      const pipeline = {
        id: pipelineId,
        name: "Sales Pipeline",
        stages: [
          { id: "stage-1", name: "Lead", probability: 0 },
          { id: "stage-2", name: "Qualified", probability: 20 },
          { id: "stage-3", name: "Proposal", probability: 50 },
        ],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(pipeline);
      mockPrismaService.deal.count.mockResolvedValue(0);
      mockPrismaService.deal.groupBy.mockResolvedValue([
        {
          stageId: "stage-1",
          _count: 5,
          _sum: { value: 50000 },
        },
        {
          stageId: "stage-2",
          // Missing _count and _sum
        },
      ]);
      mockPrismaService.stage.findMany.mockResolvedValue(pipeline.stages);
      mockPrismaService.deal.aggregate.mockResolvedValue({
        _avg: { value: 0 },
      });

      const result = await service.getPipelineMetrics(pipelineId);

      expect(result.stages).toHaveLength(3);
      expect(result.stages[0]).toEqual({
        id: "stage-1",
        name: "Lead",
        count: 5,
        value: 50000,
        probability: 0,
      });
      expect(result.stages[1]).toEqual({
        id: "stage-2",
        name: "Qualified",
        count: 0,
        value: 0,
        probability: 20,
      });
      expect(result.stages[2]).toEqual({
        id: "stage-3",
        name: "Proposal",
        count: 0,
        value: 0,
        probability: 50,
      });
    });
  });

  describe("getDefaultStages", () => {
    it("should use default stages when creating pipeline without stages", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "New Pipeline",
        type: PipelineType.INVESTOR,
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: createData.type,
        stages: [
          { name: "Research", order: 0 },
          { name: "Initial Contact", order: 1 },
          { name: "Due Diligence", order: 2 },
          { name: "Term Sheet", order: 3 },
          { name: "Closing", order: 4 },
        ],
      });

      const result = await service.create(workspaceId, createData);

      expect(result.stages).toHaveLength(5);
      expect(result.stages[0].name).toBe("Research");
      expect(mockPrismaService.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stages: {
            create: expect.arrayContaining([
              expect.objectContaining({ name: "Research" }),
              expect.objectContaining({ name: "Initial Contact" }),
              expect.objectContaining({ name: "Due Diligence" }),
              expect.objectContaining({ name: "Term Sheet" }),
              expect.objectContaining({ name: "Closing" }),
            ]),
          },
        }),
        include: expect.any(Object),
      });
    });

    it("should use custom stages for CUSTOM type", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Custom Pipeline",
        type: PipelineType.CUSTOM,
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: createData.type,
        stages: [
          { name: "Stage 1", order: 0 },
          { name: "Stage 2", order: 1 },
          { name: "Stage 3", order: 2 },
          { name: "Stage 4", order: 3 },
        ],
      });

      const result = await service.create(workspaceId, createData);

      expect(result.stages).toHaveLength(4);
      expect(result.stages[0].name).toBe("Stage 1");
    });

    it("should use provided stages instead of defaults", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Pipeline with Custom Stages",
        type: PipelineType.SALES,
        stages: [
          { name: "Custom Lead", order: 0, color: "#FF0000", probability: 0 },
          {
            name: "Custom Qualified",
            order: 1,
            color: "#00FF00",
            probability: 50,
          },
        ],
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: createData.type,
        stages: createData.stages,
      });

      const result = await service.create(workspaceId, createData);

      expect(result.stages).toHaveLength(2);
      expect(result.stages[0].name).toBe("Custom Lead");
      expect(mockPrismaService.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stages: {
            create: createData.stages,
          },
        }),
        include: expect.any(Object),
      });
    });

    it("should use SALES as default type when type is not provided", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Pipeline without type",
        // Note: type is not provided
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: PipelineType.SALES,
        stages: [],
      });

      await service.create(workspaceId, createData);

      expect(mockPrismaService.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: PipelineType.SALES,
        }),
        include: expect.any(Object),
      });
    });

    it("should fallback to CUSTOM stages for unknown pipeline type", async () => {
      const workspaceId = "workspace-1";
      const createData = {
        name: "Unknown Type Pipeline",
        type: "UNKNOWN_TYPE" as any,
      };

      mockPrismaService.pipeline.findUnique.mockResolvedValue(null);
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);
      mockPrismaService.pipeline.create.mockResolvedValue({
        id: "pipeline-1",
        workspaceId,
        name: createData.name,
        type: createData.type,
        stages: [
          { name: "Stage 1", order: 0 },
          { name: "Stage 2", order: 1 },
          { name: "Stage 3", order: 2 },
          { name: "Stage 4", order: 3 },
        ],
      });

      const result = await service.create(workspaceId, createData);

      expect(result.stages).toHaveLength(4);
      expect(result.stages[0].name).toBe("Stage 1");
      expect(mockPrismaService.pipeline.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          stages: {
            create: expect.arrayContaining([
              expect.objectContaining({ name: "Stage 1" }),
              expect.objectContaining({ name: "Stage 2" }),
              expect.objectContaining({ name: "Stage 3" }),
              expect.objectContaining({ name: "Stage 4" }),
            ]),
          },
        }),
        include: expect.any(Object),
      });
    });
  });
});
