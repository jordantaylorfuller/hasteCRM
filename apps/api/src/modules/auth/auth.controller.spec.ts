import { Test, TestingModule } from "@nestjs/testing";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RefreshJwtAuthGuard } from "../../common/guards/refresh-jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";
import { Request, Response } from "express";
import { AuthGuard } from "@nestjs/passport";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockUser = {
    id: "user-123",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    status: "ACTIVE",
    twoFactorEnabled: false,
  };

  const mockWorkspace = {
    id: "workspace-123",
    name: "Test Workspace",
    slug: "test-workspace",
    plan: "FREE",
  };

  const mockAuthResponse = {
    user: mockUser,
    workspace: mockWorkspace,
    accessToken: "access-token",
    refreshToken: "refresh-token",
  };

  const mockRequest = {
    user: { sub: "user-123", userId: "user-123" },
    headers: {
      authorization: "Bearer access-token",
    },
  } as unknown as Request;

  const mockResponse = {
    redirect: jest.fn(),
  } as unknown as Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            login: jest.fn(),
            loginWithTwoFactor: jest.fn(),
            register: jest.fn(),
            refreshTokens: jest.fn(),
            logout: jest.fn(),
            getCurrentUser: jest.fn(),
            verifyEmail: jest.fn(),
            requestPasswordReset: jest.fn(),
            resetPassword: jest.fn(),
            resendVerificationEmail: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RefreshJwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AuthGuard("google"))
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("login", () => {
    it("should login user successfully", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "Password123!",
      };

      (authService.login as jest.Mock).mockResolvedValue(mockAuthResponse);

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe("register", () => {
    it("should register user successfully", async () => {
      const registerDto = {
        email: "new@example.com",
        password: "Password123!",
        firstName: "New",
        lastName: "User",
        workspaceName: "New Workspace",
      };

      (authService.register as jest.Mock).mockResolvedValue(mockAuthResponse);

      const result = await controller.register(registerDto);

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(result).toEqual(mockAuthResponse);
    });

    it("should handle registration errors", async () => {
      const registerDto = {
        email: "existing@example.com",
        password: "Password123!",
        firstName: "Existing",
        lastName: "User",
        workspaceName: "Existing Workspace",
      };

      const mockError = new Error("Email already exists");
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      (authService.register as jest.Mock).mockRejectedValue(mockError);

      await expect(controller.register(registerDto)).rejects.toThrow(
        "Email already exists",
      );

      expect(authService.register).toHaveBeenCalledWith(registerDto);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Registration error:",
        mockError,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("loginWithTwoFactor", () => {
    it("should login with 2FA successfully", async () => {
      const loginDto = {
        email: "test@example.com",
        password: "Password123!",
        code: "123456",
      };

      (authService.loginWithTwoFactor as jest.Mock).mockResolvedValue(
        mockAuthResponse,
      );

      const result = await controller.loginWithTwoFactor(loginDto);

      expect(authService.loginWithTwoFactor).toHaveBeenCalledWith(loginDto);
      expect(result).toEqual(mockAuthResponse);
    });
  });

  describe("refresh", () => {
    it("should refresh tokens successfully", async () => {
      const newTokens = {
        accessToken: "new-access-token",
        refreshToken: "new-refresh-token",
      };

      (authService.refreshTokens as jest.Mock).mockResolvedValue(newTokens);

      const result = await controller.refresh(mockRequest);

      expect(authService.refreshTokens).toHaveBeenCalledWith("user-123");
      expect(result).toEqual(newTokens);
    });
  });

  describe("logout", () => {
    it("should logout user successfully", async () => {
      (authService.logout as jest.Mock).mockResolvedValue(undefined);

      const result = await controller.logout(mockRequest);

      expect(authService.logout).toHaveBeenCalledWith("access-token");
      expect(result).toEqual({ message: "Logged out successfully" });
    });

    it("should handle missing authorization header", async () => {
      const requestWithoutAuth = {
        headers: {},
      } as unknown as Request;

      const result = await controller.logout(requestWithoutAuth);

      expect(authService.logout).not.toHaveBeenCalled();
      expect(result).toEqual({ message: "Logged out successfully" });
    });
  });

  describe("me", () => {
    it("should return current user info", async () => {
      (authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.me(mockRequest);

      expect(authService.getCurrentUser).toHaveBeenCalledWith("user-123");
      expect(result).toEqual(mockUser);
    });

    it("should return JWT payload if getCurrentUser fails", async () => {
      (authService.getCurrentUser as jest.Mock).mockRejectedValue(
        new Error("User not found"),
      );

      const result = await controller.me(mockRequest);

      expect(result).toEqual(mockRequest.user);
    });
  });

  describe("googleAuthCallback", () => {
    it("should redirect with tokens after successful Google auth", async () => {
      const googleRequest = {
        user: mockAuthResponse,
      } as unknown as Request;

      await controller.googleAuthCallback(googleRequest, mockResponse);

      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining("accessToken=access-token"),
      );
      expect(mockResponse.redirect).toHaveBeenCalledWith(
        expect.stringContaining("refreshToken=refresh-token"),
      );
    });
  });

  describe("verifyEmail", () => {
    it("should verify email with token", async () => {
      const verifyResult = { message: "Email verified successfully" };
      (authService.verifyEmail as jest.Mock).mockResolvedValue(verifyResult);

      const result = await controller.verifyEmail("verify-token");

      expect(authService.verifyEmail).toHaveBeenCalledWith("verify-token");
      expect(result).toEqual(verifyResult);
    });
  });

  describe("resendVerification", () => {
    it("should resend verification email", async () => {
      const resendResult = { message: "Verification email sent" };
      (authService.resendVerificationEmail as jest.Mock).mockResolvedValue(
        resendResult,
      );

      const result = await controller.resendVerification("test@example.com");

      expect(authService.resendVerificationEmail).toHaveBeenCalledWith(
        "test@example.com",
      );
      expect(result).toEqual(resendResult);
    });
  });

  describe("forgotPassword", () => {
    it("should initiate password reset", async () => {
      const resetResult = { message: "Password reset email sent" };
      (authService.requestPasswordReset as jest.Mock).mockResolvedValue(
        resetResult,
      );

      const result = await controller.forgotPassword("test@example.com");

      expect(authService.requestPasswordReset).toHaveBeenCalledWith(
        "test@example.com",
      );
      expect(result).toEqual(resetResult);
    });
  });

  describe("resetPassword", () => {
    it("should reset password with valid token", async () => {
      const resetResult = { message: "Password reset successfully" };
      (authService.resetPassword as jest.Mock).mockResolvedValue(resetResult);

      const result = await controller.resetPassword(
        "reset-token",
        "NewPassword123!",
      );

      expect(authService.resetPassword).toHaveBeenCalledWith(
        "reset-token",
        "NewPassword123!",
      );
      expect(result).toEqual(resetResult);
    });
  });
});
