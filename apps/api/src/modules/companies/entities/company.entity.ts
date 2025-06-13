import { ObjectType, Field, ID, Int } from "@nestjs/graphql";

@ObjectType()
export class Company {
  @Field(() => ID)
  id: string;

  @Field()
  workspaceId: string;

  @Field()
  name: string;

  @Field({ nullable: true })
  domain?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  logoUrl?: string;

  @Field({ nullable: true })
  description?: string;

  @Field({ nullable: true })
  industry?: string;

  @Field({ nullable: true })
  size?: string;

  @Field(() => Int, { nullable: true })
  revenue?: number;

  @Field(() => Int, { nullable: true })
  foundedYear?: number;

  @Field({ nullable: true })
  linkedinUrl?: string;

  @Field({ nullable: true })
  twitterUrl?: string;

  @Field({ nullable: true })
  facebookUrl?: string;

  @Field({ nullable: true })
  address?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  state?: string;

  @Field({ nullable: true })
  country?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field()
  createdById: string;
}
