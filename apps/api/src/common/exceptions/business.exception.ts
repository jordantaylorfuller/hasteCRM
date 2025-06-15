import { HttpException, HttpStatus } from "@nestjs/common";

export enum BusinessErrorCode {
  // Authentication & Authorization
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  EMAIL_NOT_VERIFIED = "EMAIL_NOT_VERIFIED",
  TWO_FACTOR_REQUIRED = "TWO_FACTOR_REQUIRED",
  INVALID_TWO_FACTOR_CODE = "INVALID_TWO_FACTOR_CODE",

  // Workspace
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  WORKSPACE_LIMIT_REACHED = "WORKSPACE_LIMIT_REACHED",
  USER_NOT_IN_WORKSPACE = "USER_NOT_IN_WORKSPACE",

  // Contacts & Companies
  CONTACT_NOT_FOUND = "CONTACT_NOT_FOUND",
  COMPANY_NOT_FOUND = "COMPANY_NOT_FOUND",
  DUPLICATE_CONTACT = "DUPLICATE_CONTACT",
  INVALID_IMPORT_FORMAT = "INVALID_IMPORT_FORMAT",

  // Pipeline & Deals
  PIPELINE_NOT_FOUND = "PIPELINE_NOT_FOUND",
  STAGE_NOT_FOUND = "STAGE_NOT_FOUND",
  DEAL_NOT_FOUND = "DEAL_NOT_FOUND",
  INVALID_STAGE_TRANSITION = "INVALID_STAGE_TRANSITION",
  DEAL_ALREADY_CLOSED = "DEAL_ALREADY_CLOSED",

  // Gmail Integration
  GMAIL_NOT_CONNECTED = "GMAIL_NOT_CONNECTED",
  GMAIL_TOKEN_EXPIRED = "GMAIL_TOKEN_EXPIRED",
  GMAIL_SYNC_FAILED = "GMAIL_SYNC_FAILED",
  EMAIL_SEND_FAILED = "EMAIL_SEND_FAILED",

  // AI Features
  AI_SERVICE_UNAVAILABLE = "AI_SERVICE_UNAVAILABLE",
  AI_QUOTA_EXCEEDED = "AI_QUOTA_EXCEEDED",
  AI_PROCESSING_FAILED = "AI_PROCESSING_FAILED",

  // General
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",
  RESOURCE_ALREADY_EXISTS = "RESOURCE_ALREADY_EXISTS",
  INVALID_INPUT = "INVALID_INPUT",
  OPERATION_NOT_ALLOWED = "OPERATION_NOT_ALLOWED",
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED",
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",
}

export interface BusinessErrorDetails {
  code: BusinessErrorCode;
  message: string;
  details?: any;
  userMessage?: string;
}

export class BusinessException extends HttpException {
  constructor(
    private readonly errorDetails: BusinessErrorDetails,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super(
      {
        statusCode: status,
        error: errorDetails.code,
        message: errorDetails.message,
        userMessage: errorDetails.userMessage || errorDetails.message,
        details: errorDetails.details,
        timestamp: new Date().toISOString(),
      },
      status,
    );
  }

  getErrorCode(): BusinessErrorCode {
    return this.errorDetails.code;
  }

  getErrorDetails(): BusinessErrorDetails {
    return this.errorDetails;
  }
}

// Convenience factory functions
export class BusinessExceptions {
  static invalidCredentials(): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.INVALID_CREDENTIALS,
        message: "Invalid email or password",
        userMessage: "The email or password you entered is incorrect.",
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  static sessionExpired(): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.SESSION_EXPIRED,
        message: "Session has expired",
        userMessage: "Your session has expired. Please log in again.",
      },
      HttpStatus.UNAUTHORIZED,
    );
  }

  static insufficientPermissions(): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.INSUFFICIENT_PERMISSIONS,
        message: "Insufficient permissions",
        userMessage: "You do not have permission to perform this action.",
      },
      HttpStatus.FORBIDDEN,
    );
  }

  static resourceNotFound(resource: string, id?: string): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.RESOURCE_NOT_FOUND,
        message: `${resource} not found`,
        userMessage: `The requested ${resource.toLowerCase()} could not be found.`,
        details: { resource, id },
      },
      HttpStatus.NOT_FOUND,
    );
  }

  static duplicateResource(
    resource: string,
    field?: string,
  ): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.RESOURCE_ALREADY_EXISTS,
        message: `${resource} already exists`,
        userMessage: `A ${resource.toLowerCase()} with this ${field || "information"} already exists.`,
        details: { resource, field },
      },
      HttpStatus.CONFLICT,
    );
  }

  static rateLimitExceeded(limit: number, window: string): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.RATE_LIMIT_EXCEEDED,
        message: "Rate limit exceeded",
        userMessage: `You've made too many requests. Please wait ${window} before trying again.`,
        details: { limit, window },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  static serviceUnavailable(service: string): BusinessException {
    return new BusinessException(
      {
        code: BusinessErrorCode.SERVICE_UNAVAILABLE,
        message: `${service} service is unavailable`,
        userMessage:
          "The service is temporarily unavailable. Please try again later.",
        details: { service },
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
