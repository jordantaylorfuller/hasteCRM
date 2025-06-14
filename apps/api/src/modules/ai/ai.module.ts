import { Module } from "@nestjs/common";
import { AiService } from "./ai.service";
import { AiResolver } from "./ai.resolver";
import { GmailModule } from "../gmail/gmail.module";
import { ContactsModule } from "../contacts/contacts.module";
import { PrismaModule } from "../prisma/prisma.module";

@Module({
  imports: [GmailModule, ContactsModule, PrismaModule],
  providers: [AiService, AiResolver],
  exports: [AiService],
})
export class AiModule {}
