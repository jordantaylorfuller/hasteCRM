import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "./prisma.service";
import { INestApplication } from "@nestjs/common";

describe("PrismaService", () => {
  let service: PrismaService;
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    service = module.get<PrismaService>(PrismaService);

    // Mock app for testing
    app = {
      close: jest.fn(),
    } as any;
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("onModuleInit", () => {
    it("should connect to database on module init", async () => {
      const connectSpy = jest
        .spyOn(service, "$connect")
        .mockResolvedValue(undefined);

      await service.onModuleInit();

      expect(connectSpy).toHaveBeenCalled();

      connectSpy.mockRestore();
    });

    it("should handle connection errors", async () => {
      const error = new Error("Connection failed");
      const connectSpy = jest
        .spyOn(service, "$connect")
        .mockRejectedValue(error);
      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      await expect(service.onModuleInit()).rejects.toThrow(error);

      expect(connectSpy).toHaveBeenCalled();

      connectSpy.mockRestore();
      consoleErrorSpy.mockRestore();
    });
  });

  describe("enableShutdownHooks", () => {
    it("should setup shutdown hooks", async () => {
      const onSpy = jest
        .spyOn(service, "$on")
        .mockImplementation((event, callback) => {
          // Simulate beforeExit event
          if (event === "beforeExit") {
            callback();
          }
        });

      await service.enableShutdownHooks(app);

      expect(onSpy).toHaveBeenCalledWith("beforeExit", expect.any(Function));
      expect(app.close).toHaveBeenCalled();

      onSpy.mockRestore();
    });
  });

  describe("database operations", () => {
    it("should have access to all Prisma models", () => {
      // Check that common models are accessible
      expect(service.user).toBeDefined();
      expect(service.workspace).toBeDefined();
      expect(service.contact).toBeDefined();
      expect(service.company).toBeDefined();
      expect(service.deal).toBeDefined();
      expect(service.pipeline).toBeDefined();
      expect(service.emailAccount).toBeDefined();
      expect(service.email).toBeDefined();
    });

    it("should handle transaction", async () => {
      const mockTransaction = jest.fn().mockImplementation(async (callback) => {
        const mockPrisma = {
          user: {
            create: jest.fn().mockResolvedValue({ id: "user-123" }),
            findUnique: jest
              .fn()
              .mockResolvedValue({ id: "user-123", email: "test@example.com" }),
          },
          workspace: {
            create: jest.fn().mockResolvedValue({ id: "workspace-123" }),
          },
        };
        return callback(mockPrisma);
      });

      service.$transaction = mockTransaction;

      const result = await service.$transaction(async (prisma) => {
        const user = await prisma.user.create({
          data: { email: "test@example.com" },
        });
        const workspace = await prisma.workspace.create({
          data: { name: "Test Workspace" },
        });
        return { user, workspace };
      });

      expect(mockTransaction).toHaveBeenCalled();
      expect(result.user.id).toBe("user-123");
      expect(result.workspace.id).toBe("workspace-123");
    });
  });

  describe("middleware and extensions", () => {
    it("should support middleware for logging", async () => {
      const useSpy = jest.spyOn(service, "$use").mockImplementation();

      const loggingMiddleware = async (params: any, next: any) => {
        console.log("Query:", params.model, params.action);
        return next(params);
      };

      service.$use(loggingMiddleware);

      expect(useSpy).toHaveBeenCalledWith(loggingMiddleware);

      useSpy.mockRestore();
    });
  });

  describe("error handling", () => {
    it("should handle Prisma known errors", async () => {
      const error = {
        code: "P2002",
        meta: { target: ["email"] },
      };

      // Mock a unique constraint violation
      jest.spyOn(service.user, "create").mockRejectedValue(error);

      await expect(
        service.user.create({
          data: {
            email: "duplicate@example.com",
            password: "password123",
            workspaceId: "workspace-123",
          },
        }),
      ).rejects.toMatchObject({
        code: "P2002",
      });
    });

    it("should handle record not found errors", async () => {
      const error = {
        code: "P2025",
        meta: { cause: "Record to update not found." },
      };

      jest.spyOn(service.user, "update").mockRejectedValue(error);

      await expect(
        service.user.update({
          where: { id: "non-existent" },
          data: { email: "new@example.com" },
        }),
      ).rejects.toMatchObject({
        code: "P2025",
      });
    });
  });

  describe("cleanup", () => {
    it("should disconnect on module destroy", async () => {
      const disconnectSpy = jest
        .spyOn(service, "$disconnect")
        .mockResolvedValue(undefined);

      await service.onModuleDestroy();

      expect(disconnectSpy).toHaveBeenCalled();

      disconnectSpy.mockRestore();
    });
  });

  describe("cleanDatabase", () => {
    let originalEnv: string | undefined;

    beforeEach(() => {
      originalEnv = process.env.NODE_ENV;
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it("should throw error in production environment", async () => {
      process.env.NODE_ENV = "production";

      await expect(service.cleanDatabase()).rejects.toThrow(
        "cleanDatabase is not allowed in production"
      );
    });

    it("should clean all database tables in non-production environment", async () => {
      process.env.NODE_ENV = "test";

      // Mock the deleteMany methods
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 5 });
      
      // Mock Reflect.ownKeys to return only our test models
      jest.spyOn(Reflect, 'ownKeys').mockReturnValue(['user', 'workspace', 'contact', 'company', '_internal', '$connect']);
      
      // Mock some models
      (service as any).user = { deleteMany: mockDeleteMany };
      (service as any).workspace = { deleteMany: mockDeleteMany };
      (service as any).contact = { deleteMany: mockDeleteMany };
      (service as any).company = { deleteMany: mockDeleteMany };
      (service as any)._internal = { deleteMany: mockDeleteMany }; // Should be ignored
      (service as any).$connect = jest.fn(); // Should be ignored

      const result = await service.cleanDatabase();

      // Should call deleteMany for each model (except those starting with _ or $)
      expect(mockDeleteMany).toHaveBeenCalledTimes(4);
      expect(result).toHaveLength(4);
      expect(result).toEqual([
        { count: 5 },
        { count: 5 },
        { count: 5 },
        { count: 5 }
      ]);
      
      // Restore Reflect.ownKeys
      jest.restoreAllMocks();
    });

    it("should handle models without deleteMany method", async () => {
      process.env.NODE_ENV = "development";

      // Mock Reflect.ownKeys to return only our test models
      jest.spyOn(Reflect, 'ownKeys').mockReturnValue(['user', 'workspace', 'someModel', 'anotherModel']);

      // Mock models with and without deleteMany
      const mockDeleteMany = jest.fn().mockResolvedValue({ count: 3 });
      (service as any).user = { deleteMany: mockDeleteMany };
      (service as any).workspace = { deleteMany: mockDeleteMany };
      (service as any).someModel = {}; // No deleteMany method
      (service as any).anotherModel = null; // Null model

      const result = await service.cleanDatabase();

      // Should only call deleteMany for models that have it
      expect(mockDeleteMany).toHaveBeenCalledTimes(2);
      expect(result).toHaveLength(2);
      expect(result).toEqual([
        { count: 3 },
        { count: 3 }
      ]);
      
      // Restore Reflect.ownKeys
      jest.restoreAllMocks();
    });

    it("should handle errors during cleanup", async () => {
      process.env.NODE_ENV = "test";

      // Mock Reflect.ownKeys to return only our test models
      jest.spyOn(Reflect, 'ownKeys').mockReturnValue(['user']);

      const error = new Error("Database cleanup failed");
      const mockDeleteMany = jest.fn().mockRejectedValue(error);
      (service as any).user = { deleteMany: mockDeleteMany };

      await expect(service.cleanDatabase()).rejects.toThrow(error);
      
      // Restore Reflect.ownKeys
      jest.restoreAllMocks();
    });
  });
});
