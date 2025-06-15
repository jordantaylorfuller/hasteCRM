import { Test, TestingModule } from "@nestjs/testing";
import { ContactsResolver } from "./contacts.resolver";
import { ContactsService } from "./contacts.service";
import { CreateContactInput } from "./dto/create-contact.input";
import { UpdateContactInput } from "./dto/update-contact.input";
import { ContactFiltersInput } from "./dto/contact-filters.input";
import { CustomGqlAuthGuard } from "../../common/guards/custom-gql-auth.guard";

// Mock the auth guard
jest.mock("../../common/guards/custom-gql-auth.guard");

describe("ContactsResolver - 100% Coverage", () => {
  let resolver: ContactsResolver;
  let _service: ContactsService;

  const mockContactsService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    search: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    restore: jest.fn(),
    updateScore: jest.fn(),
    getContactsByCompany: jest.fn(),
  };

  const mockContext = {
    req: {
      user: {
        userId: "user-123",
        workspaceId: "workspace-123",
      },
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Mock the guard to always return true
    (CustomGqlAuthGuard as jest.Mock).mockImplementation(() => ({
      canActivate: jest.fn().mockReturnValue(true),
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContactsResolver,
        {
          provide: ContactsService,
          useValue: mockContactsService,
        },
      ],
    })
      .overrideGuard(CustomGqlAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    resolver = module.get<ContactsResolver>(ContactsResolver);
    _service = module.get<ContactsService>(ContactsService);
  });

  describe("createContact - line 15", () => {
    it("should create a contact", async () => {
      const input: CreateContactInput = {
        firstName: "John",
        lastName: "Doe",
        email: "john.doe@example.com",
        phone: "+1234567890",
        companyId: "company-123",
      };

      const expectedContact = {
        id: "contact-123",
        ...input,
        workspaceId: "workspace-123",
        createdById: "user-123",
      };

      mockContactsService.create.mockResolvedValue(expectedContact);

      const result = await resolver.createContact(input, mockContext);

      expect(mockContactsService.create).toHaveBeenCalledWith(
        "workspace-123",
        "user-123",
        input,
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("findAll - line 24", () => {
    it("should find all contacts without filters", async () => {
      const expectedResponse = {
        contacts: [
          { id: "1", firstName: "John", lastName: "Doe" },
          { id: "2", firstName: "Jane", lastName: "Smith" },
        ],
        total: 2,
        hasMore: false,
      };

      mockContactsService.findAll.mockResolvedValue(expectedResponse);

      const result = await resolver.findAll(
        undefined,
        undefined,
        undefined,
        mockContext,
      );

      expect(mockContactsService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });

    it("should find all contacts with filters and pagination", async () => {
      const filters: ContactFiltersInput = {
        tags: ["important", "client"],
        score: { min: 50, max: 100 },
        companyId: "company-123",
        dateRange: {
          start: new Date("2023-01-01"),
          end: new Date("2023-12-31"),
        },
      };

      const expectedResponse = {
        contacts: [{ id: "1", firstName: "John", lastName: "Doe" }],
        total: 1,
        hasMore: true,
      };

      mockContactsService.findAll.mockResolvedValue(expectedResponse);

      const result = await resolver.findAll(filters, 10, 5, mockContext);

      expect(mockContactsService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        filters,
        10,
        5,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("findOne - line 35", () => {
    it("should find one contact by id", async () => {
      const contactId = "contact-123";
      const expectedContact = {
        id: contactId,
        firstName: "John",
        lastName: "Doe",
        email: "john@example.com",
      };

      mockContactsService.findOne.mockResolvedValue(expectedContact);

      const result = await resolver.findOne(contactId, mockContext);

      expect(mockContactsService.findOne).toHaveBeenCalledWith(
        contactId,
        "workspace-123",
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("search - line 44", () => {
    it("should search contacts without filters", async () => {
      const query = "john";
      const expectedResponse = {
        contacts: [
          { id: "1", firstName: "John", lastName: "Doe" },
          { id: "2", firstName: "Johnny", lastName: "Smith" },
        ],
        total: 2,
        hasMore: false,
      };

      mockContactsService.search.mockResolvedValue(expectedResponse);

      const result = await resolver.search(
        query,
        undefined,
        undefined,
        undefined,
        mockContext,
      );

      expect(mockContactsService.search).toHaveBeenCalledWith(
        "workspace-123",
        query,
        undefined,
        undefined,
        undefined,
      );
      expect(result).toEqual(expectedResponse);
    });

    it("should search contacts with filters and pagination", async () => {
      const query = "client";
      const filters: ContactFiltersInput = {
        tags: ["vip"],
        score: { min: 80 },
      };

      const expectedResponse = {
        contacts: [{ id: "1", firstName: "VIP", lastName: "Client" }],
        total: 15,
        hasMore: true,
      };

      mockContactsService.search.mockResolvedValue(expectedResponse);

      const result = await resolver.search(query, filters, 20, 10, mockContext);

      expect(mockContactsService.search).toHaveBeenCalledWith(
        "workspace-123",
        query,
        filters,
        20,
        10,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe("updateContact - line 56", () => {
    it("should update a contact", async () => {
      const input: UpdateContactInput = {
        id: "contact-123",
        firstName: "John Updated",
        lastName: "Doe Updated",
        tags: ["updated"],
      };

      const expectedContact = {
        id: "contact-123",
        firstName: "John Updated",
        lastName: "Doe Updated",
        tags: ["updated"],
      };

      mockContactsService.update.mockResolvedValue(expectedContact);

      const result = await resolver.updateContact(input, mockContext);

      expect(mockContactsService.update).toHaveBeenCalledWith(
        "contact-123",
        "workspace-123",
        {
          firstName: "John Updated",
          lastName: "Doe Updated",
          tags: ["updated"],
        },
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("removeContact - line 66", () => {
    it("should remove a contact", async () => {
      const contactId = "contact-123";
      const expectedContact = {
        id: contactId,
        firstName: "John",
        lastName: "Doe",
        deletedAt: new Date(),
      };

      mockContactsService.remove.mockResolvedValue(expectedContact);

      const result = await resolver.removeContact(contactId, mockContext);

      expect(mockContactsService.remove).toHaveBeenCalledWith(
        contactId,
        "workspace-123",
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("restoreContact - line 75", () => {
    it("should restore a deleted contact", async () => {
      const contactId = "contact-123";
      const expectedContact = {
        id: contactId,
        firstName: "John",
        lastName: "Doe",
        deletedAt: null,
      };

      mockContactsService.restore.mockResolvedValue(expectedContact);

      const result = await resolver.restoreContact(contactId, mockContext);

      expect(mockContactsService.restore).toHaveBeenCalledWith(
        contactId,
        "workspace-123",
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("updateContactScore - line 84", () => {
    it("should update contact score", async () => {
      const contactId = "contact-123";
      const score = 85;
      const expectedContact = {
        id: contactId,
        firstName: "John",
        lastName: "Doe",
        score: 85,
      };

      mockContactsService.updateScore.mockResolvedValue(expectedContact);

      const result = await resolver.updateContactScore(
        contactId,
        score,
        mockContext,
      );

      expect(mockContactsService.updateScore).toHaveBeenCalledWith(
        contactId,
        "workspace-123",
        score,
      );
      expect(result).toEqual(expectedContact);
    });
  });

  describe("contactsByCompany - line 94", () => {
    it("should get contacts by company", async () => {
      const companyId = "company-123";
      const expectedContacts = [
        { id: "1", firstName: "John", lastName: "Doe", companyId },
        { id: "2", firstName: "Jane", lastName: "Smith", companyId },
      ];

      mockContactsService.getContactsByCompany.mockResolvedValue(
        expectedContacts,
      );

      const result = await resolver.contactsByCompany(companyId, mockContext);

      expect(mockContactsService.getContactsByCompany).toHaveBeenCalledWith(
        companyId,
        "workspace-123",
      );
      expect(result).toEqual(expectedContacts);
    });
  });

  describe("Edge cases", () => {
    it("should handle missing optional parameters in findAll", async () => {
      mockContactsService.findAll.mockResolvedValue({
        contacts: [],
        total: 0,
        hasMore: false,
      });

      await resolver.findAll(null, null, null, mockContext);

      expect(mockContactsService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        null,
        null,
        null,
      );
    });

    it("should use default values when parameters are explicitly passed", async () => {
      mockContactsService.findAll.mockResolvedValue({
        contacts: [],
        total: 0,
        hasMore: false,
      });

      await resolver.findAll(undefined, 0, 20, mockContext);

      expect(mockContactsService.findAll).toHaveBeenCalledWith(
        "workspace-123",
        undefined,
        0,
        20,
      );
    });

    it("should handle empty filters in search", async () => {
      const emptyFilters: ContactFiltersInput = {};

      mockContactsService.search.mockResolvedValue({
        contacts: [],
        total: 0,
        hasMore: false,
      });

      await resolver.search("test", emptyFilters, 0, 50, mockContext);

      expect(mockContactsService.search).toHaveBeenCalledWith(
        "workspace-123",
        "test",
        emptyFilters,
        0,
        50,
      );
    });

    it("should handle updateContact with minimal input", async () => {
      const input: UpdateContactInput = {
        id: "contact-123",
      };

      mockContactsService.update.mockResolvedValue({
        id: "contact-123",
        firstName: "John",
        lastName: "Doe",
      });

      await resolver.updateContact(input, mockContext);

      expect(mockContactsService.update).toHaveBeenCalledWith(
        "contact-123",
        "workspace-123",
        {},
      );
    });
  });
});
