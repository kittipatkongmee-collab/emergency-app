import {
  ArgumentsHost,
  CallHandler,
  Catch,
  ExceptionFilter,
  ExecutionContext,
  HttpException,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Observable, map } from 'rxjs';
import type { NextFunction, Request, Response } from 'express';

@Injectable()
export class RequestIdMiddleware {
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
    const message =
      typeof response === 'object' && response !== null && 'error' in response
        ? String(response.error)
        : exception instanceof Error && status < 500
          ? exception.message
          : 'ระบบไม่สามารถดำเนินการได้ กรุณาลองใหม่';
    res.status(status).json({
      success: false,
      error: {
        code: this.code(status),
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
      )[status] ?? 'INTERNAL_ERROR'
    );
  }
}
