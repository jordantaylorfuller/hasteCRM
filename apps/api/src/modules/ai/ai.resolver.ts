import { Resolver, Query, Mutation, Args, Context } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { AiService } from "./ai.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

@Resolver("AI")
@UseGuards(CustomGqlAuthGuard)
export class AiResolver {
  constructor(private readonly aiService: AiService) {}

  @Query("summarizeEmail")
  async summarizeEmail(
    @Args("input") input: any,
    @Context() _ctx: any,
  ): Promise<any> {
    const { emailId, includeActionItems, includeKeyPoints, maxLength } = input;

    return this.aiService.summarizeEmail(emailId, {
      includeActionItems,
      includeKeyPoints,
      maxLength,
    });
  }

  @Query("getAiInsights")
  async getAiInsights(
    @Args("timeRange") timeRange: any,
    @Context() ctx: any,
  ): Promise<any> {
    const { workspaceId } = ctx.req.user;

    return this.aiService.generateInsights(workspaceId, {
      start: new Date(timeRange.start),
      end: new Date(timeRange.end),
    });
  }

  @Mutation("generateSmartCompose")
  async generateSmartCompose(
    @Args("input") input: any,
    @Context() _ctx: any,
  ): Promise<any> {
    const { emailId, prompt, tone, length, includeContext } = input;

    return this.aiService.generateSmartCompose(emailId, prompt, {
      tone,
      length,
      includeContext,
    });
  }

  @Mutation("enrichContact")
  async enrichContact(
    @Args("contactId") contactId: string,
    @Context() ctx: any,
  ): Promise<any> {
    const { workspaceId } = ctx.req.user;
    return this.aiService.enrichContact(contactId, workspaceId);
  }
}
