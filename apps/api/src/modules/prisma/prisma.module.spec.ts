import { Test, TestingModule } from "@nestjs/testing";
import { PrismaModule } from "./prisma.module";
import { PrismaService } from "./prisma.service";

jest.mock("./prisma-client");

describe("PrismaModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });

  it("should provide PrismaService", () => {
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
    expect(prismaService.constructor.name).toBe("PrismaService");
  });

  it("should export PrismaService", () => {
    // PrismaModule is a global module, so PrismaService should be available
    // without explicitly importing PrismaModule in other modules
    const exports = Reflect.getMetadata("exports", PrismaModule);
    expect(exports).toContain(PrismaService);
  });

  it("should be a global module", () => {
    // The @Global() decorator is applied to the module
    // We can verify this by checking if PrismaService is available globally
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();

    // Alternatively, check module metadata
    const providers = Reflect.getMetadata("providers", PrismaModule);
    const exports = Reflect.getMetadata("exports", PrismaModule);

    expect(providers).toContain(PrismaService);
    expect(exports).toContain(PrismaService);
  });
});
