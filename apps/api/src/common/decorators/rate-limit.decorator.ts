import { SetMetadata } from "@nestjs/common";
import { RateLimitOptions, RATE_LIMIT_KEY } from "../guards/rate-limit.guard";

export const RateLimit = (options: RateLimitOptions) =>
  SetMetadata(RATE_LIMIT_KEY, options);
