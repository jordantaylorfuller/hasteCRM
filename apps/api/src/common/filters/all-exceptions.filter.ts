import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { GqlArgumentsHost, GqlContextType } from "@nestjs/graphql";
import { GraphQLError } from "graphql";

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  path?: string;
  timestamp: string;
  requestId?: string;
  stack?: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const contextType = host.getType<GqlContextType>();

    if (contextType === "graphql") {
      return this.handleGraphQLException(exception, host);
    }

    return this.handleHttpException(exception, host);
  }

  private handleHttpException(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const { status, error } = this.getErrorInfo(exception);
    const errorResponse = this.buildErrorResponse(
      exception,
      status,
      request.url,
      request.id,
    );

    this.logError(exception, errorResponse, request);

    response.status(status).json(errorResponse);
  }

  private handleGraphQLException(exception: unknown, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const context = gqlHost.getContext();
    const info = gqlHost.getInfo();

    const { status, error } = this.getErrorInfo(exception);
    const errorResponse = this.buildErrorResponse(
      exception,
      status,
      info.path?.key,
      context.req?.id,
    );

    this.logError(exception, errorResponse, context.req);

    // For GraphQL, throw a GraphQLError with extensions
    const code = exception instanceof HttpException ? exception.name : error;
    throw new GraphQLError(errorResponse.message.toString(), {
      extensions: {
        code,
        statusCode: status,
        timestamp: errorResponse.timestamp,
        requestId: errorResponse.requestId,
      },
    });
  }

  private getErrorInfo(exception: unknown): { status: number; error: string } {
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = "Internal Server Error";

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const response = exception.getResponse();
      error =
        typeof response === "string"
          ? response
          : (response as any).error || exception.name;
    } else if (exception instanceof Error) {
      // Handle Prisma errors
      if (exception.name === "PrismaClientKnownRequestError") {
        const prismaError = exception as any;
        switch (prismaError.code) {
          case "P2002":
            status = HttpStatus.CONFLICT;
            error = "Unique constraint violation";
            break;
          case "P2025":
            status = HttpStatus.NOT_FOUND;
            error = "Record not found";
            break;
          default:
            error = "Database error";
        }
      }
      // Handle validation errors
      else if (exception.name === "ValidationError") {
        status = HttpStatus.BAD_REQUEST;
        error = "Validation Error";
      }
    }

    return { status, error };
  }

  private buildErrorResponse(
    exception: unknown,
    status: number,
    path?: string,
    requestId?: string,
  ): ErrorResponse {
    const isDevelopment = process.env.NODE_ENV === "development";
    const timestamp = new Date().toISOString();

    let message: string | string[] = "An unexpected error occurred";
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      message =
        typeof response === "string"
          ? response
          : (response as any).message || exception.message;
    } else if (exception instanceof Error) {
      message = exception.message;
      if (isDevelopment) {
        stack = exception.stack;
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      timestamp,
    };

    if (path) errorResponse.path = path;
    if (requestId) errorResponse.requestId = requestId;
    if (stack) errorResponse.stack = stack;
    if (status !== HttpStatus.INTERNAL_SERVER_ERROR) {
      errorResponse.error = this.getErrorInfo(exception).error;
    }

    return errorResponse;
  }

  private logError(
    exception: unknown,
    errorResponse: ErrorResponse,
    request?: any,
  ) {
    const logContext = {
      statusCode: errorResponse.statusCode,
      path: errorResponse.path,
      requestId: errorResponse.requestId,
      userId: request?.user?.id,
      method: request?.method,
      ip: request?.ip,
      userAgent: request?.get?.("user-agent"),
    };

    if (errorResponse.statusCode >= 500) {
      this.logger.error(
        `Unhandled exception: ${errorResponse.message}`,
        exception instanceof Error ? exception.stack : undefined,
        logContext,
      );
    } else {
      this.logger.warn(`Client error: ${errorResponse.message}`, logContext);
    }
  }
}
