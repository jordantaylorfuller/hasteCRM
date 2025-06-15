import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable, throwError } from "rxjs";
import { catchError } from "rxjs/operators";
import { GqlExecutionContext } from "@nestjs/graphql";

@Injectable()
export class ErrorLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("ErrorInterceptor");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const contextType = context.getType();

    return next.handle().pipe(
      catchError((error) => {
        const duration = Date.now() - start;
        const errorContext = this.getErrorContext(context, contextType);

        this.logger.error(`Error occurred after ${duration}ms`, {
          ...errorContext,
          error: error.message,
          stack: error.stack,
          duration,
        });

        return throwError(() => error);
      }),
    );
  }

  private getErrorContext(context: ExecutionContext, contextType: string) {
    if (contextType === "graphql") {
      const gqlContext = GqlExecutionContext.create(context);
      const info = gqlContext.getInfo();
      const args = gqlContext.getArgs();
      const ctx = gqlContext.getContext();

      return {
        type: "graphql",
        fieldName: info.fieldName,
        parentType: info.parentType.name,
        args: this.sanitizeArgs(args),
        userId: ctx.req?.user?.id,
        requestId: ctx.req?.id,
      };
    } else if (contextType === "http") {
      const request = context.switchToHttp().getRequest();

      return {
        type: "http",
        method: request.method,
        url: request.url,
        params: request.params,
        query: request.query,
        body: this.sanitizeBody(request.body),
        userId: request.user?.id,
        ip: request.ip,
        userAgent: request.get("user-agent"),
        requestId: request.id,
      };
    }

    return { type: contextType };
  }

  private sanitizeArgs(args: any): any {
    if (!args || typeof args !== "object") return args;

    const sensitiveFields = [
      "password",
      "refreshToken",
      "accessToken",
      "totpSecret",
      "creditCard",
    ];

    const sanitize = (obj: any): any => {
      if (Array.isArray(obj)) {
        return obj.map((item) => sanitize(item));
      }

      if (obj && typeof obj === "object") {
        const sanitized: any = {};
        for (const [key, value] of Object.entries(obj)) {
          if (!sensitiveFields.includes(key)) {
            sanitized[key] = sanitize(value);
          }
        }
        return sanitized;
      }

      return obj;
    };

    return sanitize(args);
  }

  private sanitizeBody(body: any): any {
    return this.sanitizeArgs(body);
  }
}
