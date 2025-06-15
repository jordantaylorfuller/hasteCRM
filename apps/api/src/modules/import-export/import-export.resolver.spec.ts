import { Test, TestingModule } from "@nestjs/testing";
import { ImportExportResolver } from "./import-export.resolver";
import { ContactImportService } from "./services/contact-import.service";
import { ContactExportService } from "./services/contact-export.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";
import { JwtService } from "@nestjs/jwt";

// Mock the guard
jest.mock("../../common/guards/custom-gql-auth.guard");

describe("ImportExportResolver", () => {
  let resolver: ImportExportResolver;
  let importService: ContactImportService;
  let exportService: ContactExportService;

  const mockImportService = {
    importContacts: jest.fn(),
    getImportStatus: jest.fn(),
  };

  const mockExportService = {
    exportContacts: jest.fn(),
    getExportStatus: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockAuthGuard = {
    canActivate: jest.fn().mockResolvedValue(true),
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
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: CustomGqlAuthGuard,
          useValue: mockAuthGuard,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue(mockAuthGuard)
      .compile();

    resolver = module.get<ImportExportResolver>(ImportExportResolver);
    importService = module.get<ContactImportService>(ContactImportService);
    exportService = module.get<ContactExportService>(ContactExportService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("importContacts", () => {
    it("should import contacts successfully", async () => {
      const mockInput = {
        format: "csv",
        mapping: { name: "name", email: "email" },
      };

      const mockContext = {
        req: {
          user: {
            workspaceId: "workspace-123",
            userId: "user-123",
          },
        },
      };

      const mockResult = {
        importId: "import-123",
        total: 10,
        processed: 10,
        success: 8,
        errors: [],
      };

      mockImportService.importContacts.mockResolvedValue(mockResult);

      const result = await resolver.importContacts(
        mockInput,
        "csv file content",
        mockContext,
      );

      expect(result).toEqual(mockResult);
      expect(importService.importContacts).toHaveBeenCalledWith(
        "workspace-123",
        "user-123",
        "csv file content",
        mockInput.format,
        mockInput.mapping,
      );
    });
  });

  describe("exportContacts", () => {
    it("should export contacts successfully", async () => {
      const mockInput = {
        format: "csv",
        fields: ["name", "email"],
        filters: { status: "ACTIVE" },
      };

      const mockContext = {
        req: {
          user: {
            workspaceId: "workspace-123",
            userId: "user-123",
          },
        },
      };

      const mockResult = {
        exportId: "export-123",
        fileUrl: "https://example.com/export.csv",
        rowCount: 50,
        format: "csv",
        expiresAt: new Date(),
      };

      mockExportService.exportContacts.mockResolvedValue(mockResult);

      const result = await resolver.exportContacts(mockInput, mockContext);

      expect(result).toEqual(mockResult);
      expect(exportService.exportContacts).toHaveBeenCalledWith(
        "workspace-123",
        "user-123",
        mockInput.format,
        mockInput.fields,
        mockInput.filters,
      );
    });
  });

  describe("importStatus", () => {
    it("should get import status", async () => {
      const mockContext = {
        req: {
          user: {
            workspaceId: "workspace-123",
          },
        },
      };

      const mockStatus = {
        id: "import-123",
        status: "completed",
        totalRows: 10,
        processedRows: 10,
        successRows: 8,
        errorRows: 2,
        errors: [],
        createdAt: new Date(),
        completedAt: new Date(),
      };

      mockImportService.getImportStatus.mockResolvedValue(mockStatus);

      const result = await resolver.importStatus("import-123", mockContext);

      expect(result).toEqual(mockStatus);
      expect(importService.getImportStatus).toHaveBeenCalledWith(
        "import-123",
        "workspace-123",
      );
    });
  });

  describe("exportStatus", () => {
    it("should get export status", async () => {
      const mockContext = {
        req: {
          user: {
            workspaceId: "workspace-123",
          },
        },
      };

      const mockStatus = {
        id: "export-123",
        type: "contacts",
        format: "csv",
        rowCount: 50,
        fileUrl: "https://example.com/export.csv",
        expiresAt: new Date(),
        createdAt: new Date(),
      };

      mockExportService.getExportStatus.mockResolvedValue(mockStatus);

      const result = await resolver.exportStatus("export-123", mockContext);

      expect(result).toEqual(mockStatus);
      expect(exportService.getExportStatus).toHaveBeenCalledWith(
        "export-123",
        "workspace-123",
      );
    });
  });
});
