import { Test, TestingModule } from "@nestjs/testing";
import { CompaniesService } from "./companies.service";
import { PrismaService } from "../prisma/prisma.service";
import { NotFoundException } from "@nestjs/common";

describe("CompaniesService", () => {
  let service: CompaniesService;
  let prismaService: PrismaService;

  const mockWorkspaceId = "workspace-123";
  const mockUserId = "user-123";

  const mockCompany = {
    id: "company-123",
    workspaceId: mockWorkspaceId,
    name: "ACME Corporation",
    domain: "acme.com",
    industry: "Technology",
    size: "100-500",
    website: "https://acme.com",
    description: "Leading tech company",
    logoUrl: "https://acme.com/logo.png",
    customFields: { revenue: "10M", founded: "2010" },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdById: mockUserId,
    deletedAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompaniesService,
        {
          provide: PrismaService,
          useValue: {
            company: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<CompaniesService>(CompaniesService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createDto = {
      name: "ACME Corporation",
      domain: "acme.com",
      industry: "Technology",
      size: "100-500",
      website: "https://acme.com",
      description: "Leading tech company",
    };

    it("should create a company", async () => {
      (prismaService.company.create as jest.Mock).mockResolvedValue(
        mockCompany,
      );

      const result = await service.create(
        mockWorkspaceId,
        mockUserId,
        createDto,
      );

      expect(prismaService.company.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          workspaceId: mockWorkspaceId,
          createdById: mockUserId,
        },
      });
      expect(result).toEqual(mockCompany);
    });
  });

  describe("findAll", () => {
    it("should return paginated companies without search", async () => {
      const companies = [mockCompany, { ...mockCompany, id: "company-456" }];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(
        companies,
      );
      (prismaService.company.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll(mockWorkspaceId, 0, 10);

      expect(prismaService.company.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      expect(prismaService.company.count).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
      });
      expect(result).toEqual({
        companies,
        total: 2,
        hasMore: false,
      });
    });

    it("should filter companies by search term", async () => {
      const companies = [mockCompany];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(
        companies,
      );
      (prismaService.company.count as jest.Mock).mockResolvedValue(1);

      const result = await service.findAll(mockWorkspaceId, 0, 10, "acme");

      expect(prismaService.company.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          OR: [
            { name: { contains: "acme", mode: "insensitive" } },
            { domain: { contains: "acme", mode: "insensitive" } },
            { industry: { contains: "acme", mode: "insensitive" } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual({
        companies,
        total: 1,
        hasMore: false,
      });
    });

    it("should handle pagination correctly", async () => {
      const companies = [mockCompany];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(
        companies,
      );
      (prismaService.company.count as jest.Mock).mockResolvedValue(25);

      const result = await service.findAll(mockWorkspaceId, 10, 10);

      expect(result).toEqual({
        companies,
        total: 25,
        hasMore: true, // 10 + 10 < 25
      });
    });

    it("should use default pagination values", async () => {
      const companies = [];
      (prismaService.company.findMany as jest.Mock).mockResolvedValue(
        companies,
      );
      (prismaService.company.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId);

      expect(prismaService.company.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a company by id", async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(
        mockCompany,
      );

      const result = await service.findOne(mockCompany.id, mockWorkspaceId);

      expect(prismaService.company.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockCompany.id,
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockCompany);
    });

    it("should throw NotFoundException if company not found", async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    const updateDto = {
      name: "ACME Corp Updated",
      size: "500-1000",
      customFields: { revenue: "20M" },
    };

    it("should update a company", async () => {
      const updatedCompany = { ...mockCompany, ...updateDto };
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(
        mockCompany,
      );
      (prismaService.company.update as jest.Mock).mockResolvedValue(
        updatedCompany,
      );

      const result = await service.update(
        mockCompany.id,
        mockWorkspaceId,
        updateDto,
      );

      expect(prismaService.company.update).toHaveBeenCalledWith({
        where: { id: mockCompany.id },
        data: updateDto,
      });
      expect(result).toEqual(updatedCompany);
    });

    it("should throw NotFoundException if company not found", async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update("non-existent", mockWorkspaceId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should soft delete a company", async () => {
      const deletedCompany = { ...mockCompany, deletedAt: new Date() };
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(
        mockCompany,
      );
      (prismaService.company.update as jest.Mock).mockResolvedValue(
        deletedCompany,
      );

      const result = await service.remove(mockCompany.id, mockWorkspaceId);

      expect(prismaService.company.update).toHaveBeenCalledWith({
        where: { id: mockCompany.id },
        data: {
          deletedAt: expect.any(Date),
        },
      });
      expect(result).toEqual(deletedCompany);
    });

    it("should throw NotFoundException if company not found", async () => {
      (prismaService.company.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.remove("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
