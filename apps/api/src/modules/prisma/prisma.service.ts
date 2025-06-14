import { Injectable, OnModuleDestroy, OnModuleInit, INestApplication } from "@nestjs/common";
import { PrismaClient } from "./prisma-client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({
      log: ["query", "info", "warn", "error"],
    });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }

  async enableShutdownHooks(app: INestApplication) {
    this.$on('beforeExit' as never, async () => {
      await app.close();
    });
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV === "production") {
      throw new Error("cleanDatabase is not allowed in production");
    }

    const models = Reflect.ownKeys(this).filter(
      (key) => typeof key === "string" && key[0] !== "_" && key[0] !== "$",
    ) as string[];

    return Promise.all(
      models
        .map((modelKey) => {
          return (this as any)[modelKey]?.deleteMany?.();
        })
        .filter(Boolean),
    );
  }
}
