import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { RedisService } from "../../modules/redis/redis.service";

export interface RateLimitOptions {
  points: number; // Number of requests
  duration: number; // Duration in seconds
  keyPrefix?: string; // Custom key prefix
  skipIf?: (req: any) => boolean; // Skip rate limiting condition
}

export const RATE_LIMIT_KEY = "rateLimit";

@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private redisService: RedisService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const options = this.reflector.get<RateLimitOptions>(
      RATE_LIMIT_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true; // No rate limit configured
    }

    const request = context.switchToHttp().getRequest();

    // Check skip condition
    if (options.skipIf && options.skipIf(request)) {
      return true;
    }

    const key = this.generateKey(request, options);
    const current = await this.redisService.incrementRateLimit(
      key,
      options.duration,
    );

    if (current > options.points) {
      const ttl = await this.redisService.getClient().ttl(key);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: "Too many requests",
          error: "Too Many Requests",
          retryAfter: ttl,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Add rate limit headers
    const response = context.switchToHttp().getResponse();
    response.setHeader("X-RateLimit-Limit", options.points);
    response.setHeader(
      "X-RateLimit-Remaining",
      Math.max(0, options.points - current),
    );
    response.setHeader(
      "X-RateLimit-Reset",
      new Date(Date.now() + options.duration * 1000).toISOString(),
    );

    return true;
  }

  private generateKey(request: any, options: RateLimitOptions): string {
    const prefix = options.keyPrefix || "rate-limit";
    const identifier = this.getIdentifier(request);
    const path = request.route?.path || request.url;

    return `${prefix}:${path}:${identifier}`;
  }

  private getIdentifier(request: any): string {
    // Priority: authenticated user > IP address
    if (request.user?.userId) {
      return `user:${request.user.userId}`;
    }

    // Get IP address (considering proxies)
    const ip =
      request.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
      request.headers["x-real-ip"] ||
      request.connection?.remoteAddress ||
      request.ip;

    return `ip:${ip}`;
  }
}
