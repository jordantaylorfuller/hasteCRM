import { Injectable, LoggerService } from "@nestjs/common";
import { logger } from "./winston.config";

@Injectable()
export class CustomLoggerService implements LoggerService {
  log(message: any, context?: string) {
    logger.info(message, { context });
  }

  error(message: any, trace?: string, context?: string) {
    logger.error(message, { trace, context });
  }

  warn(message: any, context?: string) {
    logger.warn(message, { context });
  }

  debug(message: any, context?: string) {
    logger.debug(message, { context });
  }

  verbose(message: any, context?: string) {
    logger.verbose(message, { context });
  }

  // Custom methods for structured logging
  logRequest(req: any, res: any, next: () => void) {
    const start = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - start;
      const { method, url, ip, headers } = req;
      const { statusCode } = res;
      const userId = req.user?.id;

      logger.info("HTTP Request", {
        request: {
          method,
          url,
          ip: ip || req.connection.remoteAddress,
          userAgent: headers["user-agent"],
          userId,
        },
        response: {
          statusCode,
          duration,
        },
      });
    });

    next();
  }

  logGraphQL(
    operationName: string,
    operationType: string,
    variables: any,
    context: any,
    duration?: number,
    error?: any,
  ) {
    const userId = context.req?.user?.id;

    const logData = {
      graphql: {
        operationName,
        operationType,
        variables: this.sanitizeVariables(variables),
        userId,
        duration,
      },
    };

    if (error) {
      logger.error("GraphQL Error", {
        ...logData,
        error: {
          message: error.message,
          extensions: error.extensions,
          stack: error.stack,
        },
      });
    } else {
      logger.info("GraphQL Operation", logData);
    }
  }

  logDatabaseQuery(
    query: string,
    params: any[],
    duration: number,
    error?: any,
  ) {
    const logData = {
      database: {
        query: this.sanitizeQuery(query),
        params: this.sanitizeParams(params),
        duration,
      },
    };

    if (error) {
      logger.error("Database Error", {
        ...logData,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack,
        },
      });
    } else if (duration > 1000) {
      logger.warn("Slow Database Query", logData);
    } else {
      logger.debug("Database Query", logData);
    }
  }

  logEmailEvent(event: string, email: any, error?: any) {
    const logData = {
      email: {
        event,
        messageId: email.messageId,
        threadId: email.threadId,
        subject: email.subject,
        from: email.from,
        to: email.to,
      },
    };

    if (error) {
      logger.error("Email Error", {
        ...logData,
        error: {
          message: error.message,
          code: error.code,
          stack: error.stack,
        },
      });
    } else {
      logger.info("Email Event", logData);
    }
  }

  logAIOperation(
    operation: string,
    input: any,
    output: any,
    duration: number,
    error?: any,
  ) {
    const logData = {
      ai: {
        operation,
        inputLength: JSON.stringify(input).length,
        outputLength: output ? JSON.stringify(output).length : 0,
        duration,
      },
    };

    if (error) {
      logger.error("AI Error", {
        ...logData,
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    } else {
      logger.info("AI Operation", logData);
    }
  }

  logSecurityEvent(event: string, userId: string, details: any) {
    logger.warn("Security Event", {
      security: {
        event,
        userId,
        details,
        timestamp: new Date().toISOString(),
      },
    });
  }

  private sanitizeVariables(variables: any): any {
    if (!variables) return {};

    const sanitized = { ...variables };
    const sensitiveFields = ["password", "token", "secret", "apiKey"];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = "[REDACTED]";
      }
    }

    return sanitized;
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from queries
    return query.replace(/password\s*=\s*'[^']*'/gi, "password='[REDACTED]'");
  }

  private sanitizeParams(params: any[]): any[] {
    return params.map((param) => {
      if (typeof param === "string" && param.length > 100) {
        return "[TRUNCATED]";
      }
      return param;
    });
  }
}
