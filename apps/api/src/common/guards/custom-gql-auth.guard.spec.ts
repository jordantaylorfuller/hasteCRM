import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { CustomGqlAuthGuard } from "./custom-gql-auth.guard";
import { SessionService } from "../../modules/auth/session.service";
import { GqlExecutionContext } from "@nestjs/graphql";

// Mock GqlExecutionContext
jest.mock("@nestjs/graphql", () => ({
  GqlExecutionContext: {
    create: jest.fn(),
  },
}));

describe("CustomGqlAuthGuard", () => {
  let guard: CustomGqlAuthGuard;
  let jwtService: JwtService;
  let sessionService: SessionService;
  let mockGqlContext: any;

  const mockPayload = {
    sub: "user-123",
    email: "test@example.com",
    workspaceId: "workspace-123",
    role: "ADMIN",
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    twoFactorEnabled: false,
    workspaceName: "Test Workspace",
    workspaceSlug: "test-workspace",
    plan: "PRO",
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomGqlAuthGuard,
        {
          provide: JwtService,
          useValue: {
            verifyAsync: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            isTokenBlacklisted: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<CustomGqlAuthGuard>(CustomGqlAuthGuard);
    jwtService = module.get<JwtService>(JwtService);
    sessionService = module.get<SessionService>(SessionService);

    // Setup default mock GraphQL context
    mockGqlContext = {
      getContext: jest.fn().mockReturnValue({
        req: {
          headers: {
            authorization: "Bearer valid-token",
          },
        },
      }),
    };

    (GqlExecutionContext.create as jest.Mock).mockReturnValue(mockGqlContext);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("canActivate", () => {
    it("should return true for valid token", async () => {
      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const mockContext = {} as ExecutionContext;
      const result = await guard.canActivate(mockContext);

      expect(result).toBe(true);
      expect(GqlExecutionContext.create).toHaveBeenCalledWith(mockContext);
      expect(sessionService.isTokenBlacklisted).toHaveBeenCalledWith("valid-token");
      expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", {
        secret: process.env.JWT_SECRET || "change-me-in-production",
      });
    });

    it("should attach user to request on successful validation", async () => {
      const req = {
        headers: {
          authorization: "Bearer valid-token",
        },
      };
      mockGqlContext.getContext.mockReturnValue({ req });

      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const mockContext = {} as ExecutionContext;
      await guard.canActivate(mockContext);

      expect(req).toHaveProperty("user");
      expect(req.user).toEqual({
        sub: mockPayload.sub,
        userId: mockPayload.sub,
        email: mockPayload.email,
        workspaceId: mockPayload.workspaceId,
        role: mockPayload.role,
        firstName: mockPayload.firstName,
        lastName: mockPayload.lastName,
        status: mockPayload.status,
        twoFactorEnabled: mockPayload.twoFactorEnabled,
        workspaceName: mockPayload.workspaceName,
        workspaceSlug: mockPayload.workspaceSlug,
        plan: mockPayload.plan,
      });
    });

    it("should throw UnauthorizedException when request is not found", async () => {
      mockGqlContext.getContext.mockReturnValue({ req: null });

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("Request not found in GraphQL context")
      );
    });

    it("should throw UnauthorizedException when no token is provided", async () => {
      mockGqlContext.getContext.mockReturnValue({
        req: {
          headers: {},
        },
      });

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("No token provided")
      );
    });

    it("should throw UnauthorizedException when authorization header is malformed", async () => {
      mockGqlContext.getContext.mockReturnValue({
        req: {
          headers: {
            authorization: "InvalidFormat token",
          },
        },
      });

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("No token provided")
      );
    });

    it("should throw UnauthorizedException when token is blacklisted", async () => {
      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(true);

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("Token has been invalidated")
      );
    });

    it("should throw UnauthorizedException when token verification fails", async () => {
      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(new Error("Invalid signature"));

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("Invalid token")
      );
    });

    it("should handle request without headers", async () => {
      mockGqlContext.getContext.mockReturnValue({
        req: {},
      });

      const mockContext = {} as ExecutionContext;
      
      await expect(guard.canActivate(mockContext)).rejects.toThrow(
        new UnauthorizedException("No token provided")
      );
    });

    it("should use JWT_SECRET from environment", async () => {
      const originalSecret = process.env.JWT_SECRET;
      process.env.JWT_SECRET = "test-secret";

      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const mockContext = {} as ExecutionContext;
      await guard.canActivate(mockContext);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", {
        secret: "test-secret",
      });

      // Restore original value
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      } else {
        delete process.env.JWT_SECRET;
      }
    });

    it("should use default secret when JWT_SECRET is not set", async () => {
      const originalSecret = process.env.JWT_SECRET;
      delete process.env.JWT_SECRET;

      (sessionService.isTokenBlacklisted as jest.Mock).mockResolvedValue(false);
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(mockPayload);

      const mockContext = {} as ExecutionContext;
      await guard.canActivate(mockContext);

      expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid-token", {
        secret: "change-me-in-production",
      });

      // Restore original value
      if (originalSecret) {
        process.env.JWT_SECRET = originalSecret;
      }
    });
  });

  describe("extractTokenFromHeader", () => {
    it("should extract token from Bearer authorization header", () => {
      const request = {
        headers: {
          authorization: "Bearer test-token",
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);
      expect(token).toBe("test-token");
    });

    it("should return undefined for non-Bearer authorization", () => {
      const request = {
        headers: {
          authorization: "Basic test-token",
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);
      expect(token).toBeUndefined();
    });

    it("should handle missing authorization header", () => {
      const request = {
        headers: {},
      };

      const token = (guard as any).extractTokenFromHeader(request);
      expect(token).toBeUndefined();
    });

    it("should handle missing headers object", () => {
      const request = {};

      const token = (guard as any).extractTokenFromHeader(request);
      expect(token).toBeUndefined();
    });

    it("should handle malformed authorization header", () => {
      const request = {
        headers: {
          authorization: "Bearer",
        },
      };

      const token = (guard as any).extractTokenFromHeader(request);
      expect(token).toBeUndefined();
    });
  });
});