import { RateLimits, createRateLimit, applyPlanMultiplier, PlanRateLimits } from "./rate-limits";

describe("Rate Limits Configuration", () => {
  describe("RateLimits", () => {
    it("should have AUTH rate limits configured", () => {
      expect(RateLimits.AUTH.LOGIN).toEqual({
        points: 20,
        duration: 900,
        keyPrefix: "auth:login",
      });

      expect(RateLimits.AUTH.REGISTER).toEqual({
        points: 10,
        duration: 3600,
        keyPrefix: "auth:register",
      });

      expect(RateLimits.AUTH.PASSWORD_RESET).toEqual({
        points: 10,
        duration: 3600,
        keyPrefix: "auth:password-reset",
      });

      expect(RateLimits.AUTH.VERIFY_EMAIL).toEqual({
        points: 20,
        duration: 3600,
        keyPrefix: "auth:verify-email",
      });

      expect(RateLimits.AUTH.TWO_FACTOR).toEqual({
        points: 30,
        duration: 300,
        keyPrefix: "auth:2fa",
      });
    });

    it("should have API rate limits configured", () => {
      expect(RateLimits.API.STRICT).toEqual({
        points: 10,
        duration: 60,
        keyPrefix: "api:strict",
      });

      expect(RateLimits.API.STANDARD).toEqual({
        points: 60,
        duration: 60,
        keyPrefix: "api:standard",
      });

      expect(RateLimits.API.RELAXED).toEqual({
        points: 120,
        duration: 60,
        keyPrefix: "api:relaxed",
      });
    });

    it("should have GraphQL rate limits configured", () => {
      expect(RateLimits.GRAPHQL.QUERY).toEqual({
        points: 100,
        duration: 60,
        keyPrefix: "graphql:query",
      });

      expect(RateLimits.GRAPHQL.MUTATION).toEqual({
        points: 20,
        duration: 60,
        keyPrefix: "graphql:mutation",
      });
    });

    it("should have FILE rate limits configured", () => {
      expect(RateLimits.FILE.UPLOAD).toEqual({
        points: 10,
        duration: 3600,
        keyPrefix: "file:upload",
      });

      expect(RateLimits.FILE.DOWNLOAD).toEqual({
        points: 100,
        duration: 3600,
        keyPrefix: "file:download",
      });
    });

    it("should have EMAIL rate limits configured", () => {
      expect(RateLimits.EMAIL.SEND).toEqual({
        points: 10,
        duration: 3600,
        keyPrefix: "email:send",
      });
    });
  });

  describe("createRateLimit", () => {
    it("should create custom rate limit with provided values", () => {
      const result = createRateLimit(50, 120, "custom:test");

      expect(result).toEqual({
        points: 50,
        duration: 120,
        keyPrefix: "custom:test",
      });
    });

    it("should use default keyPrefix when not provided", () => {
      const result = createRateLimit(100, 300);

      expect(result).toEqual({
        points: 100,
        duration: 300,
        keyPrefix: "custom",
      });
    });
  });

  describe("PlanRateLimits", () => {
    it("should have correct plan limits configured", () => {
      expect(PlanRateLimits.FREE).toEqual({
        multiplier: 1,
        maxRequestsPerDay: 1000,
      });

      expect(PlanRateLimits.STARTER).toEqual({
        multiplier: 2,
        maxRequestsPerDay: 10000,
      });

      expect(PlanRateLimits.PROFESSIONAL).toEqual({
        multiplier: 5,
        maxRequestsPerDay: 50000,
      });

      expect(PlanRateLimits.ENTERPRISE).toEqual({
        multiplier: 10,
        maxRequestsPerDay: -1,
      });
    });
  });

  describe("applyPlanMultiplier", () => {
    const baseRateLimit = {
      points: 10,
      duration: 60,
      keyPrefix: "test",
    };

    it("should apply FREE plan multiplier", () => {
      const result = applyPlanMultiplier(baseRateLimit, "FREE");

      expect(result).toEqual({
        points: 10,
        duration: 60,
        keyPrefix: "test",
      });
    });

    it("should apply STARTER plan multiplier", () => {
      const result = applyPlanMultiplier(baseRateLimit, "STARTER");

      expect(result).toEqual({
        points: 20,
        duration: 60,
        keyPrefix: "test",
      });
    });

    it("should apply PROFESSIONAL plan multiplier", () => {
      const result = applyPlanMultiplier(baseRateLimit, "PROFESSIONAL");

      expect(result).toEqual({
        points: 50,
        duration: 60,
        keyPrefix: "test",
      });
    });

    it("should apply ENTERPRISE plan multiplier", () => {
      const result = applyPlanMultiplier(baseRateLimit, "ENTERPRISE");

      expect(result).toEqual({
        points: 100,
        duration: 60,
        keyPrefix: "test",
      });
    });

    it("should handle decimal points by flooring", () => {
      const rateLimit = {
        points: 15,
        duration: 60,
        keyPrefix: "test",
      };

      const result = applyPlanMultiplier(rateLimit, "STARTER");

      expect(result).toEqual({
        points: 30,
        duration: 60,
        keyPrefix: "test",
      });
    });

    it("should handle invalid plan with default multiplier", () => {
      const result = applyPlanMultiplier(baseRateLimit, "INVALID" as any);

      expect(result).toEqual({
        points: 10,
        duration: 60,
        keyPrefix: "test",
      });
    });
  });
});