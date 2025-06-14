import {
  Injectable,
  NotFoundException,
  ConflictException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { Pipeline, Stage, PipelineType, Prisma } from "../prisma/prisma-client";

@Injectable()
export class PipelinesService {
  constructor(private prisma: PrismaService) {}

  async create(
    workspaceId: string,
    data: {
      name: string;
      type?: PipelineType;
      color?: string;
      stages?: Array<{
        name: string;
        order: number;
        color?: string;
        probability?: number;
      }>;
    },
  ): Promise<Pipeline> {
    // Check if pipeline name already exists
    const existing = await this.prisma.pipeline.findUnique({
      where: {
        workspaceId_name: {
          workspaceId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException("Pipeline with this name already exists");
    }

    // Get the next order number
    const maxOrder = await this.prisma.pipeline.findFirst({
      where: { workspaceId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const order = (maxOrder?.order ?? -1) + 1;

    // Create pipeline with default stages if not provided
    const defaultStages = data.stages || this.getDefaultStages(data.type);

    return this.prisma.pipeline.create({
      data: {
        workspaceId,
        name: data.name,
        type: data.type || PipelineType.SALES,
        color: data.color || "#4F46E5",
        order,
        stages: {
          create: defaultStages,
        },
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { deals: true },
        },
      },
    });
  }

  async findAll(workspaceId: string): Promise<Pipeline[]> {
    return this.prisma.pipeline.findMany({
      where: {
        workspaceId,
        deletedAt: null,
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { deals: true },
        },
      },
      orderBy: { order: "asc" },
    });
  }

  async findOne(id: string): Promise<Pipeline> {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { deals: true },
        },
      },
    });

    if (!pipeline || pipeline.deletedAt) {
      throw new NotFoundException("Pipeline not found");
    }

    return pipeline;
  }

  async update(
    id: string,
    data: {
      name?: string;
      color?: string;
      settings?: any;
    },
  ): Promise<Pipeline> {
    const pipeline = await this.findOne(id);

    // Check if new name conflicts
    if (data.name && data.name !== pipeline.name) {
      const existing = await this.prisma.pipeline.findUnique({
        where: {
          workspaceId_name: {
            workspaceId: pipeline.workspaceId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException("Pipeline with this name already exists");
      }
    }

    return this.prisma.pipeline.update({
      where: { id },
      data: {
        name: data.name,
        color: data.color,
        settings: data.settings,
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { deals: true },
        },
      },
    });
  }

  async delete(id: string): Promise<Pipeline> {
    await this.findOne(id);

    // Check if pipeline has deals
    const dealCount = await this.prisma.deal.count({
      where: { pipelineId: id },
    });

    if (dealCount > 0) {
      // Soft delete if has deals
      return this.prisma.pipeline.update({
        where: { id },
        data: { deletedAt: new Date() },
        include: {
          stages: {
            orderBy: { order: "asc" },
          },
          _count: {
            select: { deals: true },
          },
        },
      });
    }

    // Hard delete if no deals
    return this.prisma.pipeline.delete({
      where: { id },
      include: {
        stages: {
          orderBy: { order: "asc" },
        },
        _count: {
          select: { deals: true },
        },
      },
    });
  }

  async reorderPipelines(
    workspaceId: string,
    pipelineIds: string[],
  ): Promise<Pipeline[]> {
    // Validate all pipelines belong to workspace
    const pipelines = await this.prisma.pipeline.findMany({
      where: {
        id: { in: pipelineIds },
        workspaceId,
      },
    });

    if (pipelines.length !== pipelineIds.length) {
      throw new NotFoundException("One or more pipelines not found");
    }

    // Update order
    const updates = pipelineIds.map((id, index) =>
      this.prisma.pipeline.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.findAll(workspaceId);
  }

  // Stage management
  async createStage(
    pipelineId: string,
    data: {
      name: string;
      color?: string;
      probability?: number;
    },
  ): Promise<Stage> {
    await this.findOne(pipelineId);

    // Check if stage name already exists
    const existing = await this.prisma.stage.findUnique({
      where: {
        pipelineId_name: {
          pipelineId,
          name: data.name,
        },
      },
    });

    if (existing) {
      throw new ConflictException("Stage with this name already exists");
    }

    // Get the next order number
    const maxOrder = await this.prisma.stage.findFirst({
      where: { pipelineId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    const order = (maxOrder?.order ?? -1) + 1;

    return this.prisma.stage.create({
      data: {
        pipelineId,
        name: data.name,
        color: data.color || "#6B7280",
        probability: data.probability || 0,
        order,
      },
    });
  }

  async updateStage(
    stageId: string,
    data: {
      name?: string;
      color?: string;
      probability?: number;
    },
  ): Promise<Stage> {
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException("Stage not found");
    }

    // Check if new name conflicts
    if (data.name && data.name !== stage.name) {
      const existing = await this.prisma.stage.findUnique({
        where: {
          pipelineId_name: {
            pipelineId: stage.pipelineId,
            name: data.name,
          },
        },
      });

      if (existing) {
        throw new ConflictException("Stage with this name already exists");
      }
    }

    return this.prisma.stage.update({
      where: { id: stageId },
      data,
    });
  }

  async deleteStage(stageId: string): Promise<Stage> {
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
    });

    if (!stage) {
      throw new NotFoundException("Stage not found");
    }

    // Check if stage has deals
    const dealCount = await this.prisma.deal.count({
      where: { stageId },
    });

    if (dealCount > 0) {
      throw new ConflictException(
        "Cannot delete stage with deals. Move or delete deals first.",
      );
    }

    // Delete stage and reorder remaining stages
    const deleted = await this.prisma.stage.delete({
      where: { id: stageId },
    });

    // Reorder remaining stages
    await this.prisma.stage.updateMany({
      where: {
        pipelineId: stage.pipelineId,
        order: { gt: stage.order },
      },
      data: {
        order: { decrement: 1 },
      },
    });

    return deleted;
  }

  async reorderStages(
    pipelineId: string,
    stageIds: string[],
  ): Promise<Stage[]> {
    // Validate all stages belong to pipeline
    const stages = await this.prisma.stage.findMany({
      where: {
        id: { in: stageIds },
        pipelineId,
      },
    });

    if (stages.length !== stageIds.length) {
      throw new NotFoundException("One or more stages not found");
    }

    // Update order
    const updates = stageIds.map((id, index) =>
      this.prisma.stage.update({
        where: { id },
        data: { order: index },
      }),
    );

    await this.prisma.$transaction(updates);

    return this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });
  }

  // Analytics
  async getPipelineMetrics(
    pipelineId: string,
    dateRange?: { start: Date; end: Date },
  ): Promise<any> {
    const pipeline = await this.findOne(pipelineId);

    const whereClause: Prisma.DealWhereInput = {
      pipelineId,
      ...(dateRange && {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      }),
    };

    const [totalDeals, wonDeals, lostDeals, openDeals, stageMetrics] =
      await Promise.all([
        this.prisma.deal.count({ where: whereClause }),
        this.prisma.deal.count({
          where: { ...whereClause, status: "WON" },
        }),
        this.prisma.deal.count({
          where: { ...whereClause, status: "LOST" },
        }),
        this.prisma.deal.count({
          where: { ...whereClause, status: "OPEN" },
        }),
        this.prisma.deal.groupBy({
          by: ["stageId"],
          where: { ...whereClause, status: "OPEN" },
          _count: true,
          _sum: {
            value: true,
          },
        }),
      ]);

    const stages = await this.prisma.stage.findMany({
      where: { pipelineId },
      orderBy: { order: "asc" },
    });

    const stageData = stages.map((stage) => {
      const metric = stageMetrics.find((m) => m.stageId === stage.id);
      return {
        id: stage.id,
        name: stage.name,
        count: metric?._count || 0,
        value: metric?._sum?.value || 0,
        probability: stage.probability,
      };
    });

    const conversionRate = totalDeals > 0 ? (wonDeals / totalDeals) * 100 : 0;
    const avgDealSize = await this.prisma.deal.aggregate({
      where: { ...whereClause, status: "WON" },
      _avg: { value: true },
    });

    return {
      pipeline,
      metrics: {
        total: totalDeals,
        won: wonDeals,
        lost: lostDeals,
        open: openDeals,
        conversionRate: Math.round(conversionRate * 100) / 100,
        avgDealSize: avgDealSize._avg?.value || 0,
      },
      stages: stageData,
    };
  }

  private getDefaultStages(type?: PipelineType) {
    const stagesByType = {
      SALES: [
        { name: "Lead", order: 0, color: "#6B7280", probability: 0 },
        { name: "Qualified", order: 1, color: "#3B82F6", probability: 20 },
        { name: "Proposal", order: 2, color: "#8B5CF6", probability: 50 },
        { name: "Negotiation", order: 3, color: "#F59E0B", probability: 80 },
        { name: "Closed Won", order: 4, color: "#10B981", probability: 100 },
      ],
      INVESTOR: [
        { name: "Research", order: 0, color: "#6B7280", probability: 0 },
        {
          name: "Initial Contact",
          order: 1,
          color: "#3B82F6",
          probability: 10,
        },
        { name: "Due Diligence", order: 2, color: "#8B5CF6", probability: 30 },
        { name: "Term Sheet", order: 3, color: "#F59E0B", probability: 60 },
        { name: "Closing", order: 4, color: "#10B981", probability: 90 },
      ],
      RECRUITING: [
        { name: "Applied", order: 0, color: "#6B7280", probability: 0 },
        { name: "Screening", order: 1, color: "#3B82F6", probability: 20 },
        { name: "Interview", order: 2, color: "#8B5CF6", probability: 40 },
        { name: "Final Round", order: 3, color: "#F59E0B", probability: 70 },
        { name: "Offer", order: 4, color: "#10B981", probability: 90 },
      ],
      VENDOR: [
        { name: "Discovery", order: 0, color: "#6B7280", probability: 0 },
        { name: "Evaluation", order: 1, color: "#3B82F6", probability: 25 },
        { name: "Negotiation", order: 2, color: "#F59E0B", probability: 50 },
        { name: "Contract", order: 3, color: "#10B981", probability: 75 },
      ],
      PARTNER: [
        { name: "Identified", order: 0, color: "#6B7280", probability: 0 },
        { name: "Discussions", order: 1, color: "#3B82F6", probability: 30 },
        {
          name: "Agreement Draft",
          order: 2,
          color: "#F59E0B",
          probability: 60,
        },
        { name: "Signed", order: 3, color: "#10B981", probability: 100 },
      ],
      CUSTOM: [
        { name: "Stage 1", order: 0, color: "#6B7280", probability: 0 },
        { name: "Stage 2", order: 1, color: "#3B82F6", probability: 33 },
        { name: "Stage 3", order: 2, color: "#F59E0B", probability: 66 },
        { name: "Stage 4", order: 3, color: "#10B981", probability: 100 },
      ],
    };

    return stagesByType[type || "SALES"] || stagesByType.CUSTOM;
  }
}
