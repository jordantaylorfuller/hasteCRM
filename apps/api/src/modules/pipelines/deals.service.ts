import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  Deal,
  DealStatus,
  Prisma,
  AutomationTrigger,
  DealStageTransition,
  DealContact,
} from "../prisma/prisma-client";

@Injectable()
export class DealsService {
  private automationService: any;

  constructor(private prisma: PrismaService) {}

  setAutomationService(automationService: any) {
    this.automationService = automationService;
  }

  async create(
    workspaceId: string,
    data: {
      pipelineId: string;
      stageId: string;
      title: string;
      value: number;
      currency?: string;
      probability?: number;
      description?: string;
      closeDate?: Date;
      ownerId: string;
      companyId?: string;
      contactIds?: string[];
    },
  ): Promise<Deal> {
    // Verify pipeline and stage exist
    const stage = await this.prisma.stage.findUnique({
      where: { id: data.stageId },
      include: { pipeline: true },
    });

    if (!stage || stage.pipeline.id !== data.pipelineId) {
      throw new NotFoundException("Stage not found in pipeline");
    }

    // Create deal with contacts
    const deal = await this.prisma.deal.create({
      data: {
        workspaceId,
        pipelineId: data.pipelineId,
        stageId: data.stageId,
        title: data.title,
        value: data.value,
        currency: data.currency || "USD",
        probability: data.probability ?? stage.probability,
        description: data.description,
        closeDate: data.closeDate,
        ownerId: data.ownerId,
        companyId: data.companyId,
        status: DealStatus.OPEN,
        stageEnteredAt: new Date(),
        contacts: data.contactIds?.length
          ? {
              create: data.contactIds.map((contactId, index) => ({
                contactId,
                isPrimary: index === 0,
              })),
            }
          : undefined,
      },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
      },
    });

    // Create activity log
    await this.createActivity(deal.id, "DEAL_CREATED", {
      title: `Deal created: ${deal.title}`,
      description: `Deal created in ${stage.name} stage`,
    });

    // Trigger automations
    if (this.automationService) {
      await this.automationService.triggerAutomations({
        deal,
        trigger: AutomationTrigger.DEAL_CREATED,
        userId: data.ownerId,
      });
    }

    return deal;
  }

  async findAll(
    workspaceId: string,
    filters: {
      pipelineId?: string;
      stageId?: string;
      status?: string;
      ownerId?: string;
      skip: number;
      take: number;
    },
  ): Promise<{ deals: any[]; total: number; hasMore: boolean }> {
    const where: Prisma.DealWhereInput = {
      workspaceId,
      deletedAt: null,
      ...(filters.pipelineId && { pipelineId: filters.pipelineId }),
      ...(filters.stageId && { stageId: filters.stageId }),
      ...(filters.status && { status: filters.status as DealStatus }),
      ...(filters.ownerId && { ownerId: filters.ownerId }),
    };

    const [deals, total] = await Promise.all([
      this.prisma.deal.findMany({
        where,
        skip: filters.skip,
        take: filters.take,
        include: {
          pipeline: true,
          stage: true,
          owner: true,
          company: true,
          contacts: {
            include: { contact: true },
          },
          _count: {
            select: {
              activities: true,
              tasks: true,
              notes: true,
              emails: true,
            },
          },
        },
        orderBy: [{ stage: { order: "asc" } }, { createdAt: "desc" }],
      }),
      this.prisma.deal.count({ where }),
    ]);

    return {
      deals,
      total,
      hasMore: filters.skip + deals.length < total,
    };
  }

  async findOne(id: string): Promise<Deal> {
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 10,
          include: { user: true },
        },
        tasks: {
          where: { completedAt: null },
          orderBy: { dueDate: "asc" },
          take: 5,
        },
        notes: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { author: true },
        },
        emails: {
          orderBy: { sentAt: "desc" },
          take: 10,
        },
        tags: {
          include: { tag: true },
        },
        customFields: {
          include: { field: true },
        },
      },
    });

    if (!deal || deal.deletedAt) {
      throw new NotFoundException("Deal not found");
    }

    // Update days in stage and total days open
    const now = new Date();
    const daysInStage = Math.floor(
      (now.getTime() - deal.stageEnteredAt.getTime()) / (1000 * 60 * 60 * 24),
    );
    const totalDaysOpen = Math.floor(
      (now.getTime() - deal.createdAt.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (
      daysInStage !== deal.daysInStage ||
      totalDaysOpen !== deal.totalDaysOpen
    ) {
      await this.prisma.deal.update({
        where: { id },
        data: { daysInStage, totalDaysOpen },
      });
      deal.daysInStage = daysInStage;
      deal.totalDaysOpen = totalDaysOpen;
    }

    return deal;
  }

  async update(
    id: string,
    data: {
      title?: string;
      value?: number;
      currency?: string;
      probability?: number;
      description?: string;
      closeDate?: Date;
      ownerId?: string;
      companyId?: string;
      status?: DealStatus;
      wonReason?: string;
      lostReason?: string;
    },
  ): Promise<Deal> {
    const deal = await this.findOne(id);

    // Handle status changes
    let closedAt = deal.closedAt;
    if (data.status && data.status !== deal.status) {
      if (data.status === DealStatus.WON || data.status === DealStatus.LOST) {
        closedAt = new Date();

        // Require reason for won/lost
        if (data.status === DealStatus.WON && !data.wonReason) {
          throw new BadRequestException("Won reason is required");
        }
        if (data.status === DealStatus.LOST && !data.lostReason) {
          throw new BadRequestException("Lost reason is required");
        }
      } else {
        closedAt = null;
      }
    }

    const updated = await this.prisma.deal.update({
      where: { id },
      data: {
        ...data,
        closedAt,
      },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
      },
    });

    // Create activity for significant changes
    if (data.status && data.status !== deal.status) {
      await this.createActivity(id, "DEAL_UPDATED", {
        title: `Deal status changed to ${data.status}`,
        description: data.wonReason || data.lostReason || undefined,
      });

      // Trigger status change automations
      const triggers: Record<DealStatus, AutomationTrigger> = {
        WON: AutomationTrigger.DEAL_WON,
        LOST: AutomationTrigger.DEAL_LOST,
        STALLED: AutomationTrigger.DEAL_STALLED,
        OPEN: AutomationTrigger.DEAL_CREATED, // Shouldn't happen
      };

      if (triggers[data.status] && this.automationService) {
        await this.automationService.triggerAutomations({
          deal: updated,
          trigger: triggers[data.status],
          previousValue: deal.status,
          newValue: data.status,
          userId: deal.ownerId,
        });
      }
    }

    // Trigger value change automation
    if (
      data.value &&
      data.value !== deal.value.toNumber() &&
      this.automationService
    ) {
      await this.automationService.triggerAutomations({
        deal: updated,
        trigger: AutomationTrigger.VALUE_CHANGED,
        previousValue: deal.value,
        newValue: data.value,
        userId: deal.ownerId,
      });
    }

    // Trigger owner change automation
    if (
      data.ownerId &&
      data.ownerId !== deal.ownerId &&
      this.automationService
    ) {
      await this.automationService.triggerAutomations({
        deal: updated,
        trigger: AutomationTrigger.OWNER_CHANGED,
        previousValue: deal.ownerId,
        newValue: data.ownerId,
        userId: data.ownerId,
      });
    }

    return updated;
  }

  async moveToStage(
    dealId: string,
    stageId: string,
    userId: string,
    reason?: string,
  ): Promise<Deal> {
    const deal = await this.findOne(dealId);

    // Verify stage exists in same pipeline
    const stage = await this.prisma.stage.findUnique({
      where: { id: stageId },
    });

    if (!stage || stage.pipelineId !== deal.pipelineId) {
      throw new NotFoundException("Stage not found in deal pipeline");
    }

    // Don't move if already in stage
    if (deal.stageId === stageId) {
      return deal;
    }

    // Calculate time in previous stage
    const now = new Date();
    const timeInStage = Math.floor(
      (now.getTime() - deal.stageEnteredAt.getTime()) / (1000 * 60),
    ); // minutes

    // Create transition record
    await this.prisma.dealStageTransition.create({
      data: {
        dealId,
        fromStageId: deal.stageId,
        toStageId: stageId,
        transitionedById: userId,
        timeInStage,
        reason,
      },
    });

    // Update deal
    const updated = await this.prisma.deal.update({
      where: { id: dealId },
      data: {
        stageId,
        stageEnteredAt: now,
        probability: stage.probability,
      },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
      },
    });

    // Create activity
    await this.createActivity(dealId, "STAGE_CHANGED", {
      title: `Deal moved to ${stage.name}`,
      description: reason,
    });

    // Trigger stage exit automation
    if (this.automationService) {
      await this.automationService.triggerAutomations({
        deal,
        trigger: AutomationTrigger.STAGE_EXIT,
        previousValue: deal.stageId,
        newValue: stageId,
        userId,
      });

      // Trigger stage enter automation
      await this.automationService.triggerAutomations({
        deal: updated,
        trigger: AutomationTrigger.STAGE_ENTER,
        previousValue: deal.stageId,
        newValue: stageId,
        userId,
      });
    }

    return updated;
  }

  async delete(id: string): Promise<Deal> {
    await this.findOne(id);

    // Soft delete
    return this.prisma.deal.update({
      where: { id },
      data: { deletedAt: new Date() },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
      },
    });
  }

  async bulkMoveToStage(
    dealIds: string[],
    stageId: string,
    userId: string,
  ): Promise<Deal[]> {
    const deals = [];

    // Process each deal individually to maintain transition history
    for (const dealId of dealIds) {
      const deal = await this.moveToStage(dealId, stageId, userId);
      deals.push(deal);
    }

    return deals;
  }

  async bulkUpdateOwner(dealIds: string[], ownerId: string): Promise<Deal[]> {
    // Verify owner exists
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
    });

    if (!owner) {
      throw new NotFoundException("Owner not found");
    }

    // Update all deals
    await this.prisma.deal.updateMany({
      where: { id: { in: dealIds } },
      data: { ownerId },
    });

    // Create activities
    await Promise.all(
      dealIds.map((dealId) =>
        this.createActivity(dealId, "OWNER_CHANGED", {
          title: `Deal assigned to ${owner.firstName} ${owner.lastName}`,
        }),
      ),
    );

    // Return updated deals
    return this.prisma.deal.findMany({
      where: { id: { in: dealIds } },
      include: {
        pipeline: true,
        stage: true,
        owner: true,
        company: true,
        contacts: {
          include: { contact: true },
        },
      },
    });
  }

  async getDealHistory(dealId: string): Promise<DealStageTransition[]> {
    await this.findOne(dealId);

    return this.prisma.dealStageTransition.findMany({
      where: { dealId },
      include: {
        fromStage: true,
        toStage: true,
        transitionedBy: true,
      },
      orderBy: { transitionTime: "desc" },
    });
  }

  async addContact(
    dealId: string,
    contactId: string,
    isPrimary = false,
  ): Promise<DealContact> {
    await this.findOne(dealId);

    // Check if contact already associated
    const existing = await this.prisma.dealContact.findUnique({
      where: {
        dealId_contactId: {
          dealId,
          contactId,
        },
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.dealContact.create({
      data: {
        dealId,
        contactId,
        isPrimary,
      },
    });
  }

  async removeContact(dealId: string, contactId: string): Promise<DealContact> {
    return this.prisma.dealContact.delete({
      where: {
        dealId_contactId: {
          dealId,
          contactId,
        },
      },
    });
  }

  private async createActivity(
    dealId: string,
    type: string,
    data: { title: string; description?: string },
  ) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      select: { workspaceId: true, ownerId: true },
    });

    if (!deal) return;

    await this.prisma.activity.create({
      data: {
        workspaceId: deal.workspaceId,
        type: type as any,
        title: data.title,
        description: data.description,
        dealId,
        userId: deal.ownerId,
      },
    });
  }
}
