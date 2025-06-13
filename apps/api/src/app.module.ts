import { Module } from "@nestjs/common";
import { GraphQLModule } from "@nestjs/graphql";
import { ApolloDriver, ApolloDriverConfig } from "@nestjs/apollo";
import { join } from "path";
import { PrismaModule } from "./modules/prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { HealthModule } from "./modules/health/health.module";
import { RedisModule } from "./modules/redis/redis.module";
import { EmailModule } from "./modules/email/email.module";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { CompaniesModule } from "./modules/companies/companies.module";
import { ImportExportModule } from "./modules/import-export/import-export.module";

@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), "apps/api/src/schema.gql"),
      sortSchema: true,
      playground: process.env.NODE_ENV !== "production",
      introspection: true,
      buildSchemaOptions: {
        numberScalarMode: "integer",
      },
      context: ({ req, res }) => {
        // Ensure req has necessary Passport methods for GraphQL
        if (req) {
          req.login =
            req.login ||
            (() => {
              return undefined;
            });
          req.logIn = req.logIn || req.login;
          req.logout =
            req.logout ||
            (() => {
              return undefined;
            });
          req.logOut = req.logOut || req.logout;
          req.isAuthenticated = req.isAuthenticated || (() => !!req.user);
        }
        return { req, res };
      },
    }),
    PrismaModule,
    RedisModule,
    EmailModule,
    AuthModule,
    HealthModule,
    ContactsModule,
    CompaniesModule,
    ImportExportModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
