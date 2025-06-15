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
            contactTag: {
              create: jest.fn(),
              delete: jest.fn(),
              findMany: jest.fn(),
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

  const mockTag = {
    id: "tag-123",
    name: "vip",
    workspaceId: mockWorkspaceId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockContactTag = {
    contactId: mockContact.id,
    tagId: mockTag.id,
    tag: mockTag,
  };

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

  describe("restore", () => {
    it("should restore a soft-deleted contact", async () => {
      const deletedContact = { ...mockContact, deletedAt: new Date() };
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        deletedContact,
      );
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        deletedAt: null,
      });

      const result = await service.restore(mockContact.id, mockWorkspaceId);

      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: mockContact.id },
        data: {
          deletedAt: null,
        },
      });
      expect(result.deletedAt).toBeNull();
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.restore("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("search", () => {
    it("should search contacts by query", async () => {
      const contacts = [mockContact];
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(contacts);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(1);

      const result = await service.search(mockWorkspaceId, "john");

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
            { bio: { contains: "john", mode: "insensitive" } },
          ],
        },
        skip: 0,
        take: 20,
        orderBy: [
          { score: "desc" },
          { lastActivityAt: "desc" },
          { createdAt: "desc" },
        ],
      });
      expect(result).toEqual({
        contacts,
        total: 1,
        hasMore: false,
      });
    });

    it("should search with filters", async () => {
      const filters = {
        status: "ACTIVE",
        source: "MANUAL",
        companyId: "company-123",
      };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.search(mockWorkspaceId, "test", filters);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          status: "ACTIVE",
          source: "MANUAL",
          companyId: "company-123",
          OR: expect.any(Array),
        },
        skip: 0,
        take: 20,
        orderBy: expect.any(Array),
      });
    });

    it("should handle pagination in search", async () => {
      const contacts = Array(25).fill(mockContact);
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        contacts.slice(10, 20),
      );
      (prismaService.contact.count as jest.Mock).mockResolvedValue(25);

      const result = await service.search(
        mockWorkspaceId,
        "test",
        undefined,
        10,
        10,
      );

      expect(result.hasMore).toBe(true);
      expect(prismaService.contact.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 10,
          take: 10,
        }),
      );
    });
  });

  describe("updateScore", () => {
    it("should update contact score", async () => {
      const newScore = 85;
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contact.update as jest.Mock).mockResolvedValue({
        ...mockContact,
        score: newScore,
      });

      const result = await service.updateScore(
        mockContact.id,
        mockWorkspaceId,
        newScore,
      );

      expect(prismaService.contact.update).toHaveBeenCalledWith({
        where: { id: mockContact.id },
        data: { score: newScore },
      });
      expect(result.score).toBe(newScore);
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateScore("non-existent", mockWorkspaceId, 50),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getContactsByCompany", () => {
    it("should return all contacts for a company", async () => {
      const companyContacts = [
        mockContact,
        { ...mockContact, id: "contact-456" },
      ];
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue(
        companyContacts,
      );

      const result = await service.getContactsByCompany(
        "company-123",
        mockWorkspaceId,
      );

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          companyId: "company-123",
          workspaceId: mockWorkspaceId,
          deletedAt: null,
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual(companyContacts);
    });

    it("should return empty array if no contacts found", async () => {
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getContactsByCompany(
        "company-999",
        mockWorkspaceId,
      );

      expect(result).toEqual([]);
    });
  });

  describe("addTag", () => {
    it("should add a tag to a contact", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contactTag.create as jest.Mock).mockResolvedValue(
        mockContactTag,
      );

      const result = await service.addTag(
        mockContact.id,
        mockTag.id,
        mockWorkspaceId,
      );

      expect(prismaService.contactTag.create).toHaveBeenCalledWith({
        data: {
          contactId: mockContact.id,
          tagId: mockTag.id,
        },
      });
      expect(result).toEqual(mockContactTag);
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addTag("non-existent", mockTag.id, mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("removeTag", () => {
    it("should remove a tag from a contact", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contactTag.delete as jest.Mock).mockResolvedValue(
        mockContactTag,
      );

      const result = await service.removeTag(
        mockContact.id,
        mockTag.id,
        mockWorkspaceId,
      );

      expect(prismaService.contactTag.delete).toHaveBeenCalledWith({
        where: {
          contactId_tagId: {
            contactId: mockContact.id,
            tagId: mockTag.id,
          },
        },
      });
      expect(result).toEqual(mockContactTag);
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.removeTag("non-existent", mockTag.id, mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("getTags", () => {
    it("should return all tags for a contact", async () => {
      const contactTags = [
        mockContactTag,
        {
          ...mockContactTag,
          tagId: "tag-456",
          tag: { ...mockTag, id: "tag-456", name: "customer" },
        },
      ];
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(
        mockContact,
      );
      (prismaService.contactTag.findMany as jest.Mock).mockResolvedValue(
        contactTags,
      );

      const result = await service.getTags(mockContact.id, mockWorkspaceId);

      expect(prismaService.contactTag.findMany).toHaveBeenCalledWith({
        where: { contactId: mockContact.id },
        include: { tag: true },
      });
      expect(result).toEqual(contactTags.map((ct) => ct.tag));
    });

    it("should throw NotFoundException if contact not found", async () => {
      (prismaService.contact.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.getTags("non-existent", mockWorkspaceId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe("findAll with additional filters", () => {
    it("should filter by source", async () => {
      const filters = { source: "WEBSITE" };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          source: "WEBSITE",
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should filter by location fields", async () => {
      const filters = {
        city: "New York",
        state: "NY",
        country: "USA",
      };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          city: "New York",
          state: "NY",
          country: "USA",
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should handle multiple filters together", async () => {
      const filters = {
        search: "john",
        status: "ACTIVE",
        source: "MANUAL",
        companyId: "company-123",
        city: "Boston",
        tags: ["vip"],
      };
      (prismaService.contact.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.contact.count as jest.Mock).mockResolvedValue(0);

      await service.findAll(mockWorkspaceId, filters, 0, 10);

      expect(prismaService.contact.findMany).toHaveBeenCalledWith({
        where: {
          workspaceId: mockWorkspaceId,
          deletedAt: null,
          status: "ACTIVE",
          source: "MANUAL",
          companyId: "company-123",
          city: "Boston",
          tags: {
            some: {
              tag: {
                name: { in: ["vip"] },
              },
            },
          },
          OR: expect.any(Array),
        },
        skip: 0,
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });
  });
});
