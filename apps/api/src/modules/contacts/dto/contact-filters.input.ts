import { InputType, Field } from "@nestjs/graphql";
import { IsOptional, IsString, IsArray, IsEnum } from "class-validator";
import { ContactStatus, ContactSource } from "../../prisma/prisma-client";

@InputType()
export class ContactFiltersInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  search?: string;

  @Field(() => ContactStatus, { nullable: true })
  @IsOptional()
  @IsEnum(ContactStatus)
  status?: ContactStatus;

  @Field(() => ContactSource, { nullable: true })
  @IsOptional()
  @IsEnum(ContactSource)
  source?: ContactSource;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  companyId?: string;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  city?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  state?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  country?: string;
}
