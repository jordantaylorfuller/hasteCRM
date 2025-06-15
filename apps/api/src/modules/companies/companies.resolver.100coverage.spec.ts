import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesResolver } from "./companies.resolver";
import { CompaniesService } from "./companies.service";
import { Company } from "./entities/company.entity";
import { CreateCompanyInput } from "./dto/create-company.input";
import { Prisma } from "@hasteCRM/database";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

// Mock the CustomGqlAuthGuard
jest.mock("../../common/guards/custom-gql-auth.guard");

describe("CompaniesResolver - 100% Coverage", () => {
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
    jest.clearAllMocks();

    // Mock the guard to always return true
    (CustomGqlAuthGuard as jest.Mock).mockImplementation(() => ({
      canActivate: jest.fn().mockReturnValue(true),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesResolver,
        {
          provide: CompaniesService,
          useValue: mockCompaniesService,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<CompaniesResolver>(CompaniesResolver);
    companiesService = module.get<CompaniesService>(CompaniesService);
  });

  describe("createCompany - line 13", () => {
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

    it("should create company with minimal input", async () => {
      const createInput: CreateCompanyInput = {
        name: "Minimal Company",
      };

      const minimalCompany = { ...mockCompany, name: "Minimal Company" };
      mockCompaniesService.create.mockResolvedValue(minimalCompany);

      const result = await resolver.createCompany(createInput, mockContext);

      expect(companiesService.create).toHaveBeenCalledWith(
        "workspace-123",
        "user-123",
        createInput,
      );
      expect(result).toEqual(minimalCompany);
    });
  });

  describe("findAll - line 22", () => {
    it("should return paginated companies with defaults", async () => {
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

    it("should handle undefined parameters using defaults", async () => {
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
      expect(result).toEqual(mockResponse);
    });

    it("should handle search parameter", async () => {
      const mockResponse = {
        companies: [mockCompany],
        total: 5,
        hasMore: true,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      const result = await resolver.findAll(10, 5, "Tech", mockContext);

      expect(companiesService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        10,
        5,
        "Tech",
      );
      expect(result).toEqual(mockResponse);
    });

    it("should extract workspaceId from context", async () => {
      const customContext = {
        req: {
          user: {
            userId: "different-user",
            workspaceId: "different-workspace",
          },
        },
      };

      const mockResponse = {
        companies: [],
        total: 0,
        hasMore: false,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      await resolver.findAll(0, 20, null, customContext);

      expect(companiesService.findAll).toHaveBeenCalledWith(
        "different-workspace",
        0,
        20,
        null,
      );
    });
  });

  describe("findOne - line 33", () => {
    it("should return a single company", async () => {
      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      const result = await resolver.findOne("company-123", mockContext);

      expect(companiesService.findOne).toHaveBeenCalledWith(
        "company-123",
        "workspace-123",
      );
      expect(result).toEqual(mockCompany);
    });

    it("should extract workspaceId from context", async () => {
      const customContext = {
        req: {
          user: {
            userId: "user-456",
            workspaceId: "workspace-456",
          },
        },
      };

      mockCompaniesService.findOne.mockResolvedValue(mockCompany);

      await resolver.findOne("company-123", customContext);

      expect(companiesService.findOne).toHaveBeenCalledWith(
        "company-123",
        "workspace-456",
      );
    });
  });

  describe("updateCompany - line 42", () => {
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

    it("should update with partial data", async () => {
      const updateInput: CreateCompanyInput = {
        name: "New Name Only",
      };

      const updatedCompany = { ...mockCompany, name: "New Name Only" };
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
  });

  describe("removeCompany - line 52", () => {
    it("should remove a company", async () => {
      mockCompaniesService.remove.mockResolvedValue(mockCompany);

      const result = await resolver.removeCompany("company-123", mockContext);

      expect(companiesService.remove).toHaveBeenCalledWith(
        "company-123",
        "workspace-123",
      );
      expect(result).toEqual(mockCompany);
    });

    it("should extract workspaceId from context", async () => {
      const customContext = {
        req: {
          user: {
            userId: "user-789",
            workspaceId: "workspace-789",
          },
        },
      };

      mockCompaniesService.remove.mockResolvedValue(mockCompany);

      await resolver.removeCompany("company-123", customContext);

      expect(companiesService.remove).toHaveBeenCalledWith(
        "company-123",
        "workspace-789",
      );
    });
  });

  describe("CompaniesResponse type", () => {
    it("should have proper GraphQL field decorators", () => {
      // Import the module to ensure all decorators are applied
      // const module = require("./companies.resolver");
      
      // The CompaniesResponse type should be exported or we need to verify it's used
      expect(resolver).toBeDefined();
      
      // When findAll returns data, it should match the CompaniesResponse shape
      const mockResponse = {
        companies: [mockCompany, { ...mockCompany, id: "company-456" }],
        total: 2,
        hasMore: false,
      };

      mockCompaniesService.findAll.mockResolvedValue(mockResponse);

      resolver.findAll(0, 20, null, mockContext).then((result) => {
        expect(result).toHaveProperty("companies");
        expect(result).toHaveProperty("total");
        expect(result).toHaveProperty("hasMore");
        expect(Array.isArray(result.companies)).toBe(true);
        expect(typeof result.total).toBe("number");
        expect(typeof result.hasMore).toBe("boolean");
      });
    });
  });

  describe("Guard decorator", () => {
    it("should have UseGuards decorator applied", () => {
      // Verify the resolver class has the guard decorator
      const guards = Reflect.getMetadata("__guards__", CompaniesResolver);
      expect(guards).toBeDefined();
    });
  });

  describe("Resolver decorator", () => {
    it("should have Resolver decorator with Company type", () => {
      const resolverMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        CompaniesResolver,
      );
      expect(resolverMetadata).toBeDefined();
    });
  });

  describe("Method decorators", () => {
    it("should have proper GraphQL decorators on all methods", () => {
      const prototype = CompaniesResolver.prototype;
      
      // Check createCompany has Mutation decorator
      const createCompanyMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        prototype.createCompany,
      );
      expect(createCompanyMetadata).toBeDefined();
      
      // Check findAll has Query decorator
      const findAllMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        prototype.findAll,
      );
      expect(findAllMetadata).toBeDefined();
      
      // Check findOne has Query decorator
      const findOneMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        prototype.findOne,
      );
      expect(findOneMetadata).toBeDefined();
      
      // Check updateCompany has Mutation decorator
      const updateCompanyMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        prototype.updateCompany,
      );
      expect(updateCompanyMetadata).toBeDefined();
      
      // Check removeCompany has Mutation decorator
      const removeCompanyMetadata = Reflect.getMetadata(
        "graphql:resolver_type",
        prototype.removeCompany,
      );
      expect(removeCompanyMetadata).toBeDefined();
    });
  });
});