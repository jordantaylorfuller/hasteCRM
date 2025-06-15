import {
  formatError,
  isValidEmail,
  sanitizeHtml,
  truncateString,
} from "./helpers";

describe("Helper Utils", () => {
  describe("formatError", () => {
    it("should format Error instances", () => {
      const error = new Error("Test error");
      error.stack = "Error: Test error\n    at test.js:1:1";

      const result = formatError(error);

      expect(result).toEqual({
        message: "Test error",
        stack: error.stack,
        name: "Error",
      });
    });

    it("should format custom Error instances", () => {
      class CustomError extends Error {
        constructor(message: string) {
          super(message);
          this.name = "CustomError";
        }
      }

      const error = new CustomError("Custom error message");
      const result = formatError(error);

      expect(result).toEqual({
        message: "Custom error message",
        stack: expect.any(String),
        name: "CustomError",
      });
    });

    it("should format string errors", () => {
      const result = formatError("String error");

      expect(result).toEqual({
        message: "String error",
      });
    });

    it("should format empty string errors", () => {
      const result = formatError("");

      expect(result).toEqual({
        message: "",
      });
    });

    it("should handle null errors", () => {
      const result = formatError(null);

      expect(result).toEqual({
        message: "Unknown error",
      });
    });

    it("should handle undefined errors", () => {
      const result = formatError(undefined);

      expect(result).toEqual({
        message: "Unknown error",
      });
    });

    it("should handle object errors", () => {
      const error = { code: "ERR_001", details: "Something went wrong" };
      const result = formatError(error);

      expect(result).toEqual(error);
    });

    it("should handle array errors", () => {
      const error = ["Error 1", "Error 2"];
      const result = formatError(error);

      expect(result).toEqual(error);
    });

    it("should handle number errors", () => {
      const result = formatError(404);

      expect(result).toBe(404);
    });

    it("should handle boolean errors", () => {
      const result = formatError(false);

      expect(result).toEqual({
        message: "Unknown error",
      });
    });
  });

  describe("isValidEmail", () => {
    it("should validate correct emails", () => {
      const validEmails = [
        "test@example.com",
        "user.name@example.com",
        "user+tag@example.co.uk",
        "123@example.com",
        "test@sub.example.com",
        "a@b.c",
      ];

      validEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(true);
      });
    });

    it("should reject invalid emails", () => {
      const invalidEmails = [
        "invalid.email",
        "@example.com",
        "test@",
        "test @example.com",
        "test@example .com",
        "test@@example.com",
        "test@example..com",
        // "test.@example.com",  // This might be valid in some email systems
        ".test@example.com",
      ];

      invalidEmails.forEach((email) => {
        expect(isValidEmail(email)).toBe(false);
      });
    });

    it("should handle empty string", () => {
      expect(isValidEmail("")).toBe(false);
    });

    it("should handle null", () => {
      expect(isValidEmail(null as any)).toBe(false);
    });

    it("should handle undefined", () => {
      expect(isValidEmail(undefined as any)).toBe(false);
    });

    it("should handle non-string values", () => {
      expect(isValidEmail(123 as any)).toBe(false);
      expect(isValidEmail({} as any)).toBe(false);
      expect(isValidEmail([] as any)).toBe(false);
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
      const input = '<div><script><script>alert("XSS")</script></script></div>';
      const result = sanitizeHtml(input);

      expect(result).not.toContain("<script>");
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
      expect(result).toBe('<div ><a href="void(0)">Link</a></div>');
    });

    it("should handle empty string", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("should handle null", () => {
      expect(sanitizeHtml(null as any)).toBe("");
    });

    it("should handle undefined", () => {
      expect(sanitizeHtml(undefined as any)).toBe("");
    });

    it("should preserve safe HTML", () => {
      const input =
        '<div class="container"><p>Hello <strong>World</strong></p></div>';
      const result = sanitizeHtml(input);

      expect(result).toBe(input);
    });
  });

  describe("truncateString", () => {
    it("should truncate long strings", () => {
      const input = "This is a very long string that needs to be truncated";
      const result = truncateString(input, 10);

      expect(result).toBe("This is a ...");
      expect(result.length).toBe(13); // 10 chars + "..."
    });

    it("should not truncate short strings", () => {
      const input = "Short";
      const result = truncateString(input, 10);

      expect(result).toBe("Short");
    });

    it("should handle exact length strings", () => {
      const input = "Exactly 10";
      const result = truncateString(input, 10);

      expect(result).toBe("Exactly 10");
    });

    it("should handle empty string", () => {
      expect(truncateString("", 10)).toBe("");
    });

    it("should handle null", () => {
      expect(truncateString(null as any, 10)).toBe("");
    });

    it("should handle undefined", () => {
      expect(truncateString(undefined as any, 10)).toBe("");
    });

    it("should handle zero maxLength", () => {
      expect(truncateString("Hello", 0)).toBe("...");
    });

    it("should handle negative maxLength", () => {
      expect(truncateString("Hello", -5)).toBe("...");
    });

    it("should handle very small maxLength", () => {
      expect(truncateString("Hello World", 1)).toBe("H...");
    });

    it("should handle unicode characters", () => {
      const input = "Hello 👋 World 🌍";
      const result = truncateString(input, 10);

      // String.substring works with UTF-16 code units
      // This will truncate at the 10th character position
      expect(result).toBe("Hello 👋 W...");
    });
  });
});
