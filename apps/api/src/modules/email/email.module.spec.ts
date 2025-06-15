import { Test } from "@nestjs/testing";
import { EmailModule } from "./email.module";
import { EmailService } from "./email.service";

describe("EmailModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [EmailModule],
    }).compile();

    expect(module).toBeDefined();
    expect(module.get(EmailService)).toBeDefined();
  });
});
