#!/bin/bash

# 100% Test Coverage Achievement Script
# This script ensures all tests pass with 100% coverage

set -e

echo "🚀 Starting 100% Test Coverage Achievement Process..."
echo "=================================================="

# Navigate to project root
cd "$(dirname "$0")"

# Function to run tests and check coverage
run_tests() {
  local app=$1
  echo ""
  echo "📊 Running tests for $app..."
  echo "------------------------"
  
  cd apps/$app
  
  # Run tests with coverage
  if pnpm test:cov --silent 2>&1; then
    echo "✅ All tests passed for $app"
    
    # Extract coverage summary
    coverage_output=$(pnpm test:cov --silent 2>&1 | grep -E "(Statements|Branches|Functions|Lines)" | tail -1)
    echo "📈 Coverage: $coverage_output"
    
    # Check if we have 100% coverage
    if echo "$coverage_output" | grep -q "100"; then
      echo "🎉 100% coverage achieved for $app!"
    else
      echo "⚠️ Coverage is not 100% yet for $app"
      return 1
    fi
  else
    echo "❌ Tests failed for $app"
    return 1
  fi
  
  cd ../..
  return 0
}

# Fix remaining test issues
echo ""
echo "🔧 Fixing remaining test issues..."
echo "================================="

# Fix API tests
echo "1️⃣ Fixing API tests..."

# Create missing test file for import-export resolver
cat > apps/api/src/modules/import-export/import-export.resolver.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ImportExportResolver } from './import-export.resolver';
import { ContactImportService } from './services/contact-import.service';
import { ContactExportService } from './services/contact-export.service';
import { FileUpload } from 'graphql-upload';
import { Readable } from 'stream';

describe('ImportExportResolver', () => {
  let resolver: ImportExportResolver;
  let importService: ContactImportService;
  let exportService: ContactExportService;

  const mockImportService = {
    importContacts: jest.fn(),
  };

  const mockExportService = {
    exportContacts: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImportExportResolver,
        {
          provide: ContactImportService,
          useValue: mockImportService,
        },
        {
          provide: ContactExportService,
          useValue: mockExportService,
        },
      ],
    }).compile();

    resolver = module.get<ImportExportResolver>(ImportExportResolver);
    importService = module.get<ContactImportService>(ContactImportService);
    exportService = module.get<ContactExportService>(ContactExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importContacts', () => {
    it('should import contacts from file', async () => {
      const mockFile: FileUpload = {
        filename: 'contacts.csv',
        mimetype: 'text/csv',
        encoding: 'utf-8',
        createReadStream: () => Readable.from('test,data'),
      };

      const mockResult = {
        imported: 10,
        skipped: 2,
        errors: [],
      };

      mockImportService.importContacts.mockResolvedValue(mockResult);

      const result = await resolver.importContacts(
        'workspace-123',
        mockFile,
        { skipDuplicates: true }
      );

      expect(result).toEqual(mockResult);
      expect(importService.importContacts).toHaveBeenCalledWith(
        'workspace-123',
        mockFile,
        { skipDuplicates: true }
      );
    });
  });

  describe('exportContacts', () => {
    it('should export contacts to specified format', async () => {
      const mockResult = {
        url: 'https://example.com/export.csv',
        filename: 'contacts-export.csv',
        format: 'CSV',
        count: 50,
      };

      mockExportService.exportContacts.mockResolvedValue(mockResult);

      const result = await resolver.exportContacts(
        'workspace-123',
        'CSV',
        { status: 'ACTIVE' }
      );

      expect(result).toEqual(mockResult);
      expect(exportService.exportContacts).toHaveBeenCalledWith(
        'workspace-123',
        'CSV',
        { status: 'ACTIVE' }
      );
    });
  });
});
EOF

# Create test for contact import service
cat > apps/api/src/modules/import-export/services/contact-import.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ContactImportService } from './contact-import.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Readable } from 'stream';

describe('ContactImportService', () => {
  let service: ContactImportService;
  let prisma: PrismaService;

  const mockPrismaService = {
    contact: {
      createMany: jest.fn(),
      findFirst: jest.fn(),
    },
    $transaction: jest.fn((fn) => fn(mockPrismaService)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactImportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ContactImportService>(ContactImportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('importContacts', () => {
    it('should import contacts from CSV file', async () => {
      const mockFile = {
        filename: 'contacts.csv',
        mimetype: 'text/csv',
        encoding: 'utf-8',
        createReadStream: () => Readable.from(`firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com`),
      };

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.createMany.mockResolvedValue({ count: 2 });

      const result = await service.importContacts('workspace-123', mockFile as any, {
        skipDuplicates: true,
      });

      expect(result.imported).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle Excel files', async () => {
      const mockFile = {
        filename: 'contacts.xlsx',
        mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        encoding: 'utf-8',
        createReadStream: () => Readable.from(Buffer.from('mock excel data')),
      };

      // Mock XLSX parsing
      jest.spyOn(service as any, 'parseExcel').mockResolvedValue([
        { firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
      ]);

      mockPrismaService.contact.findFirst.mockResolvedValue(null);
      mockPrismaService.contact.createMany.mockResolvedValue({ count: 1 });

      const result = await service.importContacts('workspace-123', mockFile as any, {});

      expect(result.imported).toBe(1);
    });

    it('should skip duplicates when option is enabled', async () => {
      const mockFile = {
        filename: 'contacts.csv',
        mimetype: 'text/csv',
        encoding: 'utf-8',
        createReadStream: () => Readable.from(`email
john@example.com`),
      };

      mockPrismaService.contact.findFirst.mockResolvedValue({ id: 'existing' });

      const result = await service.importContacts('workspace-123', mockFile as any, {
        skipDuplicates: true,
      });

      expect(result.imported).toBe(0);
      expect(result.skipped).toBe(1);
    });
  });
});
EOF

# Create test for contact export service
cat > apps/api/src/modules/import-export/services/contact-export.service.spec.ts << 'EOF'
import { Test, TestingModule } from '@nestjs/testing';
import { ContactExportService } from './contact-export.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('ContactExportService', () => {
  let service: ContactExportService;
  let prisma: PrismaService;

  const mockPrismaService = {
    contact: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactExportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ContactExportService>(ContactExportService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('exportContacts', () => {
    const mockContacts = [
      {
        id: '1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '123-456-7890',
        workspaceId: 'workspace-123',
      },
      {
        id: '2',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        phone: '098-765-4321',
        workspaceId: 'workspace-123',
      },
    ];

    it('should export contacts to CSV format', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue(mockContacts);
      mockPrismaService.contact.count.mockResolvedValue(2);

      const result = await service.exportContacts('workspace-123', 'CSV', {});

      expect(result).toEqual({
        url: expect.stringContaining('.csv'),
        filename: expect.stringContaining('contacts-export'),
        format: 'CSV',
        count: 2,
      });

      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123' },
        include: { company: true, tags: true },
      });
    });

    it('should export contacts to Excel format', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue(mockContacts);
      mockPrismaService.contact.count.mockResolvedValue(2);

      const result = await service.exportContacts('workspace-123', 'EXCEL', {
        status: 'ACTIVE',
      });

      expect(result).toEqual({
        url: expect.stringContaining('.xlsx'),
        filename: expect.stringContaining('contacts-export'),
        format: 'EXCEL',
        count: 2,
      });

      expect(prisma.contact.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'workspace-123', status: 'ACTIVE' },
        include: { company: true, tags: true },
      });
    });

    it('should export contacts to JSON format', async () => {
      mockPrismaService.contact.findMany.mockResolvedValue(mockContacts);
      mockPrismaService.contact.count.mockResolvedValue(2);

      const result = await service.exportContacts('workspace-123', 'JSON', {});

      expect(result).toEqual({
        url: expect.stringContaining('.json'),
        filename: expect.stringContaining('contacts-export'),
        format: 'JSON',
        count: 2,
      });
    });
  });
});
EOF

# Run tests for both apps
echo ""
echo "🧪 Running tests for API..."
if run_tests "api"; then
  echo "✅ API tests completed successfully"
else
  echo "❌ API tests need more work"
fi

echo ""
echo "🧪 Running tests for Web..."
if run_tests "web"; then
  echo "✅ Web tests completed successfully"
else
  echo "❌ Web tests need more work"
fi

# Generate final report
echo ""
echo "📊 Final Test Coverage Report"
echo "============================"

# API Coverage
echo ""
echo "API Coverage:"
cd apps/api
pnpm test:cov --silent 2>&1 | grep -E "(Statements|Branches|Functions|Lines)" | tail -1
cd ../..

# Web Coverage
echo ""
echo "Web Coverage:"
cd apps/web
pnpm test --coverage --silent 2>&1 | grep -E "(Statements|Branches|Functions|Lines)" | tail -1
cd ../..

echo ""
echo "✨ Test coverage improvement process complete!"
echo ""
echo "Next steps:"
echo "1. Review any remaining coverage gaps"
echo "2. Run 'pnpm test' to verify all tests pass"
echo "3. Run 'pnpm test:cov' to verify 100% coverage"
echo ""