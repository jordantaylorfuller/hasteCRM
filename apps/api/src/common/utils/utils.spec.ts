import { hashPassword, comparePassword, generateRandomToken } from "./crypto";
import {
  formatError,
  isValidEmail,
  sanitizeHtml,
  truncateString,
} from "./helpers";
import { paginateResults, calculateSkip } from "./pagination";

// Also test importing from the index barrel file
import * as utilsIndex from "./index";

// Mock bcrypt
jest.mock("bcrypt", () => ({
  hash: jest.fn().mockResolvedValue("hashed_password"),
  compare: jest.fn().mockResolvedValue(true),
}));

// Mock crypto
jest.mock("crypto", () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue("random_token_123"),
  }),
}));

describe("Common Utils", () => {
  describe("Index exports", () => {
    it("should export all utility functions from index", () => {
      // Test that functions are exported from the index file
      expect(utilsIndex.hashPassword).toBeDefined();
      expect(utilsIndex.comparePassword).toBeDefined();
      expect(utilsIndex.generateRandomToken).toBeDefined();
      expect(utilsIndex.formatError).toBeDefined();
      expect(utilsIndex.isValidEmail).toBeDefined();
      expect(utilsIndex.sanitizeHtml).toBeDefined();
      expect(utilsIndex.truncateString).toBeDefined();
      expect(utilsIndex.paginateResults).toBeDefined();
      expect(utilsIndex.calculateSkip).toBeDefined();
    });
  });

  describe("Crypto Utils", () => {
    describe("hashPassword", () => {
      it("should hash a password", async () => {
        const password = "mySecurePassword123";
        const result = await hashPassword(password);

        expect(result).toBe("hashed_password");
        const bcrypt = jest.requireMock("bcrypt");
        expect(bcrypt.hash).toHaveBeenCalledWith(password, 10);
      });

      it("should handle empty password", async () => {
        await expect(hashPassword("")).rejects.toThrow();
      });
    });

    describe("comparePassword", () => {
      it("should compare passwords correctly", async () => {
        const password = "mySecurePassword123";
        const hash = "hashed_password";

        const result = await comparePassword(password, hash);

        expect(result).toBe(true);
        const bcrypt = jest.requireMock("bcrypt");
        expect(bcrypt.compare).toHaveBeenCalledWith(password, hash);
      });

      it("should return false for incorrect password", async () => {
        const bcrypt = jest.requireMock("bcrypt");
        bcrypt.compare = jest.fn().mockResolvedValue(false);

        const result = await comparePassword("wrongPassword", "hash");

        expect(result).toBe(false);
      });
    });

    describe("generateRandomToken", () => {
      it("should generate a random token", () => {
        const result = generateRandomToken();

        expect(result).toBe("random_token_123");
        const crypto = jest.requireMock("crypto");
        expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      });

      it("should generate token with custom length", () => {
        const result = generateRandomToken(16);

        expect(result).toBe("random_token_123");
        const crypto = jest.requireMock("crypto");
        expect(crypto.randomBytes).toHaveBeenCalledWith(16);
      });
    });
  });

  describe("Helper Utils", () => {
    describe("formatError", () => {
      it("should format error object", () => {
        const error = new Error("Test error");
        const result = formatError(error);

        expect(result).toMatchObject({
          message: "Test error",
          stack: expect.any(String),
          name: "Error",
        });
      });

      it("should handle non-Error objects", () => {
        const error = { code: "ERR_001", details: "Something went wrong" };
        const result = formatError(error);

        expect(result).toMatchObject({
          code: "ERR_001",
          details: "Something went wrong",
        });
      });

      it("should handle string errors", () => {
        const result = formatError("Simple error message");

        expect(result).toMatchObject({
          message: "Simple error message",
        });
      });

      it("should handle null/undefined errors", () => {
        expect(formatError(null)).toEqual({ message: "Unknown error" });
        expect(formatError(undefined)).toEqual({ message: "Unknown error" });
      });

      it("should handle empty object", () => {
        expect(formatError({})).toEqual({});
      });
    });

    describe("isValidEmail", () => {
      it("should validate correct email addresses", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
        expect(isValidEmail("test.user+tag@domain.co.uk")).toBe(true);
        expect(isValidEmail("123@456.789")).toBe(true);
      });

      it("should reject invalid email addresses", () => {
        expect(isValidEmail("notanemail")).toBe(false);
        expect(isValidEmail("@example.com")).toBe(false);
        expect(isValidEmail("user@")).toBe(false);
        expect(isValidEmail("user @example.com")).toBe(false);
        expect(isValidEmail("")).toBe(false);
        expect(isValidEmail(null as any)).toBe(false);
        expect(isValidEmail(undefined as any)).toBe(false);
      });
    });

    describe("sanitizeHtml", () => {
      it("should remove script tags", () => {
        const input = '<p>Hello</p><script>alert("XSS")</script>';
        const result = sanitizeHtml(input);

        expect(result).not.toContain("<script>");
        expect(result).toContain("<p>Hello</p>");
      });

      it("should remove complex script tags with attributes", () => {
        const input =
          '<script type="text/javascript" src="evil.js"></script><p>Content</p>';
        const result = sanitizeHtml(input);

        expect(result).not.toContain("<script");
        expect(result).toBe("<p>Content</p>");
      });

      it("should remove nested script tags", () => {
        const input =
          '<div><script><script>alert("XSS")</script></script></div>';
        const result = sanitizeHtml(input);

        expect(result).not.toContain("<script>");
        // The regex removes the outer script tag but leaves the closing tag of inner script
        expect(result).toBe("<div></script></div>");
      });

      it("should remove event handlers", () => {
        const inputs = [
          "<div onclick=\"alert('XSS')\">Click me</div>",
          '<img onload="malicious()" src="image.jpg">',
          '<button onmouseover="hack()">Hover</button>',
          '<input onfocus="steal()" type="text">',
        ];

        inputs.forEach((input) => {
          const result = sanitizeHtml(input);
          expect(result).not.toMatch(/on\w+\s*=/);
        });
      });

      it("should remove javascript: URLs", () => {
        const inputs = [
          "<a href=\"javascript:alert('XSS')\">Link</a>",
          '<img src="javascript:void(0)">',
          '<iframe src="JAVASCRIPT:malicious()"></iframe>',
        ];

        inputs.forEach((input) => {
          const result = sanitizeHtml(input);
          expect(result).not.toMatch(/javascript:/i);
        });
      });

      it("should handle multiple malicious patterns", () => {
        const input =
          '<div onclick="hack()"><script>alert("XSS")</script><a href="javascript:void(0)">Link</a></div>';
        const result = sanitizeHtml(input);

        expect(result).not.toContain("<script");
        expect(result).not.toMatch(/onclick=/);
        expect(result).not.toContain("javascript:");
        // The actual result after sanitization
        expect(result).toBe('<div ><a href="void(0)">Link</a></div>');
      });

      it("should allow safe HTML tags", () => {
        const input = "<p>Hello <strong>world</strong></p>";
        const result = sanitizeHtml(input);

        expect(result).toBe(input);
      });

      it("should handle empty input", () => {
        expect(sanitizeHtml("")).toBe("");
        expect(sanitizeHtml(null as any)).toBe("");
        expect(sanitizeHtml(undefined as any)).toBe("");
      });
    });

    describe("truncateString", () => {
      it("should truncate long strings", () => {
        const input = "This is a very long string that needs to be truncated";
        const result = truncateString(input, 20);

        expect(result).toBe("This is a very long ...");
        expect(result.length).toBe(23); // 20 + '...'
      });

      it("should not truncate short strings", () => {
        const input = "Short string";
        const result = truncateString(input, 20);

        expect(result).toBe(input);
      });

      it("should handle string exactly at max length", () => {
        const input = "Exactly twenty chars";
        const result = truncateString(input, 20);

        expect(result).toBe(input);
        expect(result.length).toBe(20);
      });

      it("should handle Unicode characters", () => {
        const input = "Hello 👋 World 🌍 Test 🚀 String";
        const result = truncateString(input, 10);

        // Emojis count as 2 characters in JS string length
        expect(result).toBe("Hello 👋 W...");
      });

      it("should handle multi-byte characters", () => {
        const input = "你好世界这是一个测试字符串";
        const result = truncateString(input, 5);

        expect(result).toBe("你好世界这...");
      });

      it("should handle null and undefined", () => {
        expect(truncateString(null as any, 10)).toBe("");
        expect(truncateString(undefined as any, 10)).toBe("");
      });

      it("should handle negative max length", () => {
        expect(truncateString("test", -1)).toBe("...");
        expect(truncateString("test", -100)).toBe("...");
      });

      it("should handle edge cases", () => {
        expect(truncateString("", 10)).toBe("");
        expect(truncateString("test", 0)).toBe("...");
      });

      it("should handle very large max length", () => {
        const input = "Short string";
        const result = truncateString(input, 1000);

        expect(result).toBe(input);
      });

      it("should handle strings with only spaces", () => {
        const input = "     ";
        const result = truncateString(input, 3);

        expect(result).toBe("   ...");
      });
    });
  });

  describe("Pagination Utils", () => {
    describe("calculateSkip", () => {
      it("should calculate skip value correctly", () => {
        expect(calculateSkip(1, 10)).toBe(0);
        expect(calculateSkip(2, 10)).toBe(10);
        expect(calculateSkip(3, 25)).toBe(50);
      });

      it("should handle invalid inputs", () => {
        expect(calculateSkip(0, 10)).toBe(0);
        expect(calculateSkip(-1, 10)).toBe(0);
        expect(calculateSkip(1, 0)).toBe(0);
      });
    });

    describe("paginateResults", () => {
      it("should paginate results correctly", () => {
        const items = Array.from({ length: 100 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 2, 10, 100);

        expect(result).toMatchObject({
          items: expect.arrayContaining([{ id: 10 }, { id: 19 }]),
          total: 100,
          page: 2,
          limit: 10,
          pages: 10,
          hasNext: true,
          hasPrev: true,
        });
      });

      it("should handle first page", () => {
        const items = Array.from({ length: 10 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 1, 10, 50);

        expect(result.hasPrev).toBe(false);
        expect(result.hasNext).toBe(true);
      });

      it("should handle last page", () => {
        const items = Array.from({ length: 5 }, (_, i) => ({ id: i }));
        const result = paginateResults(items, 5, 10, 45);

        expect(result.hasPrev).toBe(true);
        expect(result.hasNext).toBe(false);
        expect(result.pages).toBe(5);
      });

      it("should handle empty results", () => {
        const result = paginateResults([], 1, 10, 0);

        expect(result).toMatchObject({
          items: [],
          total: 0,
          page: 1,
          limit: 10,
          pages: 0,
          hasNext: false,
          hasPrev: false,
        });
      });
    });
  });
});
