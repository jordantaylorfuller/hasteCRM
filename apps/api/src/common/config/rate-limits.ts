import { RateLimitOptions } from "../guards/rate-limit.guard";

// Predefined rate limit configurations
export const RateLimits = {
  // Authentication endpoints
  AUTH: {
    LOGIN: {
      points: 5,
      duration: 900, // 15 minutes
      keyPrefix: "auth:login",
    } as RateLimitOptions,

    REGISTER: {
      points: 3,
      duration: 3600, // 1 hour
      keyPrefix: "auth:register",
    } as RateLimitOptions,

    PASSWORD_RESET: {
      points: 3,
      duration: 3600, // 1 hour
      keyPrefix: "auth:password-reset",
    } as RateLimitOptions,

    VERIFY_EMAIL: {
      points: 10,
      duration: 3600, // 1 hour
      keyPrefix: "auth:verify-email",
    } as RateLimitOptions,

    TWO_FACTOR: {
      points: 5,
      duration: 300, // 5 minutes
      keyPrefix: "auth:2fa",
    } as RateLimitOptions,
  },

  // API endpoints
  API: {
    STRICT: {
      points: 10,
      duration: 60, // 1 minute
      keyPrefix: "api:strict",
    } as RateLimitOptions,

    STANDARD: {
      points: 60,
      duration: 60, // 1 minute
      keyPrefix: "api:standard",
    } as RateLimitOptions,

    RELAXED: {
      points: 120,
      duration: 60, // 1 minute
      keyPrefix: "api:relaxed",
    } as RateLimitOptions,
  },

  // GraphQL
  GRAPHQL: {
    QUERY: {
      points: 100,
      duration: 60, // 1 minute
      keyPrefix: "graphql:query",
    } as RateLimitOptions,

    MUTATION: {
      points: 20,
      duration: 60, // 1 minute
      keyPrefix: "graphql:mutation",
    } as RateLimitOptions,
  },

  // File operations
  FILE: {
    UPLOAD: {
      points: 10,
      duration: 3600, // 1 hour
      keyPrefix: "file:upload",
    } as RateLimitOptions,

    DOWNLOAD: {
      points: 100,
      duration: 3600, // 1 hour
      keyPrefix: "file:download",
    } as RateLimitOptions,
  },

  // Email operations
  EMAIL: {
    SEND: {
      points: 10,
      duration: 3600, // 1 hour
      keyPrefix: "email:send",
    } as RateLimitOptions,
  },
};

// Helper function to create custom rate limits
export const createRateLimit = (
  points: number,
  durationInSeconds: number,
  keyPrefix?: string,
): RateLimitOptions => ({
  points,
  duration: durationInSeconds,
  keyPrefix: keyPrefix || "custom",
});

// Rate limit tiers based on user plan
export const PlanRateLimits = {
  FREE: {
    multiplier: 1,
    maxRequestsPerDay: 1000,
  },
  STARTER: {
    multiplier: 2,
    maxRequestsPerDay: 10000,
  },
  PROFESSIONAL: {
    multiplier: 5,
    maxRequestsPerDay: 50000,
  },
  ENTERPRISE: {
    multiplier: 10,
    maxRequestsPerDay: -1, // Unlimited
  },
};

// Function to apply plan multiplier to rate limits
export const applyPlanMultiplier = (
  rateLimit: RateLimitOptions,
  plan: keyof typeof PlanRateLimits,
): RateLimitOptions => {
  const multiplier = PlanRateLimits[plan]?.multiplier || 1;
  return {
    ...rateLimit,
    points: Math.floor(rateLimit.points * multiplier),
  };
};
