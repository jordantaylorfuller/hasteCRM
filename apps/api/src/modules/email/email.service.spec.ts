import { Test, TestingModule } from "@nestjs/testing";
import { EmailService } from "./email.service";
import * as nodemailer from "nodemailer";

// Mock nodemailer
jest.mock("nodemailer");

describe("EmailService", () => {
  let service: EmailService;
  let mockTransporter: any;
  let mockSendMail: jest.Mock;

  beforeEach(async () => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create mock transporter
    mockSendMail = jest.fn().mockResolvedValue({ messageId: "123" });
    mockTransporter = {
      sendMail: mockSendMail,
    };

    // Mock createTransport
    (nodemailer.createTransport as jest.Mock).mockReturnValue(mockTransporter);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("constructor", () => {
    it("should create transporter with default localhost settings", () => {
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "localhost",
        port: 1025,
        secure: false,
        auth: undefined,
      });
    });

    it("should create transporter with environment variables when provided", () => {
      // Save original env vars
      const originalEnv = process.env;

      // Set test env vars
      process.env = {
        ...originalEnv,
        SMTP_HOST: "smtp.example.com",
        SMTP_PORT: "587",
        SMTP_USER: "user@example.com",
        SMTP_PASS: "password123",
      };

      // Create new service instance
      new EmailService();

      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        auth: {
          user: "user@example.com",
          pass: "password123",
        },
      });

      // Restore env vars
      process.env = originalEnv;
    });
  });

  describe("sendEmail", () => {
    it("should send email successfully", async () => {
      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
        text: "Test Text",
      };

      await service.sendEmail(options);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"hasteCRM" <noreply@haste.nyc>',
        to: "test@example.com",
        subject: "Test Subject",
        text: "Test Text",
        html: "<p>Test HTML</p>",
      });
    });

    it("should use default empty text if not provided", async () => {
      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      await service.sendEmail(options);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"hasteCRM" <noreply@haste.nyc>',
        to: "test@example.com",
        subject: "Test Subject",
        text: "",
        html: "<p>Test HTML</p>",
      });
    });

    it("should use custom from address from environment", async () => {
      process.env.SMTP_FROM = "custom@example.com";

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      await service.sendEmail(options);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: "custom@example.com",
        to: "test@example.com",
        subject: "Test Subject",
        text: "",
        html: "<p>Test HTML</p>",
      });

      delete process.env.SMTP_FROM;
    });

    it("should throw error when sendMail fails", async () => {
      const error = new Error("SMTP connection failed");
      mockSendMail.mockRejectedValueOnce(error);

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      const options = {
        to: "test@example.com",
        subject: "Test Subject",
        html: "<p>Test HTML</p>",
      };

      await expect(service.sendEmail(options)).rejects.toThrow(
        "SMTP connection failed",
      );

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error sending email:",
        error,
      );

      consoleErrorSpy.mockRestore();
    });
  });

  describe("sendVerificationEmail", () => {
    it("should send verification email with correct content", async () => {
      const email = "user@example.com";
      const verificationUrl = "https://example.com/verify?token=abc123";

      await service.sendVerificationEmail(email, verificationUrl);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"hasteCRM" <noreply@haste.nyc>',
        to: email,
        subject: "Verify your hasteCRM account",
        html: expect.stringContaining(verificationUrl),
        text: expect.stringContaining(verificationUrl),
      });

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain("Welcome to hasteCRM!");
      expect(call.html).toContain("Verify Your Email Address");
      expect(call.html).toContain("Verify Email");
      expect(call.html).toContain("This link will expire in 24 hours");
      expect(call.text).toContain("Welcome to hasteCRM!");
      expect(call.text).toContain("This link will expire in 24 hours");
    });

    it("should handle errors from sendEmail", async () => {
      const error = new Error("Failed to send");
      mockSendMail.mockRejectedValueOnce(error);

      await expect(
        service.sendVerificationEmail(
          "user@example.com",
          "https://example.com/verify",
        ),
      ).rejects.toThrow("Failed to send");
    });
  });

  describe("sendPasswordResetEmail", () => {
    it("should send password reset email with correct content", async () => {
      const email = "user@example.com";
      const resetUrl = "https://example.com/reset?token=xyz789";

      await service.sendPasswordResetEmail(email, resetUrl);

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"hasteCRM" <noreply@haste.nyc>',
        to: email,
        subject: "Reset your hasteCRM password",
        html: expect.stringContaining(resetUrl),
        text: expect.stringContaining(resetUrl),
      });

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain("Password Reset Request");
      expect(call.html).toContain("Reset Your Password");
      expect(call.html).toContain("Reset Password");
      expect(call.html).toContain("This link will expire in 1 hour");
      expect(call.text).toContain("Password Reset Request");
      expect(call.text).toContain("This link will expire in 1 hour");
    });

    it("should handle errors from sendEmail", async () => {
      const error = new Error("Failed to send");
      mockSendMail.mockRejectedValueOnce(error);

      await expect(
        service.sendPasswordResetEmail(
          "user@example.com",
          "https://example.com/reset",
        ),
      ).rejects.toThrow("Failed to send");
    });
  });

  describe("sendBulkEmails", () => {
    it("should send emails in batches of 10", async () => {
      const emails = Array.from({ length: 25 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: `Subject ${i}`,
        html: `<p>Content ${i}</p>`,
      }));

      await service.sendBulkEmails(emails);

      // Should be called 25 times (once for each email)
      expect(mockSendMail).toHaveBeenCalledTimes(25);

      // Check first batch
      for (let i = 0; i < 10; i++) {
        expect(mockSendMail).toHaveBeenCalledWith(
          expect.objectContaining({
            to: `user${i}@example.com`,
            subject: `Subject ${i}`,
            html: `<p>Content ${i}</p>`,
          }),
        );
      }
    });

    it("should handle batch with fewer than 10 emails", async () => {
      const emails = Array.from({ length: 5 }, (_, i) => ({
        to: `user${i}@example.com`,
        subject: `Subject ${i}`,
        html: `<p>Content ${i}</p>`,
      }));

      await service.sendBulkEmails(emails);

      expect(mockSendMail).toHaveBeenCalledTimes(5);
    });

    it("should handle empty array", async () => {
      await service.sendBulkEmails([]);

      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should continue sending if one email fails", async () => {
      const emails = [
        { to: "user1@example.com", subject: "Subject 1", html: "<p>1</p>" },
        { to: "user2@example.com", subject: "Subject 2", html: "<p>2</p>" },
        { to: "user3@example.com", subject: "Subject 3", html: "<p>3</p>" },
      ];

      // Fail the second email
      mockSendMail
        .mockResolvedValueOnce({ messageId: "1" })
        .mockRejectedValueOnce(new Error("Failed"))
        .mockResolvedValueOnce({ messageId: "3" });

      const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();

      // This will throw because one of the emails failed
      await expect(service.sendBulkEmails(emails)).rejects.toThrow("Failed");

      // But it should have attempted all emails in the batch
      expect(mockSendMail).toHaveBeenCalledTimes(3);

      consoleErrorSpy.mockRestore();
    });
  });

  describe("sendTemplatedEmail", () => {
    it("should replace template variables correctly", async () => {
      const template = [
        "<h1>Hello {{name}}</h1>",
        "<p>Your order {{orderId}} is {{status}}.</p>",
        "<p>Total: ${{total}}</p>",
      ].join("\n");

      const data = {
        name: "John Doe",
        orderId: "12345",
        status: "shipped",
        total: "99.99",
        subject: "Order Update",
      };

      await service.sendTemplatedEmail(template, data, "john@example.com");

      expect(mockSendMail).toHaveBeenCalledWith({
        from: '"hasteCRM" <noreply@haste.nyc>',
        to: "john@example.com",
        subject: "Order Update",
        html: expect.stringContaining("Hello John Doe"),
        text: expect.not.stringContaining("<h1>"),
      });

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain("Your order 12345 is shipped");
      expect(call.html).toContain("Total: $99.99");
      expect(call.text).toContain("Hello John Doe");
      expect(call.text).toContain("Your order 12345 is shipped");
    });

    it("should handle missing variables in template", async () => {
      const template = "Hello {{name}}, your code is {{code}}";
      const data = { name: "John", subject: "Test" };

      await service.sendTemplatedEmail(template, data, "john@example.com");

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain("Hello John");
      expect(call.html).toContain("{{code}}"); // Unreplaced variable
    });

    it("should use default subject if not provided", async () => {
      const template = "Hello {{name}}";
      const data = { name: "John" };

      await service.sendTemplatedEmail(template, data, "john@example.com");

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "hasteCRM Notification",
        }),
      );
    });

    it("should strip HTML tags from text version", async () => {
      const template = "<h1>Hello {{name}}</h1><p>Welcome!</p>";
      const data = { name: "John" };

      await service.sendTemplatedEmail(template, data, "john@example.com");

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toContain("<h1>Hello John</h1>");
      expect(call.text).toBe("Hello JohnWelcome!");
    });

    it("should handle complex templates with multiple occurrences", async () => {
      const template = "{{name}} - {{name}} - {{name}}";
      const data = { name: "Test" };

      await service.sendTemplatedEmail(template, data, "test@example.com");

      const call = mockSendMail.mock.calls[0][0];
      expect(call.html).toBe("Test - Test - Test");
    });
  });
});
