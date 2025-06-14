import { Injectable, UnauthorizedException } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { JwtPayload } from "../../../common/interfaces/jwt-payload.interface";

@Injectable()
export class RefreshJwtStrategy extends PassportStrategy(
  Strategy,
  "jwt-refresh",
) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || "change-me-in-production",
    });
  }

  async validate(payload: JwtPayload) {
    // Handle null payload
    if (!payload) {
      throw new UnauthorizedException("Invalid refresh token payload");
    }

    // Check required fields
    if (!payload.sub || !payload.email) {
      throw new UnauthorizedException("Invalid refresh token payload");
    }

    // Check if it's a refresh token
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException("Invalid token type");
    }

    // Check workspaceId
    if (!payload.workspaceId) {
      throw new UnauthorizedException("Missing workspace ID");
    }

    // Return minimal data needed for refresh
    return {
      userId: payload.sub,
      email: payload.email,
      workspaceId: payload.workspaceId,
    };
  }
}
