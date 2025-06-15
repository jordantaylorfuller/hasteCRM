import { validate } from "class-validator";
import { ImportContactsInput, ExportContactsInput } from "./import-contacts.input";

describe("Import/Export DTOs", () => {
  describe("ImportContactsInput", () => {
    it("should create a valid import input with all fields", async () => {
      const input = new ImportContactsInput();
      input.fileUrl = "https://example.com/contacts.csv";
      input.format = "csv";
      input.mapping = {
        "First Name": "firstName",
        "Last Name": "lastName",
        "Email Address": "email",
        "Phone Number": "phone",
      };

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(input.fileUrl).toBe("https://example.com/contacts.csv");
      expect(input.format).toBe("csv");
      expect(input.mapping).toEqual({
        "First Name": "firstName",
        "Last Name": "lastName",
        "Email Address": "email",
        "Phone Number": "phone",
      });
    });

    it("should fail validation when fileUrl is missing", async () => {
      const input = new ImportContactsInput();
      input.format = "csv";
      input.mapping = {};

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("fileUrl");
    });

    it("should fail validation when format is missing", async () => {
      const input = new ImportContactsInput();
      input.fileUrl = "https://example.com/contacts.csv";
      input.mapping = {};

      const errors = await validate(input);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].property).toBe("format");
    });

    it("should handle different file formats", async () => {
      const formats = ["csv", "xlsx", "json"];
      
      for (const format of formats) {
        const input = new ImportContactsInput();
        input.fileUrl = `https://example.com/contacts.${format}`;
        input.format = format;
        input.mapping = { "email": "email" };

        const errors = await validate(input);
        expect(errors).toHaveLength(0);
      }
    });

    it("should handle complex mapping", async () => {
      const input = new ImportContactsInput();
      input.fileUrl = "https://example.com/contacts.csv";
      input.format = "csv";
      input.mapping = {
        "Customer Email": "email",
        "Full Name": "fullName",
        "Company Name": "company",
        "Phone (Work)": "phone",
        "Address Line 1": "address",
        "City/Town": "city",
        "State/Province": "state",
        "ZIP/Postal Code": "postalCode",
      };

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(Object.keys(input.mapping)).toHaveLength(8);
    });
  });

  describe("ExportContactsInput", () => {
    it("should create a valid export input with all fields", async () => {
      const input = new ExportContactsInput();
      input.format = "xlsx";
      input.fields = ["firstName", "lastName", "email", "phone", "company"];
      input.filters = {
        status: "ACTIVE",
        source: "WEBSITE",
        tags: ["customer", "vip"],
      };

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(input.format).toBe("xlsx");
      expect(input.fields).toHaveLength(5);
      expect(input.filters).toEqual({
        status: "ACTIVE",
        source: "WEBSITE",
        tags: ["customer", "vip"],
      });
    });

    it("should use default format when not specified", async () => {
      const input = new ExportContactsInput();

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(input.format).toBeUndefined(); // Default value is set at GraphQL level
    });

    it("should allow empty fields and filters", async () => {
      const input = new ExportContactsInput();
      input.format = "json";

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(input.fields).toBeUndefined();
      expect(input.filters).toBeUndefined();
    });

    it("should handle complex filters", async () => {
      const input = new ExportContactsInput();
      input.format = "csv";
      input.filters = {
        createdAt: {
          gte: new Date("2023-01-01"),
          lte: new Date("2023-12-31"),
        },
        score: {
          gte: 50,
        },
        companyId: "company-123",
        tags: {
          some: {
            name: {
              in: ["customer", "lead"],
            },
          },
        },
      };

      const errors = await validate(input);
      expect(errors).toHaveLength(0);
      expect(input.filters.createdAt).toBeDefined();
      expect(input.filters.score).toBeDefined();
      expect(input.filters.companyId).toBe("company-123");
    });

    it("should handle all export formats", async () => {
      const formats = ["csv", "xlsx", "json"];
      
      for (const format of formats) {
        const input = new ExportContactsInput();
        input.format = format;

        const errors = await validate(input);
        expect(errors).toHaveLength(0);
      }
    });
  });
});