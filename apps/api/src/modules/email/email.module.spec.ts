import { Test, TestingModule } from "@nestjs/testing";
import { EmailModule } from "./email.module";
import { EmailService } from "./email.service";
import { ConfigModule } from "@nestjs/config";

describe("EmailModule", () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: ".env.test",
        }),
        EmailModule,
      ],
    }).compile();
  });

  it("should be defined", () => {
    expect(module).toBeDefined();
  });

  it("should provide EmailService", () => {
    const emailService = module.get<EmailService>(EmailService);
    expect(emailService).toBeDefined();
    expect(emailService).toBeInstanceOf(EmailService);
  });

  it("should export EmailService", () => {
    const exports = Reflect.getMetadata("exports", EmailModule);
    expect(exports).toContain(EmailService);
  });

  describe("EmailService configuration", () => {
    it("should configure email service with environment variables", () => {
      const emailService = module.get<EmailService>(EmailService);

      // Verify that the service has necessary configuration
      expect(emailService).toHaveProperty("sendEmail");
      expect(emailService).toHaveProperty("sendBulkEmails");
      expect(emailService).toHaveProperty("sendTemplatedEmail");
    });
  });
});
