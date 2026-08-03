import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, map } from 'rxjs';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware {
  private readonly logger = new Logger('HttpRequest');

  use(
    req: Request & { requestId?: string },
    res: Response,
    next: NextFunction,
  ) {
    req.requestId =
      typeof req.headers['x-request-id'] === 'string'
        ? req.headers['x-request-id']
        : randomUUID();
    res.setHeader('x-request-id', req.requestId);
    const startedAt = performance.now();
    res.on('finish', () => {
      const authenticated = req as Request & {
        user?: { sub?: string };
        requestId?: string;
      };
      this.logger.log(
        JSON.stringify({
          method: req.method,
          path: req.path,
          status: res.statusCode,
          durationMs: Math.round(performance.now() - startedAt),
          requestId: req.requestId,
          userId: authenticated.user?.sub,
        }),
      );
    });
    next();
  }
}

@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(
    _context: ExecutionContext,
    next: CallHandler,
  ): Observable<unknown> {
    return next
      .handle()
      .pipe(map((data: unknown) => ({ success: true, data, meta: {} })));
  }
}

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { requestId?: string }>();
    const res = ctx.getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const response =
      exception instanceof HttpException ? exception.getResponse() : null;
    const details =
      typeof response === 'object' && response !== null && 'message' in response
        ? response.message
        : [];
    const responseCode =
      typeof response === 'object' && response !== null && 'code' in response
        ? String(response.code)
        : undefined;
    const message =
      typeof response === 'object' && response !== null && 'message' in response
        ? Array.isArray(response.message)
          ? 'ข้อมูลไม่ถูกต้อง'
          : String(response.message)
        : exception instanceof Error && status < 500
          ? exception.message
          : 'ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่';
    res.status(status).json({
      success: false,
      error: {
        code: responseCode ?? this.code(status),
        message,
        details: Array.isArray(details) ? details : [details],
      },
      requestId: req.requestId ?? randomUUID(),
    });
  }

  private code(status: number) {
    return (
      (
        {
          400: 'VALIDATION_ERROR',
          401: 'UNAUTHORIZED',
          403: 'FORBIDDEN',
          404: 'NOT_FOUND',
          409: 'CONFLICT',
          429: 'RATE_LIMITED',
        } as Record<number, string>
      )[status] ?? 'INTERNAL_SERVER_ERROR'
    );
  }
}
