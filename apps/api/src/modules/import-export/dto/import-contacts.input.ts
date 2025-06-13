import { InputType, Field } from "@nestjs/graphql";
import { IsNotEmpty, IsString, IsOptional } from "class-validator";
import { GraphQLJSONObject } from "graphql-type-json";

@InputType()
export class ImportContactsInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  fileUrl: string;

  @Field()
  @IsNotEmpty()
  @IsString()
  format: string; // csv, xlsx, json

  @Field(() => GraphQLJSONObject)
  mapping: Record<string, string>; // CSV column to field mapping
}

@InputType()
export class ExportContactsInput {
  @Field({ defaultValue: "csv" })
  @IsOptional()
  @IsString()
  format?: string; // csv, xlsx, json

  @Field(() => [String], { nullable: true })
  @IsOptional()
  fields?: string[]; // Fields to export

  @Field(() => GraphQLJSONObject, { nullable: true })
  @IsOptional()
  filters?: Record<string, any>; // Filter criteria
}
