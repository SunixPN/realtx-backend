import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const status = this.resolveStatus(exception);
    const message = this.resolveMessage(exception);

    // Стек только для непойманных 500-х — валидация/404 не спамят логи
    if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      success: false,
      error: {
        statusCode: status,
        message: Array.isArray(message) ? message : [message],
        timestamp: new Date().toISOString(),
        path: request.url,
      },
    });
  }

  private resolveStatus(exception: unknown): number {
    if (exception instanceof HttpException) return exception.getStatus();
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolveMessage(exception: unknown): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') return response;
      if (typeof response === 'object' && response !== null) {
        const msg = (response as { message?: string | string[] }).message;
        if (msg) return msg;
      }
      return exception.message;
    }

    if (exception instanceof Error) return exception.message;
    return 'Внутренняя ошибка сервера';
  }
}
