import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { tap } from "rxjs/operators";
import { GqlExecutionContext, GqlContextType } from "@nestjs/graphql";

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP");

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const start = Date.now();
    const contextType = context.getType<GqlContextType>();

    if (contextType === "graphql") {
      return this.handleGraphQL(context, next, start);
    }

    return this.handleHttp(context, next, start);
  }

  private handleHttp(
    context: ExecutionContext,
    next: CallHandler,
    start: number,
  ): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    const { method, url, ip } = request;
    const userAgent = request.get("user-agent") || "";

    return next.handle().pipe(
      tap({
        next: () => {
          const { statusCode } = response;
          const duration = Date.now() - start;

          this.logger.log(
            `${method} ${url} ${statusCode} ${duration}ms - ${userAgent} ${ip}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          const statusCode = error.status || 500;

          this.logger.error(
            `${method} ${url} ${statusCode} ${duration}ms - ${userAgent} ${ip}`,
          );
        },
      }),
    );
  }

  private handleGraphQL(
    context: ExecutionContext,
    next: CallHandler,
    start: number,
  ): Observable<any> {
    const gqlContext = GqlExecutionContext.create(context);
    const info = gqlContext.getInfo();
    const ctx = gqlContext.getContext();
    const request = ctx.req;

    const operation = `${info.parentType.name}.${info.fieldName}`;
    const ip = request?.ip || "unknown";
    const userAgent = request?.get("user-agent") || "";

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;

          this.logger.log(
            `GraphQL ${operation} 200 ${duration}ms - ${userAgent} ${ip}`,
          );
        },
        error: (error) => {
          const duration = Date.now() - start;
          const statusCode = error.status || 500;

          this.logger.error(
            `GraphQL ${operation} ${statusCode} ${duration}ms - ${userAgent} ${ip}`,
          );
        },
      }),
    );
  }
}
