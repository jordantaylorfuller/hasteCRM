import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ContactImportService } from "./services/contact-import.service";
import { ContactExportService } from "./services/contact-export.service";
import { ImportExportResolver } from "./import-export.resolver";
import { PrismaModule } from "../prisma/prisma.module";
import { ContactsModule } from "../contacts/contacts.module";
import { AuthModule } from "../auth/auth.module";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

@Module({
  imports: [
    PrismaModule,
    ContactsModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
    }),
  ],
  providers: [
    ContactImportService,
    ContactExportService,
    ImportExportResolver,
    CustomGqlAuthGuard,
  ],
  exports: [ContactImportService, ContactExportService],
})
export class ImportExportModule {}
