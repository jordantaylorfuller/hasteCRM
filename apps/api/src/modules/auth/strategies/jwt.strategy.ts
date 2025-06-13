import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "../../../common/interfaces/jwt-payload.interface";
import { SessionService } from "../session.service";
import { Request } from "express";

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private sessionService: SessionService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "change-me-in-production",
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException("Invalid token payload");
    }

    // Check if token is blacklisted
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const isBlacklisted = await this.sessionService.isTokenBlacklisted(token);
      if (isBlacklisted) {
        throw new UnauthorizedException("Token has been invalidated");
      }
    }

    return {
      sub: payload.sub,
      userId: payload.sub,
      email: payload.email,
      workspaceId: payload.workspaceId,
      role: payload.role,
      firstName: payload.firstName,
      lastName: payload.lastName,
      status: payload.status,
      twoFactorEnabled: payload.twoFactorEnabled,
      workspaceName: payload.workspaceName,
      workspaceSlug: payload.workspaceSlug,
      plan: payload.plan,
    };
  }
}
