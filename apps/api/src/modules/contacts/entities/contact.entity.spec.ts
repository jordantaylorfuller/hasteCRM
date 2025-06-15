import { Contact } from "./contact.entity";
import { ContactStatus, ContactSource } from "../../prisma/prisma-client";

describe("Contact Entity", () => {
  it("should create a contact with all required fields", () => {
    const contact = new Contact();
    contact.id = "contact-123";
    contact.workspaceId = "workspace-123";
    contact.source = ContactSource.WEBSITE;
    contact.status = ContactStatus.ACTIVE;
    contact.score = 85;
    contact.createdAt = new Date();
    contact.updatedAt = new Date();
    contact.createdById = "user-123";

    expect(contact.id).toBe("contact-123");
    expect(contact.workspaceId).toBe("workspace-123");
    expect(contact.source).toBe(ContactSource.WEBSITE);
    expect(contact.status).toBe(ContactStatus.ACTIVE);
    expect(contact.score).toBe(85);
    expect(contact.createdAt).toBeInstanceOf(Date);
    expect(contact.updatedAt).toBeInstanceOf(Date);
    expect(contact.createdById).toBe("user-123");
  });

  it("should allow all optional fields", () => {
    const contact = new Contact();
    contact.id = "contact-123";
    contact.workspaceId = "workspace-123";
    contact.firstName = "John";
    contact.lastName = "Doe";
    contact.email = "john.doe@example.com";
    contact.phone = "+1-555-1234";
    contact.title = "CEO";
    contact.avatarUrl = "https://example.com/avatar.jpg";
    contact.bio = "A successful entrepreneur";
    contact.website = "https://johndoe.com";
    contact.birthday = new Date("1980-01-01");
    contact.linkedinUrl = "https://linkedin.com/in/johndoe";
    contact.twitterUrl = "https://twitter.com/johndoe";
    contact.facebookUrl = "https://facebook.com/johndoe";
    contact.address = "123 Main St";
    contact.city = "San Francisco";
    contact.state = "CA";
    contact.country = "USA";
    contact.postalCode = "94105";
    contact.timezone = "America/Los_Angeles";
    contact.lastActivityAt = new Date();
    contact.deletedAt = new Date();
    contact.companyId = "company-123";
    contact.source = ContactSource.EMAIL;
    contact.status = ContactStatus.LEAD;
    contact.score = 50;
    contact.createdAt = new Date();
    contact.updatedAt = new Date();
    contact.createdById = "user-123";

    expect(contact.firstName).toBe("John");
    expect(contact.lastName).toBe("Doe");
    expect(contact.email).toBe("john.doe@example.com");
    expect(contact.phone).toBe("+1-555-1234");
    expect(contact.title).toBe("CEO");
    expect(contact.avatarUrl).toBe("https://example.com/avatar.jpg");
    expect(contact.bio).toBe("A successful entrepreneur");
    expect(contact.website).toBe("https://johndoe.com");
    expect(contact.birthday).toEqual(new Date("1980-01-01"));
    expect(contact.linkedinUrl).toBe("https://linkedin.com/in/johndoe");
    expect(contact.twitterUrl).toBe("https://twitter.com/johndoe");
    expect(contact.facebookUrl).toBe("https://facebook.com/johndoe");
    expect(contact.address).toBe("123 Main St");
    expect(contact.city).toBe("San Francisco");
    expect(contact.state).toBe("CA");
    expect(contact.country).toBe("USA");
    expect(contact.postalCode).toBe("94105");
    expect(contact.timezone).toBe("America/Los_Angeles");
    expect(contact.lastActivityAt).toBeInstanceOf(Date);
    expect(contact.deletedAt).toBeInstanceOf(Date);
    expect(contact.companyId).toBe("company-123");
  });

  describe("fullName getter", () => {
    it("should return full name when both first and last name are present", () => {
      const contact = new Contact();
      contact.firstName = "John";
      contact.lastName = "Doe";

      expect(contact.fullName).toBe("John Doe");
    });

    it("should return only first name when last name is missing", () => {
      const contact = new Contact();
      contact.firstName = "John";

      expect(contact.fullName).toBe("John");
    });

    it("should return only last name when first name is missing", () => {
      const contact = new Contact();
      contact.lastName = "Doe";

      expect(contact.fullName).toBe("Doe");
    });

    it("should return null when both names are missing", () => {
      const contact = new Contact();

      expect(contact.fullName).toBeNull();
    });

    it("should handle empty strings correctly", () => {
      const contact = new Contact();
      contact.firstName = "";
      contact.lastName = "";

      expect(contact.fullName).toBeNull();
    });

    it("should handle whitespace correctly", () => {
      const contact = new Contact();
      contact.firstName = "  John  ";
      contact.lastName = "  Doe  ";

      expect(contact.fullName).toBe("  John     Doe  ");
    });
  });

  it("should handle undefined optional fields", () => {
    const contact = new Contact();
    contact.id = "contact-123";
    contact.workspaceId = "workspace-123";
    contact.source = ContactSource.MANUAL;
    contact.status = ContactStatus.INACTIVE;
    contact.score = 0;
    contact.createdAt = new Date();
    contact.updatedAt = new Date();
    contact.createdById = "user-123";

    expect(contact.firstName).toBeUndefined();
    expect(contact.lastName).toBeUndefined();
    expect(contact.email).toBeUndefined();
    expect(contact.phone).toBeUndefined();
    expect(contact.title).toBeUndefined();
    expect(contact.avatarUrl).toBeUndefined();
    expect(contact.bio).toBeUndefined();
    expect(contact.website).toBeUndefined();
    expect(contact.birthday).toBeUndefined();
    expect(contact.linkedinUrl).toBeUndefined();
    expect(contact.twitterUrl).toBeUndefined();
    expect(contact.facebookUrl).toBeUndefined();
    expect(contact.address).toBeUndefined();
    expect(contact.city).toBeUndefined();
    expect(contact.state).toBeUndefined();
    expect(contact.country).toBeUndefined();
    expect(contact.postalCode).toBeUndefined();
    expect(contact.timezone).toBeUndefined();
    expect(contact.lastActivityAt).toBeUndefined();
    expect(contact.deletedAt).toBeUndefined();
    expect(contact.companyId).toBeUndefined();
  });
});