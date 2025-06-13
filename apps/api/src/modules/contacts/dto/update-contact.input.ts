import { InputType, Field, PartialType, ID } from "@nestjs/graphql";
import { CreateContactInput } from "./create-contact.input";
import { IsNotEmpty, IsString } from "class-validator";

@InputType()
export class UpdateContactInput extends PartialType(CreateContactInput) {
  @Field(() => ID)
  @IsNotEmpty()
  @IsString()
  id: string;
}
