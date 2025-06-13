import { Resolver, Mutation, Query, Args, Context } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { ContactImportService } from "./services/contact-import.service";
import { ContactExportService } from "./services/contact-export.service";
import {
  ImportContactsInput,
  ExportContactsInput,
} from "./dto/import-contacts.input";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";
import GraphQLJSON from "graphql-type-json";

@Resolver()
@UseGuards(CustomGqlAuthGuard)
export class ImportExportResolver {
  constructor(
    private readonly importService: ContactImportService,
    private readonly exportService: ContactExportService,
  ) {}

  @Mutation(() => ImportResult)
  async importContacts(
    @Args("input") input: ImportContactsInput,
    @Args("fileContent") fileContent: string,
    @Context() ctx: any,
  ) {
    const { workspaceId, userId } = ctx.req.user;
    return this.importService.importContacts(
      workspaceId,
      userId,
      fileContent,
      input.format,
      input.mapping,
    );
  }

  @Mutation(() => ExportResult)
  async exportContacts(
    @Args("input", { nullable: true }) input?: ExportContactsInput,
    @Context() ctx?: any,
  ) {
    const { workspaceId, userId } = ctx.req.user;
    return this.exportService.exportContacts(
      workspaceId,
      userId,
      input?.format || "csv",
      input?.fields,
      input?.filters,
    );
  }

  @Query(() => ImportStatus)
  async importStatus(@Args("importId") importId: string, @Context() ctx: any) {
    const { workspaceId } = ctx.req.user;
    return this.importService.getImportStatus(importId, workspaceId);
  }

  @Query(() => ExportStatus)
  async exportStatus(@Args("exportId") exportId: string, @Context() ctx: any) {
    const { workspaceId } = ctx.req.user;
    return this.exportService.getExportStatus(exportId, workspaceId);
  }
}

import { ObjectType, Field, Int } from "@nestjs/graphql";

@ObjectType()
class ImportResult {
  @Field()
  importId: string;

  @Field(() => Int)
  total: number;

  @Field(() => Int)
  processed: number;

  @Field(() => Int)
  success: number;

  @Field(() => [GraphQLJSON])
  errors: any[];
}

@ObjectType()
class ExportResult {
  @Field()
  exportId: string;

  @Field()
  fileUrl: string;

  @Field(() => Int)
  rowCount: number;

  @Field()
  format: string;

  @Field()
  expiresAt: Date;
}

@ObjectType()
class ImportStatus {
  @Field()
  id: string;

  @Field()
  status: string;

  @Field(() => Int)
  totalRows: number;

  @Field(() => Int)
  processedRows: number;

  @Field(() => Int)
  successRows: number;

  @Field(() => Int)
  errorRows: number;

  @Field(() => [GraphQLJSON], { nullable: true })
  errors?: any[];

  @Field()
  createdAt: Date;

  @Field({ nullable: true })
  completedAt?: Date;
}

@ObjectType()
class ExportStatus {
  @Field()
  id: string;

  @Field()
  type: string;

  @Field()
  format: string;

  @Field(() => Int)
  rowCount: number;

  @Field({ nullable: true })
  fileUrl?: string;

  @Field()
  expiresAt: Date;

  @Field()
  createdAt: Date;
}
