import { ObjectType, Field, ID, Int, registerEnumType } from "@nestjs/graphql";
import { ContactStatus, ContactSource } from "../../prisma/prisma-client";

registerEnumType(ContactStatus, {
  name: "ContactStatus",
  description: "The status of a contact",
});

registerEnumType(ContactSource, {
  name: "ContactSource",
  description: "The source of a contact",
});

@ObjectType()
export class Contact {
  @Field(() => ID)
  id: string;

  @Field()
  workspaceId: string;

  @Field({ nullable: true })
  firstName?: string;

  @Field({ nullable: true })
  lastName?: string;

  @Field({ nullable: true })
  email?: string;

  @Field({ nullable: true })
  phone?: string;

  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field({ nullable: true })
  website?: string;

  @Field({ nullable: true })
  birthday?: Date;

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
  timezone?: string;

  @Field(() => ContactSource)
  source: ContactSource;

  @Field(() => ContactStatus)
  status: ContactStatus;

  @Field(() => Int)
  score: number;

  @Field({ nullable: true })
  lastActivityAt?: Date;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;

  @Field({ nullable: true })
  deletedAt?: Date;

  @Field()
  createdById: string;

  @Field({ nullable: true })
  companyId?: string;

  @Field({ nullable: true, description: "Full name of the contact" })
  get fullName(): string | null {
    if (this.firstName || this.lastName) {
      return [this.firstName, this.lastName].filter(Boolean).join(" ");
    }
    return null;
  }
}
