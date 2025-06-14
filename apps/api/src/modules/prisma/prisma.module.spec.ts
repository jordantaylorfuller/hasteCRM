import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule } from './prisma.module';
import { PrismaService } from './prisma.service';

describe('PrismaModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
    }).compile();
  });

  it('should be defined', () => {
    expect(module).toBeDefined();
  });

  it('should provide PrismaService', () => {
    const prismaService = module.get<PrismaService>(PrismaService);
    expect(prismaService).toBeDefined();
    expect(prismaService).toBeInstanceOf(PrismaService);
  });

  it('should export PrismaService', () => {
    // PrismaModule is a global module, so PrismaService should be available
    // without explicitly importing PrismaModule in other modules
    const exports = Reflect.getMetadata('exports', PrismaModule);
    expect(exports).toContain(PrismaService);
  });

  it('should be a global module', () => {
    const isGlobal = Reflect.getMetadata('global', PrismaModule);
    expect(isGlobal).toBe(true);
  });
});