import { ObjectType, Field, Int as GraphQLInt } from "@nestjs/graphql";
import { Company } from "../entities/company.entity";

@ObjectType()
export class CompaniesResponse {
  @Field(() => [Company])
  companies: Company[];

  @Field(() => GraphQLInt)
  total: number;

  @Field()
  hasMore: boolean;
}