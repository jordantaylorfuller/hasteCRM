import { NestFactory } from "@nestjs/core";
import { ValidationPipe, Logger, BadRequestException } from "@nestjs/common";
import { AppModule } from "./app.module";
import * as dotenv from "dotenv";
import * as path from "path";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter";
import { ValidationExceptionFilter } from "./common/filters/validation-exception.filter";
import { ErrorLoggingInterceptor } from "./common/interceptors/error-logging.interceptor";
import compression from "compression";
import helmet from "helmet";

// Load environment variables from the root .env file
dotenv.config({ path: path.join(__dirname, "../../../.env") });

// Fix BigInt serialization
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

async function bootstrap() {
  const logger = new Logger("Bootstrap");

  const app = await NestFactory.create(AppModule, {
    logger: ["error", "warn", "log", "debug", "verbose"],
  });

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy:
        process.env.NODE_ENV === "production" ? undefined : false,
      crossOriginEmbedderPolicy: false,
    }),
  );
  app.use(compression());

  // Enable CORS with proper configuration
  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(",") || true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Request-ID"],
  });

  // Add request ID middleware
  app.use((req: any, res: any, next: () => void) => {
    req.id =
      req.headers["x-request-id"] ||
      `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    res.setHeader("X-Request-ID", req.id);
    next();
  });

  // Global exception filters (order matters - most specific first)
  app.useGlobalFilters(
    new ValidationExceptionFilter(),
    new HttpExceptionFilter(),
    new AllExceptionsFilter(),
  );

  // Global interceptors
  app.useGlobalInterceptors(new ErrorLoggingInterceptor());

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      exceptionFactory: (errors) => {
        return new BadRequestException(errors);
      },
    }),
  );

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = process.env.PORT || 4000;
  await app.listen(port);

  logger.log(`🚀 API running on http://localhost:${port}`);
  logger.log(`📝 GraphQL playground: http://localhost:${port}/graphql`);
  logger.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Only bootstrap if not in test mode or being imported
if (require.main === module) {
  bootstrap();
}

// Export for testing
export { bootstrap };
