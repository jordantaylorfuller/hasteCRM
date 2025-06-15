import { Company } from "./company.entity";

describe("Company Entity", () => {
  it("should create a company with all required fields", () => {
    const company = new Company();
    company.id = "company-123";
    company.workspaceId = "workspace-123";
    company.name = "Test Company";
    company.createdAt = new Date();
    company.updatedAt = new Date();
    company.createdById = "user-123";

    expect(company.id).toBe("company-123");
    expect(company.workspaceId).toBe("workspace-123");
    expect(company.name).toBe("Test Company");
    expect(company.createdAt).toBeInstanceOf(Date);
    expect(company.updatedAt).toBeInstanceOf(Date);
    expect(company.createdById).toBe("user-123");
  });

  it("should allow optional fields", () => {
    const company = new Company();
    company.id = "company-123";
    company.workspaceId = "workspace-123";
    company.name = "Test Company";
    company.domain = "testcompany.com";
    company.website = "https://testcompany.com";
    company.logoUrl = "https://testcompany.com/logo.png";
    company.description = "A test company";
    company.industry = "Technology";
    company.size = "50-100";
    company.revenue = 1000000;
    company.foundedYear = 2020;
    company.linkedinUrl = "https://linkedin.com/company/test";
    company.twitterUrl = "https://twitter.com/test";
    company.facebookUrl = "https://facebook.com/test";
    company.address = "123 Main St";
    company.city = "San Francisco";
    company.state = "CA";
    company.country = "USA";
    company.postalCode = "94105";
    company.phone = "+1-555-1234";
    company.deletedAt = new Date();
    company.createdAt = new Date();
    company.updatedAt = new Date();
    company.createdById = "user-123";

    expect(company.domain).toBe("testcompany.com");
    expect(company.website).toBe("https://testcompany.com");
    expect(company.logoUrl).toBe("https://testcompany.com/logo.png");
    expect(company.description).toBe("A test company");
    expect(company.industry).toBe("Technology");
    expect(company.size).toBe("50-100");
    expect(company.revenue).toBe(1000000);
    expect(company.foundedYear).toBe(2020);
    expect(company.linkedinUrl).toBe("https://linkedin.com/company/test");
    expect(company.twitterUrl).toBe("https://twitter.com/test");
    expect(company.facebookUrl).toBe("https://facebook.com/test");
    expect(company.address).toBe("123 Main St");
    expect(company.city).toBe("San Francisco");
    expect(company.state).toBe("CA");
    expect(company.country).toBe("USA");
    expect(company.postalCode).toBe("94105");
    expect(company.phone).toBe("+1-555-1234");
    expect(company.deletedAt).toBeInstanceOf(Date);
  });

  it("should handle undefined optional fields", () => {
    const company = new Company();
    company.id = "company-123";
    company.workspaceId = "workspace-123";
    company.name = "Test Company";
    company.createdAt = new Date();
    company.updatedAt = new Date();
    company.createdById = "user-123";

    expect(company.domain).toBeUndefined();
    expect(company.website).toBeUndefined();
    expect(company.logoUrl).toBeUndefined();
    expect(company.description).toBeUndefined();
    expect(company.industry).toBeUndefined();
    expect(company.size).toBeUndefined();
    expect(company.revenue).toBeUndefined();
    expect(company.foundedYear).toBeUndefined();
    expect(company.linkedinUrl).toBeUndefined();
    expect(company.twitterUrl).toBeUndefined();
    expect(company.facebookUrl).toBeUndefined();
    expect(company.address).toBeUndefined();
    expect(company.city).toBeUndefined();
    expect(company.state).toBeUndefined();
    expect(company.country).toBeUndefined();
    expect(company.postalCode).toBeUndefined();
    expect(company.phone).toBeUndefined();
    expect(company.deletedAt).toBeUndefined();
  });
});