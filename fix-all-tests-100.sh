#!/bin/bash

# Comprehensive Test Fix Script for 100% Coverage
# This script systematically fixes all test issues

set -e

echo "🚀 Starting Comprehensive Test Fix Process..."
echo "==========================================="

# Navigate to project root
cd "$(dirname "$0")"

# Function to create or update test files
create_test_file() {
  local file_path=$1
  local content=$2
  
  echo "📝 Creating/updating test: $file_path"
  cat > "$file_path" << EOF
$content
EOF
}

echo ""
echo "🔧 Step 1: Fixing Import/Export Module Tests"
echo "==========================================="

# Fix import-export resolver test
create_test_file "apps/api/src/modules/import-export/import-export.resolver.spec.ts" 'import { Test, TestingModule } from "@nestjs/testing";
import { ImportExportResolver } from "./import-export.resolver";
import { ImportExportService } from "./import-export.service";

describe("ImportExportResolver", () => {
  let resolver: ImportExportResolver;
  let service: ImportExportService;

  const mockService = {
    importContacts: jest.fn(),
    exportContacts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportExportResolver,
        {
          provide: ImportExportService,
          useValue: mockService,
        },
      ],
    }).compile();

    resolver = module.get<ImportExportResolver>(ImportExportResolver);
    service = module.get<ImportExportService>(ImportExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("importContacts", () => {
    it("should import contacts successfully", async () => {
      const mockInput = {
        workspaceId: "workspace-123",
        file: { data: "csv data" },
        options: { skipDuplicates: true },
      };

      const mockResult = {
        imported: 10,
        skipped: 2,
        errors: [],
      };

      mockService.importContacts.mockResolvedValue(mockResult);

      const result = await resolver.importContacts(
        mockInput.workspaceId,
        mockInput.file,
        mockInput.options
      );

      expect(result).toEqual(mockResult);
      expect(service.importContacts).toHaveBeenCalledWith(
        mockInput.workspaceId,
        mockInput.file,
        mockInput.options
      );
    });
  });

  describe("exportContacts", () => {
    it("should export contacts successfully", async () => {
      const mockResult = {
        url: "https://example.com/export.csv",
        filename: "contacts-export.csv",
        format: "CSV",
        count: 50,
      };

      mockService.exportContacts.mockResolvedValue(mockResult);

      const result = await resolver.exportContacts(
        "workspace-123",
        "CSV",
        { status: "ACTIVE" }
      );

      expect(result).toEqual(mockResult);
      expect(service.exportContacts).toHaveBeenCalledWith(
        "workspace-123",
        "CSV",
        { status: "ACTIVE" }
      );
    });
  });
});'

echo ""
echo "🔧 Step 2: Fixing Health Module Tests"
echo "===================================="

# Add missing test for metrics controller
create_test_file "apps/api/src/modules/health/metrics.controller.spec.ts" 'import { Test, TestingModule } from "@nestjs/testing";
import { MetricsController } from "./metrics.controller";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";

describe("MetricsController", () => {
  let controller: MetricsController;
  let prismaService: PrismaService;
  let redisService: RedisService;

  const mockPrismaService = {
    user: { count: jest.fn() },
    workspace: { count: jest.fn() },
    contact: { count: jest.fn() },
    email: { count: jest.fn() },
    $queryRaw: jest.fn(),
  };

  const mockRedisService = {
    getClient: jest.fn(() => ({
      dbsize: jest.fn().mockResolvedValue(100),
      info: jest.fn().mockResolvedValue("used_memory_human:1M"),
    })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MetricsController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    controller = module.get<MetricsController>(MetricsController);
    prismaService = module.get<PrismaService>(PrismaService);
    redisService = module.get<RedisService>(RedisService);
  });

  describe("getMetrics", () => {
    it("should return system metrics", async () => {
      mockPrismaService.user.count.mockResolvedValue(10);
      mockPrismaService.workspace.count.mockResolvedValue(5);
      mockPrismaService.contact.count.mockResolvedValue(100);
      mockPrismaService.email.count.mockResolvedValue(500);
      mockPrismaService.$queryRaw.mockResolvedValue([{ size: "100MB" }]);

      const result = await controller.getMetrics();

      expect(result).toEqual({
        users: 10,
        workspaces: 5,
        contacts: 100,
        emails: 500,
        database: { size: "100MB" },
        redis: {
          keys: 100,
          memory: "1M",
        },
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });
});'

echo ""
echo "🔧 Step 3: Fixing Email Module Tests"
echo "=================================="

# Add test for email module
create_test_file "apps/api/src/modules/email/email.module.spec.ts" 'import { Test } from "@nestjs/testing";
import { EmailModule } from "./email.module";
import { EmailService } from "./email.service";

describe("EmailModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [EmailModule],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(EmailService)).toBeDefined();
  });
});'

echo ""
echo "🔧 Step 4: Fixing Module Registration Tests"
echo "========================================"

# Fix auth module test
create_test_file "apps/api/src/modules/auth/auth.module.spec.ts" 'import { Test } from "@nestjs/testing";
import { AuthModule } from "./auth.module";

describe("AuthModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [AuthModule],
    }).compile();

    expect(module).toBeDefined();
  });
});'

# Fix AI module test
create_test_file "apps/api/src/modules/ai/ai.module.spec.ts" 'import { Test } from "@nestjs/testing";
import { AiModule } from "./ai.module";

describe("AiModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [AiModule],
    }).compile();

    expect(module).toBeDefined();
  });
});'

echo ""
echo "🔧 Step 5: Fixing Gmail Module Tests"
echo "=================================="

# Fix gmail module test
create_test_file "apps/api/src/modules/gmail/gmail.module.spec.ts" 'import { Test } from "@nestjs/testing";
import { GmailModule } from "./gmail.module";

describe("GmailModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [GmailModule],
    }).compile();

    expect(module).toBeDefined();
  });
});'

echo ""
echo "🔧 Step 6: Running API Tests"
echo "=========================="

cd apps/api

# Run tests
echo "Running API tests..."
if pnpm test --silent 2>&1; then
  echo "✅ API tests passed!"
else
  echo "❌ Some API tests failed. Checking details..."
  
  # Show failing tests
  pnpm test 2>&1 | grep -A 5 "FAIL" || true
fi

# Check coverage
echo ""
echo "📊 API Test Coverage:"
pnpm test:cov --silent 2>&1 | grep -E "(Statements|Branches|Functions|Lines)" | tail -1 || echo "Coverage check failed"

cd ../..

echo ""
echo "🔧 Step 7: Running Web Tests"
echo "=========================="

cd apps/web

# Run tests
echo "Running Web tests..."
if pnpm test --silent 2>&1; then
  echo "✅ Web tests passed!"
else
  echo "❌ Some Web tests failed. Checking details..."
  
  # Show failing tests
  pnpm test 2>&1 | grep -A 5 "FAIL" || true
fi

# Check coverage
echo ""
echo "📊 Web Test Coverage:"
pnpm test --coverage --silent 2>&1 | grep -E "(Statements|Branches|Functions|Lines)" | tail -1 || echo "Coverage check failed"

cd ../..

echo ""
echo "✅ Test fix process complete!"
echo ""
echo "Summary:"
echo "- Created/updated missing test files"
echo "- Fixed module compilation tests"
echo "- Ran all tests and checked coverage"
echo ""
echo "Next steps:"
echo "1. Review any remaining failures"
echo "2. Run 'pnpm test' in each app directory"
echo "3. Fix any remaining issues manually"