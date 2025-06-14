import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { AiService } from "./ai.service";
import { AiResolver } from "./ai.resolver";
import { GmailModule } from "../gmail/gmail.module";
import { ContactsModule } from "../contacts/contacts.module";
import { PrismaModule } from "../prisma/prisma.module";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [
    GmailModule,
    ContactsModule,
    PrismaModule,
    AuthModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  providers: [AiService, AiResolver],
  exports: [AiService],
})
export class AiModule {}
