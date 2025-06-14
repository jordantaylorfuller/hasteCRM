import { Test, TestingModule } from "@nestjs/testing";
import { ContactsResolver } from "./contacts.resolver";
import { ContactsService } from "./contacts.service";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

describe("ContactsResolver", () => {
  let resolver: ContactsResolver;
  let contactsService: ContactsService;

  const mockUser = {
    id: "user-123",
    workspaceId: "workspace-123",
    email: "test@example.com",
    userId: "user-123",
  };

  const mockContact = {
    id: "contact-123",
    workspaceId: mockUser.workspaceId,
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
    createdBy: mockUser.id,
    company: {
      id: "company-123",
      name: "ACME Corp",
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsResolver,
        {
          provide: ContactsService,
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
            remove: jest.fn(),
            restore: jest.fn(),
            updateScore: jest.fn(),
            getContactsByCompany: jest.fn(),
            search: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    resolver = module.get<ContactsResolver>(ContactsResolver);
    contactsService = module.get<ContactsService>(ContactsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("createContact", () => {
    it("should create a contact", async () => {
      const createInput = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        title: "CEO",
        companyId: "company-123",
        tags: ["vip", "customer"],
      };

      (contactsService.create as jest.Mock).mockResolvedValue(mockContact);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.createContact(createInput, mockContext);

      expect(contactsService.create).toHaveBeenCalledWith(
        mockUser.workspaceId,
        mockUser.userId,
        createInput,
      );
      expect(result).toEqual(mockContact);
    });
  });

  describe("findAll", () => {
    it("should return paginated contacts", async () => {
      const paginationResult = {
        contacts: [mockContact],
        total: 1,
        hasMore: false,
      };

      (contactsService.findAll as jest.Mock).mockResolvedValue(
        paginationResult,
      );

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.findAll(undefined, 0, 20, mockContext);

      expect(contactsService.findAll).toHaveBeenCalledWith(
        mockUser.workspaceId,
        undefined,
        0,
        20,
      );
      expect(result).toEqual(paginationResult);
    });

    it("should apply filters", async () => {
      const filters = {
        search: "john",
        status: "ACTIVE",
        tags: ["vip"],
        companyId: "company-123",
      };

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const paginationResult = {
        contacts: [mockContact],
        total: 1,
        hasMore: false,
      };

      (contactsService.findAll as jest.Mock).mockResolvedValue(
        paginationResult,
      );

      await resolver.findAll(filters, 10, 20, mockContext);

      expect(contactsService.findAll).toHaveBeenCalledWith(
        mockUser.workspaceId,
        filters,
        10,
        20,
      );
    });
  });

  describe("findOne", () => {
    it("should return a single contact", async () => {
      (contactsService.findOne as jest.Mock).mockResolvedValue(mockContact);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.findOne(mockContact.id, mockContext);

      expect(contactsService.findOne).toHaveBeenCalledWith(
        mockContact.id,
        mockUser.workspaceId,
      );
      expect(result).toEqual(mockContact);
    });
  });

  describe("searchContacts", () => {
    it("should search contacts by query", async () => {
      const searchResult = {
        contacts: [mockContact],
        total: 1,
        hasMore: false,
      };

      (contactsService.search as jest.Mock).mockResolvedValue(searchResult);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.search(
        "john",
        undefined,
        0,
        20,
        mockContext,
      );

      expect(contactsService.search).toHaveBeenCalledWith(
        mockUser.workspaceId,
        "john",
        undefined,
        0,
        20,
      );
      expect(result).toEqual(searchResult);
    });

    it("should search with filters", async () => {
      const filters = {
        status: "ACTIVE",
        tags: ["vip"],
        companyId: "company-123",
      };

      const searchResult = {
        contacts: [mockContact],
        total: 1,
        hasMore: false,
      };

      (contactsService.search as jest.Mock).mockResolvedValue(searchResult);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.search(
        "john",
        filters,
        0,
        10,
        mockContext,
      );

      expect(contactsService.search).toHaveBeenCalledWith(
        mockUser.workspaceId,
        "john",
        filters,
        0,
        10,
      );
      expect(result).toEqual(searchResult);
    });
  });

  describe("updateContact", () => {
    it("should update a contact", async () => {
      const updateInput = {
        id: "contact-123",
        firstName: "Jane",
        phone: "+0987654321",
      };

      const updatedContact = { ...mockContact, ...updateInput };
      (contactsService.update as jest.Mock).mockResolvedValue(updatedContact);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.updateContact(updateInput, mockContext);

      expect(contactsService.update).toHaveBeenCalledWith(
        "contact-123",
        mockUser.workspaceId,
        {
          firstName: "Jane",
          phone: "+0987654321",
        },
      );
      expect(result).toEqual(updatedContact);
    });
  });

  describe("removeContact", () => {
    it("should delete a contact", async () => {
      const deletedContact = { ...mockContact, deletedAt: new Date() };
      (contactsService.remove as jest.Mock).mockResolvedValue(deletedContact);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.removeContact("contact-123", mockContext);

      expect(contactsService.remove).toHaveBeenCalledWith(
        "contact-123",
        mockUser.workspaceId,
      );
      expect(result).toEqual(deletedContact);
    });
  });

  describe("restoreContact", () => {
    it("should restore a deleted contact", async () => {
      const restoredContact = { ...mockContact, deletedAt: null };
      (contactsService.restore as jest.Mock).mockResolvedValue(restoredContact);

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.restoreContact("contact-123", mockContext);

      expect(contactsService.restore).toHaveBeenCalledWith(
        "contact-123",
        mockUser.workspaceId,
      );
      expect(result).toEqual(restoredContact);
    });
  });

  describe("updateContactScore", () => {
    it("should update contact score", async () => {
      const updatedContact = { ...mockContact, score: 85 };
      (contactsService.updateScore as jest.Mock).mockResolvedValue(
        updatedContact,
      );

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.updateContactScore(
        "contact-123",
        85,
        mockContext,
      );

      expect(contactsService.updateScore).toHaveBeenCalledWith(
        "contact-123",
        mockUser.workspaceId,
        85,
      );
      expect(result).toEqual(updatedContact);
    });
  });

  describe("contactsByCompany", () => {
    it("should return contacts for a company", async () => {
      const companyContacts = [
        mockContact,
        { ...mockContact, id: "contact-456" },
      ];
      (contactsService.getContactsByCompany as jest.Mock).mockResolvedValue(
        companyContacts,
      );

      const mockContext = {
        req: {
          user: mockUser,
        },
      };

      const result = await resolver.contactsByCompany(
        "company-123",
        mockContext,
      );

      expect(contactsService.getContactsByCompany).toHaveBeenCalledWith(
        "company-123",
        mockUser.workspaceId,
      );
      expect(result).toEqual(companyContacts);
    });
  });
});
