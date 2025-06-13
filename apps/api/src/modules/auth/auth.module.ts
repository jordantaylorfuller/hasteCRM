import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { PassportModule } from "@nestjs/passport";
import { AuthController } from "./auth.controller";
import { TwoFactorController } from "./two-factor.controller";
import { SessionController } from "./session.controller";
import { AuthService } from "./auth.service";
import { TwoFactorService } from "./two-factor.service";
import { SessionService } from "./session.service";
import { JwtStrategy } from "./strategies/jwt.strategy";
import { RefreshJwtStrategy } from "./strategies/refresh-jwt.strategy";
import { LocalStrategy } from "./strategies/local.strategy";
import { GoogleStrategy } from "./strategies/google.strategy";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { PrismaModule } from "../prisma/prisma.module";
import { EmailModule } from "../email/email.module";
import { RedisModule } from "../redis/redis.module";

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    RedisModule,
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || "change-me-in-production",
      signOptions: { expiresIn: "15m" },
    }),
  ],
  controllers: [AuthController, TwoFactorController, SessionController],
  providers: [
    AuthService,
    TwoFactorService,
    SessionService,
    LocalStrategy,
    JwtStrategy,
    RefreshJwtStrategy,
    GoogleStrategy,
    {
      provide: "APP_GUARD",
      useClass: RateLimitGuard,
    },
  ],
  exports: [AuthService, TwoFactorService, SessionService],
})
export class AuthModule {}
