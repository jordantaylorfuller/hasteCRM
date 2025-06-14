import { Test, TestingModule } from "@nestjs/testing";
import { ContactsService } from "./contacts.service";
import { PrismaService } from "../prisma/prisma.service";
import { BadRequestException, NotFoundException } from "@nestjs/common";

describe("ContactsService", () => {
  let service: ContactsService;
  let prismaService: PrismaService;

  const mockWorkspaceId = "workspace-123";
  const mockUserId = "user-123";

  const mockContact = {
    id: "contact-123",
    workspaceId: mockWorkspaceId,
    firstName: "John",
    lastName: "Doe",
    email: "john.doe@example.com",
    phone: "+1234567890",
    title: "CEO",
    companyId: "company-123",
    status: "ACTIVE",
    source: "MANUAL",
    tags: ["vip", "customer"],
    customFields: { industry: "Tech" },
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: mockUserId,
    company: {
      id: "company-123",
      name: "ACME Corp",
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsService,
        {
          provide: PrismaService,
          useValue: {
            contact: {
              create: jest.fn(),
              findMany: jest.fn(),
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ContactsService>(ContactsService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("create", () => {
    const createDto = {
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
      phone: "+1234567890",
      title: "CEO",
      companyId: "company-123",
      tags: ["vip", "customer"],
    };

    it("should create a contact", async () => {
      (prismaService.contact.create as jest.Mock).mockResolvedValue(
        mockContact,
      );

      const result = await service.create(
        mockWorkspaceId,
        mockUserId,
        createDto,
      );

      expect(prismaService.contact.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          workspaceId: mockWorkspaceId,
          createdById: mockUserId,
          status: "ACTIVE",
        },
      });
      expect(result).toEqual(mockContact);
    });
  });

  describe("findAll", () => {
    it("should return paginated contacts", async () => {
      const contacts = [mockContact, { ...mockContact, id: "contact-456" }];
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(contacts);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(2);

      const result = await service.findAll(mockWorkspaceId, undefined, 0, 10);

      expect(result).toEqual({
        contacts,
        total: 2,
        hasMore: false,
      });
    });

    it("should filter contacts by search term", async () => {
      const filters = { search: "john" };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          OR: [
            { firstName: { contains: "john", mode: "insensitive" } },
            { lastName: { contains: "john", mode: "insensitive" } },
            { email: { contains: "john", mode: "insensitive" } },
            { phone: { contains: "john" } },
            { title: { contains: "john", mode: "insensitive" } },
          ],
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by status", async () => {
      const filters = { status: "ACTIVE" };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          status: "ACTIVE",
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by tags", async () => {
      const filters = { tags: ["vip", "customer"] };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          tags: {
            some: {
              tag: {
                name: { in: ["vip", "customer"] },
              },
            },
          },
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by company", async () => {
      const filters = { companyId: "company-123" };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          companyId: "company-123",
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("findOne", () => {
    it("should return a contact by id", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );

      const result = await service.findOne(mockContact.id, mockWorkspaceId);

      expect(prismaService.contact.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockContact.id,
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
      });
      expect(result).toEqual(mockContact);
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.findOne("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("update", () => {
    const updateDto = {
      firstName: "Jane",
      phone: "+0987654321",
      tags: ["updated", "contact"],
    };

    it("should update a contact", async () => {
      const updatedContact = { ...mockContact, ...updateDto };
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contact.update as jest.Mock).mockResolvedValue(
        updatedContact,
      );

      const result = await service.update(
        mockContact.id,
        mockWorkspaceId,
        updateDto,
      );

      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: mockContact.id },
        data: {
          ...updateDto,
          lastActivityAt: expect.any(Date),
        },
      });
      expect(result).toEqual(updatedContact);
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.update("non-existent", mockWorkspaceId, updateDto),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("remove", () => {
    it("should soft delete a contact", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        deletedAt: new Date(),
      });

      await service.remove(mockContact.id, mockWorkspaceId);

      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: mockContact.id },
        data: {
          deletedAt: expect.any(Date),
        },
      });
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.remove("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
