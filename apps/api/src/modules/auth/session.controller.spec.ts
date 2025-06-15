import { Test, TestingModule } from "@nestjs/testing";
import { SessionController } from "./session.controller";
import { SessionService } from "./session.service";
import { JwtAuthGuard } from "../../common/guards/jwt-auth.guard";
import { RateLimitGuard } from "../../common/guards/rate-limit.guard";

describe("SessionController", () => {
  let controller: SessionController;
  let sessionService: SessionService;

  const mockSessionService = {
    getUserActiveSessions: jest.fn(),
    invalidateSession: jest.fn(),
    invalidateAllUserSessions: jest.fn(),
  };

  const mockRequest = {
    user: {
      sub: "user-123",
      userId: "user-123",
      email: "test@example.com",
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SessionController],
      providers: [
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(RateLimitGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<SessionController>(SessionController);
    sessionService = module.get<SessionService>(SessionService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("getUserSessions", () => {
    it("should return user active sessions", async () => {
      const mockSessions = [
        {
          id: "session-1",
          userId: "user-123",
          device: "Chrome on Windows",
          ipAddress: "192.168.1.1",
          lastActive: new Date(),
          createdAt: new Date(),
        },
        {
          id: "session-2",
          userId: "user-123",
          device: "Safari on macOS",
          ipAddress: "192.168.1.2",
          lastActive: new Date(),
          createdAt: new Date(),
        },
      ];

      mockSessionService.getUserActiveSessions.mockResolvedValue(mockSessions);

      const result = await controller.getUserSessions(mockRequest);

      expect(sessionService.getUserActiveSessions).toHaveBeenCalledWith(
        "user-123",
      );
      expect(result).toEqual(mockSessions);
    });

    it("should return empty array when no sessions", async () => {
      mockSessionService.getUserActiveSessions.mockResolvedValue([]);

      const result = await controller.getUserSessions(mockRequest);

      expect(result).toEqual([]);
    });
  });

  describe("revokeSession", () => {
    it("should revoke a specific session", async () => {
      mockSessionService.invalidateSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession(mockRequest, "session-123");

      expect(sessionService.invalidateSession).toHaveBeenCalledWith(
        "session-123",
      );
      expect(result).toEqual({ message: "Session revoked successfully" });
    });

    it("should handle non-existent session", async () => {
      mockSessionService.invalidateSession.mockResolvedValue(undefined);

      const result = await controller.revokeSession(
        mockRequest,
        "non-existent",
      );

      expect(sessionService.invalidateSession).toHaveBeenCalledWith(
        "non-existent",
      );
      expect(result).toEqual({ message: "Session revoked successfully" });
    });
  });

  describe("revokeAllSessions", () => {
    it("should revoke all user sessions", async () => {
      mockSessionService.invalidateAllUserSessions.mockResolvedValue(undefined);

      const result = await controller.revokeAllSessions(mockRequest);

      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(
        "user-123",
      );
      expect(result).toEqual({ message: "All sessions revoked successfully" });
    });

    it("should handle user with no sessions", async () => {
      mockSessionService.invalidateAllUserSessions.mockResolvedValue(undefined);

      const result = await controller.revokeAllSessions(mockRequest);

      expect(sessionService.invalidateAllUserSessions).toHaveBeenCalledWith(
        "user-123",
      );
      expect(result).toEqual({ message: "All sessions revoked successfully" });
    });
  });
});
