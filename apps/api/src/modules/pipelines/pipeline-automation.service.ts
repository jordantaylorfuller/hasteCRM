import {
  Injectable,
  Logger,
  OnModuleInit,
  Inject,
  forwardRef,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { EmailService } from "../email/email.service";
import { DealsService } from "./deals.service";
import {
  AutomationTrigger,
  AutomationAction,
  Deal,
  PipelineAutomation,
} from "@hasteCRM/database";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";

interface AutomationContext {
  deal: Deal;
  trigger: AutomationTrigger;
  previousValue?: any;
  newValue?: any;
  userId: string;
}

@Injectable()
export class PipelineAutomationService implements OnModuleInit {
  private readonly logger = new Logger(PipelineAutomationService.name);

  constructor(
    private prisma: PrismaService,
    private emailService: EmailService,
    @InjectQueue("automations") private automationQueue: Queue,
    @Inject(forwardRef(() => DealsService))
    private dealsService: DealsService,
  ) {}

  onModuleInit() {
    this.dealsService.setAutomationService(this);
  }

  async triggerAutomations(context: AutomationContext) {
    // Find applicable automations
    const automations = await this.prisma.pipelineAutomation.findMany({
      where: {
        pipelineId: context.deal.pipelineId,
        trigger: context.trigger,
        isActive: true,
        ...(context.trigger === AutomationTrigger.STAGE_ENTER ||
        context.trigger === AutomationTrigger.STAGE_EXIT
          ? { triggerStageId: context.newValue || context.previousValue }
          : {}),
      },
    });

    // Queue automations for execution
    for (const automation of automations) {
      if (await this.evaluateConditions(automation, context)) {
        await this.automationQueue.add(
          "execute",
          {
            automationId: automation.id,
            dealId: context.deal.id,
            context,
          },
          {
            delay: automation.delay * 60 * 1000, // Convert minutes to ms
          },
        );
      }
    }
  }

  async executeAutomation(
    automationId: string,
    dealId: string,
    context: AutomationContext,
  ) {
    const automation = await this.prisma.pipelineAutomation.findUnique({
      where: { id: automationId },
    });

    if (!automation || !automation.isActive) {
      return;
    }

    const log = await this.prisma.automationLog.create({
      data: {
        automationId,
        dealId,
        trigger: context.trigger,
        status: "PENDING",
      },
    });

    const results: any[] = [];
    let hasError = false;

    try {
      // Execute each action
      for (const action of automation.actions) {
        try {
          // Extract action type and config from action object
          const actionType =
            typeof action === "string" ? action : action.type || action;
          const actionConfig =
            typeof action === "object"
              ? action.config || action
              : automation.actionConfig;

          const result = await this.executeAction(
            actionType,
            context.deal,
            actionConfig,
          );
          results.push({ action, success: true, result });
        } catch (error: any) {
          hasError = true;
          results.push({
            action,
            success: false,
            error: error.message,
          });
          this.logger.error(
            `Failed to execute action ${typeof action === "object" ? action.type : action} for automation ${automationId}`,
            error,
          );
        }
      }

      // Update automation stats
      await this.prisma.pipelineAutomation.update({
        where: { id: automationId },
        data: {
          lastTriggeredAt: new Date(),
          triggerCount: { increment: 1 },
        },
      });

      // Complete log
      await this.prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: hasError ? "FAILED" : "SUCCESS",
          actions: results,
          executedAt: new Date(),
          completedAt: new Date(),
        },
      });
    } catch (error: any) {
      await this.prisma.automationLog.update({
        where: { id: log.id },
        data: {
          status: "FAILED",
          error: error.message,
          completedAt: new Date(),
        },
      });
      throw error;
    }
  }

  private async evaluateConditions(
    automation: PipelineAutomation,
    context: AutomationContext,
  ): Promise<boolean> {
    const conditions = automation.conditions as any;

    if (!conditions || Object.keys(conditions).length === 0) {
      return true;
    }

    // Value conditions
    const dealValue = parseFloat(context.deal.value || "0");
    if (conditions.minValue && dealValue < conditions.minValue) {
      return false;
    }
    if (conditions.maxValue && dealValue > conditions.maxValue) {
      return false;
    }

    // Probability conditions
    if (
      conditions.minProbability &&
      context.deal.probability < conditions.minProbability
    ) {
      return false;
    }

    // Days in stage condition
    if (
      conditions.minDaysInStage &&
      context.deal.daysInStage < conditions.minDaysInStage
    ) {
      return false;
    }

    // Owner conditions
    if (
      conditions.ownerIds &&
      !conditions.ownerIds.includes(context.deal.ownerId)
    ) {
      return false;
    }

    // Company conditions
    if (conditions.hasCompany !== undefined) {
      const hasCompany = !!context.deal.companyId;
      if (conditions.hasCompany !== hasCompany) {
        return false;
      }
    }

    return true;
  }

  private async executeAction(
    action: AutomationAction,
    deal: Deal,
    config: any,
  ): Promise<any> {
    switch (action) {
      case AutomationAction.SEND_EMAIL:
        return this.sendEmailAction(deal, config.email || config);

      case AutomationAction.CREATE_TASK:
        return this.createTaskAction(deal, config.task || config);

      case AutomationAction.UPDATE_FIELD:
        return this.updateFieldAction(deal, config.field || config);

      case AutomationAction.ADD_TAG:
        return this.addTagAction(deal, config.tag || config);

      case AutomationAction.REMOVE_TAG:
        return this.removeTagAction(deal, config.tag || config);

      case AutomationAction.ASSIGN_OWNER:
        return this.assignOwnerAction(deal, config.owner || config);

      case AutomationAction.CREATE_ACTIVITY:
        return this.createActivityAction(deal, config.activity || config);

      case AutomationAction.UPDATE_PROBABILITY:
        return this.updateProbabilityAction(deal, config.probability || config);

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  }

  // Action implementations
  private async sendEmailAction(deal: any, config: any) {
    const dealWithRelations = await this.prisma.deal.findUnique({
      where: { id: deal.id },
      include: {
        owner: true,
        contacts: {
          include: { contact: true },
        },
        company: true,
      },
    });

    if (!dealWithRelations || dealWithRelations.contacts.length === 0) {
      throw new Error("No contacts found for deal");
    }

    const primaryContact =
      dealWithRelations.contacts.find((dc) => dc.isPrimary) ||
      dealWithRelations.contacts[0];

    // Replace variables in template
    const subject = this.replaceVariables(config.subject, dealWithRelations);
    const body = this.replaceVariables(config.body, dealWithRelations);

    const email = primaryContact.contact.email;
    if (!email) {
      throw new Error("Contact does not have an email address");
    }

    await this.emailService.sendEmail({
      to: email,
      subject,
      html: body,
    });

    return { sent: true, to: primaryContact.contact.email };
  }

  private async createTaskAction(deal: Deal, config: any) {
    const dueDate = config.dueDays
      ? new Date(Date.now() + config.dueDays * 24 * 60 * 60 * 1000)
      : undefined;

    const task = await this.prisma.task.create({
      data: {
        workspaceId: deal.workspaceId,
        title: this.replaceVariables(config.title, deal),
        description: config.description
          ? this.replaceVariables(config.description, deal)
          : undefined,
        status: "TODO",
        priority: config.priority || "MEDIUM",
        dueDate,
        assignedToId: config.assignToOwner ? deal.ownerId : config.assigneeId,
        dealId: deal.id,
      },
    });

    return { taskId: task.id };
  }

  private async updateFieldAction(deal: Deal, config: any) {
    const updates: any = {};

    Object.entries(config.updates).forEach(([field, value]) => {
      if (typeof value === "string") {
        updates[field] = this.replaceVariables(value, deal);
      } else {
        updates[field] = value;
      }
    });

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: updates,
    });

    return { updated: true, fields: Object.keys(updates) };
  }

  private async addTagAction(deal: Deal, config: any) {
    const tag = await this.prisma.tag.findFirst({
      where: {
        workspaceId: deal.workspaceId,
        name: config.tagName,
      },
    });

    if (!tag) {
      throw new Error(`Tag "${config.tagName}" not found`);
    }

    await this.prisma.dealTag.upsert({
      where: {
        dealId_tagId: {
          dealId: deal.id,
          tagId: tag.id,
        },
      },
      create: {
        dealId: deal.id,
        tagId: tag.id,
      },
      update: {},
    });

    return { tagAdded: true, tagId: tag.id };
  }

  private async removeTagAction(deal: Deal, config: any) {
    const tag = await this.prisma.tag.findFirst({
      where: {
        workspaceId: deal.workspaceId,
        name: config.tagName,
      },
    });

    if (!tag) {
      return { tagRemoved: false, reason: "Tag not found" };
    }

    await this.prisma.dealTag.deleteMany({
      where: {
        dealId: deal.id,
        tagId: tag.id,
      },
    });

    return { tagRemoved: true, tagId: tag.id };
  }

  private async assignOwnerAction(deal: Deal, config: any) {
    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { ownerId: config.ownerId },
    });

    return { assigned: true, ownerId: config.ownerId };
  }

  private async createActivityAction(deal: Deal, config: any) {
    const activity = await this.prisma.activity.create({
      data: {
        workspaceId: deal.workspaceId,
        type: config.type || "NOTE_ADDED",
        title: this.replaceVariables(config.title, deal),
        description: config.description
          ? this.replaceVariables(config.description, deal)
          : undefined,
        dealId: deal.id,
        userId: deal.ownerId,
      },
    });

    return { activityId: activity.id };
  }

  private async updateProbabilityAction(deal: Deal, config: any) {
    const newProbability =
      (config.setProbability ?? config.increaseProbability)
        ? Math.min(100, deal.probability + config.increaseProbability)
        : Math.max(0, deal.probability - config.decreaseProbability);

    await this.prisma.deal.update({
      where: { id: deal.id },
      data: { probability: newProbability },
    });

    return {
      oldProbability: deal.probability,
      newProbability,
    };
  }

  private replaceVariables(template: string, deal: any): string {
    return template
      .replace(/{{deal.title}}/g, deal.title)
      .replace(/{{deal.value}}/g, deal.value.toString())
      .replace(
        /{{deal.owner}}/g,
        `${deal.owner?.firstName} ${deal.owner?.lastName}`,
      )
      .replace(/{{deal.company}}/g, deal.company?.name || "")
      .replace(/{{deal.stage}}/g, deal.stage?.name || "")
      .replace(/{{deal.daysInStage}}/g, deal.daysInStage?.toString() || "0");
  }

  // Create default automations for a pipeline
  async createDefaultAutomations(pipelineId: string) {
    const pipeline = await this.prisma.pipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: true },
    });

    if (!pipeline) return;

    const defaultAutomations = [
      {
        name: "Welcome Email on Deal Creation",
        description: "Send welcome email when new deal is created",
        trigger: AutomationTrigger.DEAL_CREATED,
        actions: [AutomationAction.SEND_EMAIL],
        actionConfig: {
          email: {
            subject: "Welcome to our sales process",
            body: "Hi! We're excited to work with you on {{deal.title}}...",
          },
        },
      },
      {
        name: "Stalled Deal Alert",
        description: "Create task when deal is stalled for 30 days",
        trigger: AutomationTrigger.DEAL_STALLED,
        actions: [AutomationAction.CREATE_TASK],
        conditions: { minDaysInStage: 30 },
        actionConfig: {
          task: {
            title: "Follow up on stalled deal: {{deal.title}}",
            priority: "HIGH",
            dueDays: 1,
            assignToOwner: true,
          },
        },
      },
      {
        name: "Won Deal Celebration",
        description: "Update probability and create activity when deal is won",
        trigger: AutomationTrigger.DEAL_WON,
        actions: [
          AutomationAction.UPDATE_PROBABILITY,
          AutomationAction.CREATE_ACTIVITY,
        ],
        actionConfig: {
          probability: { setProbability: 100 },
          activity: {
            type: "DEAL_UPDATED",
            title: "Deal won! 🎉",
            description:
              "{{deal.title}} has been successfully closed for {{deal.value}}",
          },
        },
      },
    ];

    for (const automation of defaultAutomations) {
      await this.prisma.pipelineAutomation.create({
        data: {
          pipelineId,
          ...automation,
          isActive: false, // Start inactive
        },
      });
    }
  }
}
