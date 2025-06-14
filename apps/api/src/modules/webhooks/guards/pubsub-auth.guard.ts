import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Logger,
} from "@nestjs/common";
import { Request } from "express";

@Injectable()
export class PubSubAuthGuard implements CanActivate {
  private readonly logger = new Logger(PubSubAuthGuard.name);

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    // For development, we can use a simple token verification
    // In production, you should verify the Google Cloud Pub/Sub push token

    // 1. Verify Bearer token (if using authentication)
    const authHeader = request.headers.authorization;
    if (process.env.NODE_ENV === "production") {
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        this.logger.warn("Missing or invalid Authorization header");
        throw new UnauthorizedException("Invalid authorization");
      }

      const token = authHeader.substring(7);

      // In production, verify the token with Google's OAuth2 client
      // For now, we'll use a simple check
      const expectedToken = process.env.PUBSUB_VERIFICATION_TOKEN;
      if (expectedToken && token !== expectedToken) {
        this.logger.warn("Invalid Pub/Sub verification token");
        throw new UnauthorizedException("Invalid token");
      }
    }

    // 2. Verify Google Cloud Pub/Sub headers
    const userAgent = request.headers["user-agent"];
    const googleUserAgent =
      "APIs-Google; (+https://developers.google.com/webmasters/APIs-Google.html)";

    if (
      process.env.NODE_ENV === "production" &&
      userAgent !== googleUserAgent
    ) {
      this.logger.warn(`Invalid user agent: ${userAgent}`);
      // In production, you might want to be stricter
      // throw new UnauthorizedException("Invalid user agent");
    }

    // 3. Verify the push endpoint URL (optional)
    // You can check if the request is coming from expected IP ranges

    return true;
  }
}
