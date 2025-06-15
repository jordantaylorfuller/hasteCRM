import { Test } from "@nestjs/testing";
import { GmailModule } from "./gmail.module";

describe("GmailModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [GmailModule],
    }).compile();

    expect(module).toBeDefined();
  });
});
