import { Resolver, Query, Mutation, Args, Int, Context } from "@nestjs/graphql";
import { UseGuards } from "@nestjs/common";
import { ContactsService } from "./contacts.service";
import { Contact } from "./entities/contact.entity";
import { CreateContactInput } from "./dto/create-contact.input";
import { UpdateContactInput } from "./dto/update-contact.input";
import { ContactFiltersInput } from "./dto/contact-filters.input";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

@Resolver(() => Contact)
@UseGuards(CustomGqlAuthGuard)
export class ContactsResolver {
  constructor(private readonly contactsService: ContactsService) {}

  @Mutation(() => Contact)
  async createContact(
    @Args("input") input: CreateContactInput,
    @Context() ctx: any,
  ) {
    const { workspaceId, userId } = ctx.req.user;
    return this.contactsService.create(workspaceId, userId, input);
  }

  @Query(() => ContactsResponse, { name: "contacts" })
  async findAll(
    @Args("filters", { nullable: true }) filters?: ContactFiltersInput,
    @Args("skip", { type: () => Int, defaultValue: 0 }) skip?: number,
    @Args("take", { type: () => Int, defaultValue: 20 }) take?: number,
    @Context() ctx?: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.findAll(workspaceId, filters, skip, take);
  }

  @Query(() => Contact, { name: "contact" })
  async findOne(
    @Args("id", { type: () => String }) id: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.findOne(id, workspaceId);
  }

  @Query(() => ContactsResponse, { name: "searchContacts" })
  async search(
    @Args("query") query: string,
    @Args("filters", { nullable: true }) filters?: ContactFiltersInput,
    @Args("skip", { type: () => Int, defaultValue: 0 }) skip?: number,
    @Args("take", { type: () => Int, defaultValue: 20 }) take?: number,
    @Context() ctx?: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.search(workspaceId, query, filters, skip, take);
  }

  @Mutation(() => Contact)
  async updateContact(
    @Args("input") input: UpdateContactInput,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    const { id, ...data } = input;
    return this.contactsService.update(id, workspaceId, data);
  }

  @Mutation(() => Contact)
  async removeContact(
    @Args("id", { type: () => String }) id: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.remove(id, workspaceId);
  }

  @Mutation(() => Contact)
  async restoreContact(
    @Args("id", { type: () => String }) id: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.restore(id, workspaceId);
  }

  @Mutation(() => Contact)
  async updateContactScore(
    @Args("id", { type: () => String }) id: string,
    @Args("score", { type: () => Int }) score: number,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.updateScore(id, workspaceId, score);
  }

  @Query(() => [Contact])
  async contactsByCompany(
    @Args("companyId", { type: () => String }) companyId: string,
    @Context() ctx: any,
  ) {
    const { workspaceId } = ctx.req.user;
    return this.contactsService.getContactsByCompany(companyId, workspaceId);
  }
}

import { ObjectType, Field, Int as GraphQLInt } from "@nestjs/graphql";

@ObjectType()
class ContactsResponse {
  @Field(() => [Contact])
  contacts: Contact[];

  @Field(() => GraphQLInt)
  total: number;

  @Field()
  hasMore: boolean;
}
