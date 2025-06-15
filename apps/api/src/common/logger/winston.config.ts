import * as winston from "winston";
import "winston-daily-rotate-file";

const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

// Configure transports
const transports: winston.transport[] = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple(),
    ),
  }),
];

// Add file transport in production
if (process.env.NODE_ENV === "production") {
  // Rotate logs daily
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: "logs/api-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      format: logFormat,
    }),
  );

  // Error logs
  transports.push(
    new winston.transports.DailyRotateFile({
      filename: "logs/api-error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      zippedArchive: true,
      maxSize: "20m",
      maxFiles: "14d",
      level: "error",
      format: logFormat,
    }),
  );
}

// Create logger instance
export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: logFormat,
  transports,
  defaultMeta: {
    service: "haste-api",
    environment: process.env.NODE_ENV,
  },
});

// Log unhandled exceptions and rejections
logger.exceptions.handle(
  new winston.transports.File({ filename: "logs/exceptions.log" }),
);

logger.rejections.handle(
  new winston.transports.File({ filename: "logs/rejections.log" }),
);

// Helper function to log GraphQL operations
export function logGraphQLOperation(
  operationName: string,
  operationType: string,
  variables: any,
  userId?: string,
  duration?: number,
  error?: any,
) {
  const logData = {
    operationName,
    operationType,
    variables,
    userId,
    duration,
    timestamp: new Date().toISOString(),
  };

  if (error) {
    logger.error("GraphQL operation failed", {
      ...logData,
      error: error.message,
      stack: error.stack,
    });
  } else {
    logger.info("GraphQL operation completed", logData);
  }
}

// Helper function to log HTTP requests
export function logHttpRequest(
  method: string,
  url: string,
  statusCode: number,
  duration: number,
  ip?: string,
  userId?: string,
  error?: any,
) {
  const logData = {
    request: {
      method,
      url,
      ip,
      userId,
    },
    response: {
      statusCode,
      duration,
    },
    timestamp: new Date().toISOString(),
  };

  if (error || statusCode >= 400) {
    logger.error("HTTP request failed", {
      ...logData,
      error: error?.message,
      stack: error?.stack,
    });
  } else {
    logger.info("HTTP request completed", logData);
  }
}
