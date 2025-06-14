import {
  Resolver,
  Query,
  Mutation,
  Args,
  ID,
  Context,
  Int,
} from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { PipelinesService } from "./pipelines.service";
import { DealsService } from "./deals.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";
import { Pipeline, Deal, Stage } from "../prisma/prisma-client";

@Resolver("Pipeline")
@UseGuards(CustomGqlAuthGuard)
export class PipelinesResolver {
  constructor(
    private pipelinesService: PipelinesService,
    private dealsService: DealsService,
  ) {}

  @Query("pipelines")
  async pipelines(@Context() ctx: any): Promise<Pipeline[]> {
    const { workspaceId } = ctx.req.user;
    return this.pipelinesService.findAll(workspaceId);
  }

  @Query("pipeline")
  async pipeline(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Pipeline> {
    return this.pipelinesService.findOne(id);
  }

  @Query("pipelineMetrics")
  async pipelineMetrics(
    @Args("id", { type: () => ID }) id: string,
    @Args("startDate", { nullable: true }) startDate?: Date,
    @Args("endDate", { nullable: true }) endDate?: Date,
  ): Promise<any> {
    const dateRange =
      startDate && endDate ? { start: startDate, end: endDate } : undefined;
    return this.pipelinesService.getPipelineMetrics(id, dateRange);
  }

  @Mutation("createPipeline")
  async createPipeline(
    @Args("input") input: any,
    @Context() ctx: any,
  ): Promise<Pipeline> {
    const { workspaceId } = ctx.req.user;
    return this.pipelinesService.create(workspaceId, input);
  }

  @Mutation("updatePipeline")
  async updatePipeline(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: any,
  ): Promise<Pipeline> {
    return this.pipelinesService.update(id, input);
  }

  @Mutation("deletePipeline")
  async deletePipeline(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Pipeline> {
    return this.pipelinesService.delete(id);
  }

  @Mutation("reorderPipelines")
  async reorderPipelines(
    @Args("input") input: { ids: string[] },
    @Context() ctx: any,
  ): Promise<Pipeline[]> {
    const { workspaceId } = ctx.req.user;
    return this.pipelinesService.reorderPipelines(workspaceId, input.ids);
  }

  @Mutation("createStage")
  async createStage(
    @Args("pipelineId", { type: () => ID }) pipelineId: string,
    @Args("name") name: string,
    @Args("color", { nullable: true }) color?: string,
    @Args("probability", { type: () => Int, nullable: true })
    probability?: number,
  ): Promise<Stage> {
    return this.pipelinesService.createStage(pipelineId, {
      name,
      color,
      probability,
    });
  }

  @Mutation("updateStage")
  async updateStage(
    @Args("id", { type: () => ID }) id: string,
    @Args("name", { nullable: true }) name?: string,
    @Args("color", { nullable: true }) color?: string,
    @Args("probability", { type: () => Int, nullable: true })
    probability?: number,
  ): Promise<Stage> {
    return this.pipelinesService.updateStage(id, {
      name,
      color,
      probability,
    });
  }

  @Mutation("deleteStage")
  async deleteStage(
    @Args("id", { type: () => ID }) id: string,
  ): Promise<Stage> {
    return this.pipelinesService.deleteStage(id);
  }

  @Mutation("reorderStages")
  async reorderStages(
    @Args("pipelineId", { type: () => ID }) pipelineId: string,
    @Args("input") input: { ids: string[] },
  ): Promise<Stage[]> {
    return this.pipelinesService.reorderStages(pipelineId, input.ids);
  }
}

@Resolver("Deal")
@UseGuards(CustomGqlAuthGuard)
export class DealsResolver {
  constructor(private dealsService: DealsService) {}

  @Query("deals")
  async deals(
    @Args("pipelineId", { type: () => ID, nullable: true }) pipelineId?: string,
    @Args("stageId", { type: () => ID, nullable: true }) stageId?: string,
    @Args("status", { nullable: true }) status?: string,
    @Args("ownerId", { type: () => ID, nullable: true }) ownerId?: string,
    @Args("skip", { type: () => Int, nullable: true }) skip?: number,
    @Args("take", { type: () => Int, nullable: true }) take?: number,
    @Context() ctx?: any,
  ): Promise<any> {
    const { workspaceId } = ctx.req.user;
    return this.dealsService.findAll(workspaceId, {
      pipelineId,
      stageId,
      status,
      ownerId,
      skip: skip || 0,
      take: take || 20,
    });
  }

  @Query("deal")
  async deal(@Args("id", { type: () => ID }) id: string): Promise<Deal> {
    return this.dealsService.findOne(id);
  }

  @Query("dealHistory")
  async dealHistory(@Args("id", { type: () => ID }) id: string): Promise<any> {
    return this.dealsService.getDealHistory(id);
  }

  @Mutation("createDeal")
  async createDeal(
    @Args("input") input: any,
    @Context() ctx: any,
  ): Promise<Deal> {
    const { workspaceId } = ctx.req.user;
    return this.dealsService.create(workspaceId, input);
  }

  @Mutation("updateDeal")
  async updateDeal(
    @Args("id", { type: () => ID }) id: string,
    @Args("input") input: any,
  ): Promise<Deal> {
    return this.dealsService.update(id, input);
  }

  @Mutation("moveDeal")
  async moveDeal(
    @Args("input") input: { dealId: string; stageId: string; reason?: string },
    @Context() ctx: any,
  ): Promise<Deal> {
    const { userId } = ctx.req.user;
    return this.dealsService.moveToStage(
      input.dealId,
      input.stageId,
      userId,
      input.reason,
    );
  }

  @Mutation("deleteDeal")
  async deleteDeal(@Args("id", { type: () => ID }) id: string): Promise<Deal> {
    return this.dealsService.delete(id);
  }

  @Mutation("bulkMoveDeal")
  async bulkMoveDeal(
    @Args("dealIds", { type: () => [ID] }) dealIds: string[],
    @Args("stageId", { type: () => ID }) stageId: string,
    @Context() ctx: any,
  ): Promise<Deal[]> {
    const { userId } = ctx.req.user;
    return this.dealsService.bulkMoveToStage(dealIds, stageId, userId);
  }

  @Mutation("bulkUpdateDealOwner")
  async bulkUpdateDealOwner(
    @Args("dealIds", { type: () => [ID] }) dealIds: string[],
    @Args("ownerId", { type: () => ID }) ownerId: string,
  ): Promise<Deal[]> {
    return this.dealsService.bulkUpdateOwner(dealIds, ownerId);
  }
}
