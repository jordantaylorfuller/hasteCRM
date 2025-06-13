import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { GqlExecutionContext } from "@nestjs/graphql";
import { JwtService } from "@nestjs/jwt";
import { SessionService } from "../../modules/auth/session.service";

@Injectable()
export class CustomGqlAuthGuard implements CanActivate {
  constructor(
    private jwtService: JwtService,
    private sessionService: SessionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = GqlExecutionContext.create(context);
    const { req } = ctx.getContext();

    if (!req) {
      throw new UnauthorizedException("Request not found in GraphQL context");
    }

    const token = this.extractTokenFromHeader(req);
    if (!token) {
      throw new UnauthorizedException("No token provided");
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.sessionService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new UnauthorizedException("Token has been invalidated");
    }

    try {
      const payload = await this.jwtService.verifyAsync(token, {
        secret: process.env.JWT_SECRET || "change-me-in-production",
      });

      // Attach user to request
      req.user = {
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

      return true;
    } catch (error) {
      throw new UnauthorizedException("Invalid token");
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers?.authorization?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}
