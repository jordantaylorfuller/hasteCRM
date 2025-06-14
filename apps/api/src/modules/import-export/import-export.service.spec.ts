import { Test, TestingModule } from "@nestjs/testing";
import { ContactImportService } from "./services/contact-import.service";
import { ContactExportService } from "./services/contact-export.service";
import { ContactsService } from "../contacts/contacts.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException } from "@nestjs/common";
import * as XLSX from "xlsx";
import { parse } from "csv-parse/sync";

// Mock XLSX library
jest.mock("xlsx");

// Mock csv-parse
jest.mock("csv-parse/sync");

describe("ContactImportService", () => {
  let importService: ContactImportService;
  let prismaService: PrismaService;
  let contactsService: ContactsService;

  const mockWorkspaceId = "workspace-123";
  const mockUserId = "user-123";

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactImportService,
        {
          provide: PrismaService,
          useValue: {
            import: {
              create: jest.fn(),
              update: jest.fn(),
            },
            contact: {
              findMany: jest.fn(),
              createMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
            },
            company: {
              findMany: jest.fn(),
              createMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ContactsService,
          useValue: {
            findAll: jest.fn(),
            create: jest.fn(),
            bulkCreate: jest.fn(),
          },
        },
      ],
    }).compile();

    importService = module.get<ContactImportService>(ContactImportService);
    prismaService = module.get<PrismaService>(PrismaService);
    contactsService = module.get<ContactsService>(ContactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("importContacts", () => {
    it("should import contacts from CSV content", async () => {
      const csvContent = `firstName,lastName,email,phone,company
John,Doe,john@example.com,+1234567890,ACME Corp
Jane,Smith,jane@example.com,+0987654321,Tech Inc`;

      const parsedData = [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          company: "ACME Corp",
        },
        {
          firstName: "Jane",
          lastName: "Smith",
          email: "jane@example.com",
          phone: "+0987654321",
          company: "Tech Inc",
        },
      ];

      (parse as jest.Mock).mockReturnValue(parsedData);

      const mapping = {
        firstName: "firstName",
        lastName: "lastName",
        email: "email",
        phone: "phone",
        company: "company",
      };

      const mockImportRecord = {
        id: "import-123",
        status: "PROCESSING",
      };

      (prismaService.import.create as jest.Mock).mockResolvedValue(
        mockImportRecord,
      );
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.create as jest.Mock).mockImplementation((data) =>
        Promise.resolve({ id: "company-123", ...data.data }),
      );
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (contactsService.create as jest.Mock).mockResolvedValue({
        id: "contact-123",
        email: "test@example.com",
      });
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (fn) => {
          return fn(prismaService);
        },
      );
      (prismaService.contact.createMany as jest.Mock).mockResolvedValue({
        count: 2,
      });
      (prismaService.import.update as jest.Mock).mockResolvedValue({
        ...mockImportRecord,
        status: "COMPLETED",
      });

      const result = await importService.importContacts(
        mockWorkspaceId,
        mockUserId,
        csvContent,
        "csv",
        mapping,
      );

      expect(result).toBeDefined();
      expect(prismaService.import.create).toHaveBeenCalled();
      expect(contactsService.create).toHaveBeenCalledTimes(2);
      expect(prismaService.import.update).toHaveBeenCalledWith({
        where: { id: mockImportRecord.id },
        data: expect.objectContaining({
          status: "COMPLETED",
          totalRows: 2,
          processedRows: 2,
          successRows: 2,
          errorRows: 0,
        }),
      });
    });

    it("should handle import errors", async () => {
      const invalidContent = "invalid csv content";
      const mapping = {};

      const mockImportRecord = {
        id: "import-123",
        status: "PROCESSING",
      };

      (prismaService.import.create as jest.Mock).mockResolvedValue(
        mockImportRecord,
      );
      (parse as jest.Mock).mockImplementation(() => {
        throw new Error("Invalid CSV format");
      });
      (prismaService.import.update as jest.Mock).mockResolvedValue({
        ...mockImportRecord,
        status: "FAILED",
      });

      await expect(
        importService.importContacts(
          mockWorkspaceId,
          mockUserId,
          invalidContent,
          "csv",
          mapping,
        ),
      ).rejects.toThrow("Invalid CSV format");

      expect(prismaService.import.update).toHaveBeenCalledWith({
        where: { id: mockImportRecord.id },
        data: expect.objectContaining({
          status: "FAILED",
          errors: [{ error: "Invalid CSV format" }],
          completedAt: expect.any(Date),
        }),
      });
    });

    it("should import contacts from Excel content", async () => {
      const mockWorkbook = {
        SheetNames: ["Sheet1"],
        Sheets: {
          Sheet1: {},
        },
      };

      const excelData = [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john@example.com",
          phone: "+1234567890",
          company: "ACME Corp",
        },
      ];

      (XLSX.read as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.sheet_to_json as jest.Mock).mockReturnValue(excelData);

      const mapping = {
        firstName: "firstName",
        lastName: "lastName",
        email: "email",
        phone: "phone",
        company: "company",
      };

      const mockImportRecord = {
        id: "import-123",
        status: "PROCESSING",
      };

      (prismaService.import.create as jest.Mock).mockResolvedValue(
        mockImportRecord,
      );
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);
      (prismaService.company.create as jest.Mock).mockImplementation((data) =>
        Promise.resolve({ id: "company-123", ...data.data }),
      );
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);
      (contactsService.create as jest.Mock).mockResolvedValue({
        id: "contact-123",
        email: "john@example.com",
      });
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (fn) => {
          return fn(prismaService);
        },
      );
      (prismaService.contact.createMany as jest.Mock).mockResolvedValue({
        count: 1,
      });
      (prismaService.import.update as jest.Mock).mockResolvedValue({
        ...mockImportRecord,
        status: "COMPLETED",
      });

      const result = await importService.importContacts(
        mockWorkspaceId,
        mockUserId,
        "excel-content",
        "xlsx",
        mapping,
      );

      expect(result).toBeDefined();
      expect(XLSX.read).toHaveBeenCalled();
      expect(contactsService.create).toHaveBeenCalled();
      expect(prismaService.import.update).toHaveBeenCalledWith({
        where: { id: mockImportRecord.id },
        data: expect.objectContaining({
          status: "COMPLETED",
          totalRows: 1,
          processedRows: 1,
          successRows: 1,
          errorRows: 0,
        }),
      });
    });

    it("should handle unsupported file format", async () => {
      const content = "some content";
      const mapping = {};

      const mockImportRecord = {
        id: "import-123",
        status: "PROCESSING",
      };

      (prismaService.import.create as jest.Mock).mockResolvedValue(
        mockImportRecord,
      );
      (prismaService.import.update as jest.Mock).mockResolvedValue({
        ...mockImportRecord,
        status: "FAILED",
      });

      await expect(
        importService.importContacts(
          mockWorkspaceId,
          mockUserId,
          content,
          "unsupported",
          mapping,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

describe("ContactExportService", () => {
  let exportService: ContactExportService;
  let prismaService: PrismaService;

  const mockWorkspaceId = "workspace-123";
  const mockUserId = "user-123";

  const mockContacts = [
    {
      id: "contact-1",
      firstName: "John",
      lastName: "Doe",
      email: "john@example.com",
      phone: "+1234567890",
      title: "CEO",
      company: { name: "ACME Corp" },
      city: "New York",
      state: "NY",
      country: "USA",
      source: "MANUAL",
      status: "ACTIVE",
      createdAt: new Date("2024-01-01"),
    },
    {
      id: "contact-2",
      firstName: "Jane",
      lastName: "Smith",
      email: "jane@example.com",
      phone: "+0987654321",
      title: "CTO",
      company: { name: "Tech Inc" },
      city: "San Francisco",
      state: "CA",
      country: "USA",
      source: "IMPORT",
      status: "ACTIVE",
      createdAt: new Date("2024-01-02"),
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactExportService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              findMany: jest.fn(),
            },
            export: {
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    exportService = module.get<ContactExportService>(ContactExportService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe("exportContacts", () => {
    it("should export contacts to CSV format", async () => {
      const mockExportRecord = {
        id: "export-123",
        status: "PROCESSING",
      };

      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        mockContacts,
      );
      (prismaService.export.create as jest.Mock).mockResolvedValue(
        mockExportRecord,
      );
      (prismaService.export.update as jest.Mock).mockResolvedValue({
        ...mockExportRecord,
        status: "COMPLETED",
      });

      const result = await exportService.exportContacts(
        mockWorkspaceId,
        mockUserId,
        "csv",
      );

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeDefined();
      expect(result.format).toBe("csv");
      expect(result.rowCount).toBe(2);

      // Decode the data URI to check content
      const base64Content = result.fileUrl.split(",")[1];
      const csvContent = Buffer.from(base64Content, "base64").toString();
      expect(csvContent).toContain("firstName,lastName,email");
      expect(csvContent).toContain("John,Doe,john@example.com");
      expect(csvContent).toContain("Jane,Smith,jane@example.com");

      expect(prismaService.export.update).toHaveBeenCalledWith({
        where: { id: mockExportRecord.id },
        data: expect.objectContaining({
          fileUrl: expect.any(String),
        }),
      });
    });

    it("should export contacts to Excel format", async () => {
      const mockExportRecord = {
        id: "export-123",
        status: "PROCESSING",
      };

      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        mockContacts,
      );
      (prismaService.export.create as jest.Mock).mockResolvedValue(
        mockExportRecord,
      );
      (prismaService.export.update as jest.Mock).mockResolvedValue({
        ...mockExportRecord,
        status: "COMPLETED",
      });

      const mockWorkbook = { SheetNames: [], Sheets: {} };
      const mockWorksheet = {};
      const mockBuffer = Buffer.from("excel data");

      (XLSX.utils.book_new as jest.Mock).mockReturnValue(mockWorkbook);
      (XLSX.utils.json_to_sheet as jest.Mock).mockReturnValue(mockWorksheet);
      (XLSX.utils.book_append_sheet as jest.Mock).mockImplementation(() => {});
      (XLSX.write as jest.Mock).mockReturnValue(mockBuffer);

      const result = await exportService.exportContacts(
        mockWorkspaceId,
        mockUserId,
        "xlsx",
      );

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeDefined();
      expect(result.format).toBe("xlsx");
      expect(result.rowCount).toBe(2);
      expect(XLSX.utils.json_to_sheet).toHaveBeenCalled();
      expect(XLSX.write).toHaveBeenCalledWith(mockWorkbook, {
        type: "string",
        bookType: "xlsx",
      });
    });

    it("should export contacts with custom fields", async () => {
      const customFields = ["firstName", "email", "company"];
      const mockExportRecord = {
        id: "export-123",
        status: "PROCESSING",
      };

      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        mockContacts,
      );
      (prismaService.export.create as jest.Mock).mockResolvedValue(
        mockExportRecord,
      );
      (prismaService.export.update as jest.Mock).mockResolvedValue({
        ...mockExportRecord,
        status: "COMPLETED",
      });

      const result = await exportService.exportContacts(
        mockWorkspaceId,
        mockUserId,
        "csv",
        customFields,
      );

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeDefined();

      // Decode the data URI to check content
      const base64Content = result.fileUrl.split(",")[1];
      const csvContent = Buffer.from(base64Content, "base64").toString();
      expect(csvContent).toContain("firstName,email,company");
      expect(csvContent).not.toContain("phone");
      expect(csvContent).not.toContain("title");
    });

    it("should handle export errors", async () => {
      (prismaService.contact.findMany as jest.Mock).mockRejectedValue(
        new Error("Database error"),
      );

      const mockExportRecord = {
        id: "export-123",
        status: "PROCESSING",
      };

      (prismaService.export.create as jest.Mock).mockResolvedValue(
        mockExportRecord,
      );
      (prismaService.export.update as jest.Mock).mockResolvedValue({
        ...mockExportRecord,
        status: "FAILED",
      });

      await expect(
        exportService.exportContacts(mockWorkspaceId, mockUserId, "csv"),
      ).rejects.toThrow("Database error");

      // The service doesn't update the export record on failure since it throws immediately
      expect(prismaService.export.update).not.toHaveBeenCalled();
    });

    it("should handle empty contact list", async () => {
      const mockExportRecord = {
        id: "export-123",
        status: "PROCESSING",
      };

      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.export.create as jest.Mock).mockResolvedValue(
        mockExportRecord,
      );
      (prismaService.export.update as jest.Mock).mockResolvedValue({
        ...mockExportRecord,
        status: "COMPLETED",
      });

      const result = await exportService.exportContacts(
        mockWorkspaceId,
        mockUserId,
        "csv",
      );

      expect(result).toBeDefined();
      expect(result.fileUrl).toBeDefined();
      expect(result.rowCount).toBe(0);

      // Decode the data URI to check content
      const base64Content = result.fileUrl.split(",")[1];
      const csvContent = Buffer.from(base64Content, "base64").toString();
      expect(csvContent).toContain("firstName,lastName,email");

      expect(prismaService.export.update).toHaveBeenCalledWith({
        where: { id: mockExportRecord.id },
        data: expect.objectContaining({
          fileUrl: expect.any(String),
        }),
      });
    });
  });
});
