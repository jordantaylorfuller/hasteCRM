import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ContactsService } from "./contacts.service";
import { ContactsResolver } from "./contacts.resolver";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
    }),
  ],
  providers: [ContactsService, ContactsResolver, CustomGqlAuthGuard],
  exports: [ContactsService],
})
export class ContactsModule {}
