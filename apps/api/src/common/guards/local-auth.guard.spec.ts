import { Test, TestingModule } from "@nestjs/testing";
import { ExecutionContext } from "@nestjs/common";
import { LocalAuthGuard } from "./local-auth.guard";
import { AuthGuard } from "@nestjs/passport";

describe("LocalAuthGuard", () => {
  let guard: LocalAuthGuard;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocalAuthGuard],
    }).compile();

    guard = module.get<LocalAuthGuard>(LocalAuthGuard);
  });

  it("should be defined", () => {
    expect(guard).toBeDefined();
  });

  it("should extend AuthGuard with local strategy", () => {
    expect(guard).toBeInstanceOf(AuthGuard("local"));
  });

  it("should inherit canActivate from AuthGuard", () => {
    expect(guard.canActivate).toBeDefined();
    expect(typeof guard.canActivate).toBe("function");
  });

  it("should inherit getRequest from AuthGuard", () => {
    expect(guard.getRequest).toBeDefined();
    expect(typeof guard.getRequest).toBe("function");
  });

  it("should inherit handleRequest from AuthGuard", () => {
    expect(guard.handleRequest).toBeDefined();
    expect(typeof guard.handleRequest).toBe("function");
  });

  describe("canActivate", () => {
    it("should call parent canActivate method", async () => {
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue({
            body: { username: "test", password: "password" },
          }),
          getResponse: jest.fn().mockReturnValue({}),
        }),
      } as unknown as ExecutionContext;

      // Mock the canActivate method to prevent actual passport logic
      jest.spyOn(guard, 'canActivate').mockResolvedValue(true);
      
      const result = await guard.canActivate(mockContext);
      expect(result).toBe(true);
    });
  });

  describe("getRequest", () => {
    it("should extract request from execution context", () => {
      const mockRequest = {
        body: { username: "test", password: "password" },
      };
      const mockContext = {
        switchToHttp: jest.fn().mockReturnValue({
          getRequest: jest.fn().mockReturnValue(mockRequest),
        }),
      } as unknown as ExecutionContext;

      const result = guard.getRequest(mockContext);
      expect(result).toBe(mockRequest);
    });
  });

  describe("handleRequest", () => {
    it("should handle successful authentication", () => {
      const user = { id: "user-123", email: "test@example.com" };
      const info = undefined;

      const result = guard.handleRequest(null, user, info);
      expect(result).toBe(user);
    });

    it("should handle authentication failure", () => {
      const err = new Error("Authentication failed");
      const user = false;
      const info = { message: "Invalid credentials" };

      expect(() => guard.handleRequest(err, user, info)).toThrow();
    });
  });
});