import { Resolver, Query, Mutation, Args, Int, Context } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { CompaniesService } from "./companies.service";
import { Company } from "./entities/company.entity";
import { CreateCompanyInput } from "./dto/create-company.input";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

@Resolver(() => Company)
@UseGuards(CustomGqlAuthGuard)
export class CompaniesResolver {
  constructor(private readonly companiesService: CompaniesService) {}

  @Mutation(() => Company)
  async createCompany(
    @Args("input") input: CreateCompanyInput,
    @Context() ctx: any,
  ) {
    const { workspaceId, userId } = ctx.req.user;
    return this.companiesService.create(workspaceId, userId, input);
  }

  @Query(() => CompaniesResponse, { name: "companies" })
  async findAll(
    @Args("skip", { type: () => Int, defaultValue: 0 }) skip?: number,
    @Args("take", { type: () => Int, defaultValue: 20 }) take?: number,
    @Args("search", { nullable: true }) search?: string,
    @Context() ctx?: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.companiesService.findAll(workspaceId, skip, take, search);
  }

  @Query(() => Company, { name: "company" })
  async findOne(
    @Args("id", { type: () => String }) id: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.companiesService.findOne(id, workspaceId);
  }

  @Mutation(() => Company)
  async updateCompany(
    @Args("id", { type: () => String }) id: string,
    @Args("input") input: CreateCompanyInput,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.companiesService.update(id, workspaceId, input);
  }

  @Mutation(() => Company)
  async removeCompany(
    @Args("id", { type: () => String }) id: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.companiesService.remove(id, workspaceId);
  }
}

import { ObjectType, Field, Int as GraphQLInt } from "@nestjs/graphql";

@ObjectType()
class CompaniesResponse {
  @Field(() => [Company])
  companies: Company[];

  @Field(() => GraphQLInt)
  total: number;

  @Field()
  hasMore: boolean;
}
