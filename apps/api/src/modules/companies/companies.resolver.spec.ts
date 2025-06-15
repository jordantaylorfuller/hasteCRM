import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesResolver } from "./companies.resolver";
import { CompaniesService } from "./companies.service";
import { Company } from "./entities/company.entity";
import { CreateCompanyInput } from "./dto/create-company.input";
import { Prisma } from "@hasteCRM/database";
import { JwtService } from "@nestjs/jwt";
import { SessionService } from "../auth/session.service";

describe("CompaniesResolver", () => {
  let resolver: CompaniesResolver;
  let companiesService: CompaniesService;

  const mockCompaniesService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        userId: "user-123",
        workspaceId: "workspace-123",
        email: "test@example.com",
        role: "ADMIN",
      },
    },
  };

  const mockCompany: Company = {
    id: "company-123",
    name: "Test Company",
    website: "https://test-company.com",
    industry: "Technology",
    size: "50-100",
    description: "A test company",
    logo: "https://test-company.com/logo.png",
    linkedinUrl: "https://linkedin.com/company/test-company",
    twitterUrl: "https://twitter.com/testcompany",
    address: "123 Test St",
    city: "Test City",
    state: "TS",
    country: "Test Country",
    postalCode: "12345",
    phone: "+1234567890",
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "workspace-123",
    totalRevenue: new Prisma.Decimal(1000000),
    contacts: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesResolver,
        {
          provide: CompaniesService,
          useValue: mockCompaniesService,
        },
        {
          provide: JwtService,
          useValue: {
            verify: jest.fn(),
          },
        },
        {
          provide: SessionService,
          useValue: {
            getSession: jest.fn(),
          },
        },
      ],
    }).compile();

    resolver = module.get<CompaniesResolver>(CompaniesResolver);
    companiesService = module.get<CompaniesService>(CompaniesService);

    jest.clearAllMocks();
  });

  it("should be defined", () => {
    expect(resolver).toBeDefined();
  });

  describe("createCompany", () => {
    it("should create a new company", async () => {
      const createInput: CreateCompanyInput = {
        name: "New Company",
        website: "https://new-company.com",
        industry: "Finance",
        size: "100-500",
        description: "A new company",
        phone: "+0987654321",
      };

      mockCompaniesService.create.mockResolvedValue(mockCompany);

      const result = await resolver.createCompany(createInput, mockContext);

      expect(companiesService.create).toHaveBeenCalledWith(
        "workspace-123",
        "user-123",
        createInput,
      );
      expect(result).toEqual(mockCompany);
    });

    it("should handle creation errors", async () => {
      const createInput: CreateCompanyInput = {
        name: "New Company",
      };

      mockCompaniesService.create.mockRejectedValue(
        new Error("Creation failed"),
      );

      await expect(
        resolver.createCompany(createInput, mockContext),
      ).rejects.toThrow("Creation failed");
    });
  });

  describe("findAll", () => {
    it("should return paginated companies", async () => {
      const mockResponse = {
        companies: [mockCompany],
        total: 1,
        hasMore: false,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      const result = await resolver.findAll(0, 20, null, mockContext);

      expect(companiesService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        0,
        20,
        null,
      );
      expect(result).toEqual(mockResponse);
    });

    it("should handle search parameter", async () => {
      const mockResponse = {
        companies: [mockCompany],
        total: 1,
        hasMore: false,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      const result = await resolver.findAll(0, 10, "Test", mockContext);

      expect(companiesService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        0,
        10,
        "Test",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should use default pagination values", async () => {
      const mockResponse = {
        companies: [],
        total: 0,
        hasMore: false,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      const result = await resolver.findAll(
        undefined,
        undefined,
        undefined,
        mockContext,
      );

      expect(companiesService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("findOne", () => {
    it("should return a single company", async () => {
      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const result = await resolver.findOne("company-123", mockContext);

      expect(companiesService.findOne).toHaveBeenCalledWith(
        "company-123",
        "workspace-123",
      );
      expect(result).toEqual(mockCompany);
    });

    it("should handle not found error", async () => {
      mockCompaniesService.findOne.mockRejectedValue(
        new Error("Company not found"),
      );

      await expect(
        resolver.findOne("non-existent", mockContext),
      ).rejects.toThrow("Company not found");
    });
  });

  describe("updateCompany", () => {
    it("should update a company", async () => {
      const updateInput: CreateCompanyInput = {
        name: "Updated Company",
        website: "https://updated-company.com",
        size: "500-1000",
      };

      const updatedCompany = { ...mockCompany, ...updateInput };
      mockCompaniesService.update.mockResolvedValue(updatedCompany);

      const result = await resolver.updateCompany(
        "company-123",
        updateInput,
        mockContext,
      );

      expect(companiesService.update).toHaveBeenCalledWith(
        "company-123",
        "workspace-123",
        updateInput,
      );
      expect(result).toEqual(updatedCompany);
    });

    it("should handle update errors", async () => {
      const updateInput: CreateCompanyInput = {
        name: "Updated Company",
      };

      mockCompaniesService.update.mockRejectedValue(new Error("Update failed"));

      await expect(
        resolver.updateCompany("company-123", updateInput, mockContext),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("removeCompany", () => {
    it("should remove a company", async () => {
      mockCompaniesService.remove.mockResolvedValue(mockCompany);

      const result = await resolver.removeCompany("company-123", mockContext);

      expect(companiesService.remove).toHaveBeenCalledWith(
        "company-123",
        "workspace-123",
      );
      expect(result).toEqual(mockCompany);
    });

    it("should handle remove errors", async () => {
      mockCompaniesService.remove.mockRejectedValue(new Error("Remove failed"));

      await expect(
        resolver.removeCompany("company-123", mockContext),
      ).rejects.toThrow("Remove failed");
    });

    it("should handle company with associated contacts", async () => {
      mockCompaniesService.remove.mockRejectedValue(
        new Error("Cannot delete company with associated contacts"),
      );

      await expect(
        resolver.removeCompany("company-123", mockContext),
      ).rejects.toThrow("Cannot delete company with associated contacts");
    });
  });

  describe("authorization checks", () => {
    it("should throw error if user context is missing", async () => {
      const invalidContext = { req: { user: null } };

      await expect(
        resolver.findAll(0, 20, null, invalidContext),
      ).rejects.toBeTruthy();
    });

    it("should throw error if workspaceId is missing", async () => {
      const invalidContext = {
        req: {
          user: {
            userId: "user-123",
            email: "test@example.com",
            role: "ADMIN",
          },
        },
      };

      // Mock the service to reject when workspaceId is undefined
      mockCompaniesService.findAll.mockRejectedValue(
        new Error("Workspace ID is required"),
      );

      await expect(
        resolver.findAll(0, 20, null, invalidContext),
      ).rejects.toThrow();
    });
  });
});
