import { Test } from "@nestjs/testing";
import { ConfigModule } from "@nestjs/config";
import { AiModule } from "./ai.module";

describe("AiModule", () => {
  it("should compile the module", async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
        }),
        AiModule,
      ],
    }).compile();

    expect(module).toBeDefined();
  });
});
