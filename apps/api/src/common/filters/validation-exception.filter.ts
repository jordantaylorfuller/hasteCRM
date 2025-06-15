import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { GqlArgumentsHost, GqlContextType } from "@nestjs/graphql";
import { ValidationError } from "class-validator";

@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const contextType = host.getType<GqlContextType>();
    const response = exception.getResponse() as any;

    // Check if this is a validation error
    if (!response.message || !Array.isArray(response.message)) {
      // Not a validation error, pass through
      throw exception;
    }

    const validationErrors = this.formatValidationErrors(response.message);

    if (contextType === "graphql") {
      return this.handleGraphQLValidation(validationErrors, host);
    }

    return this.handleHttpValidation(validationErrors, host);
  }

  private handleHttpValidation(errors: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const errorResponse = {
      statusCode: 400,
      error: "Validation Failed",
      message: "The request contains invalid data",
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: request.id,
      errors,
    };

    this.logger.warn(`Validation Error: ${JSON.stringify(errorResponse)}`);

    response.status(400).json(errorResponse);
  }

  private handleGraphQLValidation(errors: any, host: ArgumentsHost) {
    const gqlHost = GqlArgumentsHost.create(host);
    const context = gqlHost.getContext();
    const info = gqlHost.getInfo();

    const errorDetails = {
      statusCode: 400,
      error: "Validation Failed",
      message: "The request contains invalid data",
      timestamp: new Date().toISOString(),
      path: info.path?.key,
      requestId: context.req?.id,
      errors,
    };

    this.logger.warn(
      `GraphQL Validation Error: ${JSON.stringify(errorDetails)}`,
    );

    // Create a new BadRequestException with formatted errors
    throw new BadRequestException({
      message: "Validation failed",
      errors,
    });
  }

  private formatValidationErrors(errors: string[] | ValidationError[]): any {
    const formatted: Record<string, string[]> = {};

    errors.forEach((error) => {
      if (typeof error === "string") {
        // Simple string error
        if (!formatted.general) {
          formatted.general = [];
        }
        formatted.general.push(error);
      } else if (error.constraints) {
        // ValidationError from class-validator
        const field = error.property;
        if (!formatted[field]) {
          formatted[field] = [];
        }
        formatted[field].push(...Object.values(error.constraints));
      }
    });

    return formatted;
  }
}
