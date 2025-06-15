import { validate } from "class-validator";
import { ContactFiltersInput } from "./contact-filters.input";
import { ContactStatus, ContactSource } from "../../prisma/prisma-client";

describe("ContactFiltersInput", () => {
  it("should create a valid contact filter with all fields", async () => {
    const filter = new ContactFiltersInput();
    filter.search = "John Doe";
    filter.status = ContactStatus.ACTIVE;
    filter.source = ContactSource.WEBSITE;
    filter.companyId = "company-123";
    filter.tags = ["customer", "vip"];
    filter.city = "San Francisco";
    filter.state = "CA";
    filter.country = "USA";

    const errors = await validate(filter);
    expect(errors).toHaveLength(0);
    expect(filter.search).toBe("John Doe");
    expect(filter.status).toBe(ContactStatus.ACTIVE);
    expect(filter.source).toBe(ContactSource.WEBSITE);
    expect(filter.companyId).toBe("company-123");
    expect(filter.tags).toEqual(["customer", "vip"]);
    expect(filter.city).toBe("San Francisco");
    expect(filter.state).toBe("CA");
    expect(filter.country).toBe("USA");
  });

  it("should create a valid contact filter with no fields", async () => {
    const filter = new ContactFiltersInput();

    const errors = await validate(filter);
    expect(errors).toHaveLength(0);
    expect(filter.search).toBeUndefined();
    expect(filter.status).toBeUndefined();
    expect(filter.source).toBeUndefined();
    expect(filter.companyId).toBeUndefined();
    expect(filter.tags).toBeUndefined();
    expect(filter.city).toBeUndefined();
    expect(filter.state).toBeUndefined();
    expect(filter.country).toBeUndefined();
  });

  it("should create a valid contact filter with partial fields", async () => {
    const filter = new ContactFiltersInput();
    filter.search = "test@example.com";
    filter.status = ContactStatus.LEAD;

    const errors = await validate(filter);
    expect(errors).toHaveLength(0);
    expect(filter.search).toBe("test@example.com");
    expect(filter.status).toBe(ContactStatus.LEAD);
  });

  it("should validate tags as array of strings", async () => {
    const filter = new ContactFiltersInput();
    filter.tags = ["tag1", "tag2", "tag3"];

    const errors = await validate(filter);
    expect(errors).toHaveLength(0);
    expect(filter.tags).toHaveLength(3);
  });

  it("should allow empty tags array", async () => {
    const filter = new ContactFiltersInput();
    filter.tags = [];

    const errors = await validate(filter);
    expect(errors).toHaveLength(0);
    expect(filter.tags).toHaveLength(0);
  });

  it("should validate all ContactStatus enum values", async () => {
    const statuses = Object.values(ContactStatus);

    for (const status of statuses) {
      const filter = new ContactFiltersInput();
      filter.status = status as ContactStatus;

      const errors = await validate(filter);
      expect(errors).toHaveLength(0);
    }
  });

  it("should validate all ContactSource enum values", async () => {
    const sources = Object.values(ContactSource);

    for (const source of sources) {
      const filter = new ContactFiltersInput();
      filter.source = source as ContactSource;

      const errors = await validate(filter);
      expect(errors).toHaveLength(0);
    }
  });
});
