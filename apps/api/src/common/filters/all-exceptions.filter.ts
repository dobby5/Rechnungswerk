import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { randomUUID } from 'node:crypto';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request & { requestId?: string }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const payload = exception instanceof HttpException ? exception.getResponse() : null;
    const record = typeof payload === 'object' && payload !== null ? payload as Record<string, unknown> : {};
    const rawMessage = record.message ?? (typeof payload === 'string' ? payload : 'Interner Serverfehler');
    const details = Array.isArray(rawMessage) ? rawMessage : undefined;
    const message = Array.isArray(rawMessage) ? 'Validierung fehlgeschlagen' : String(rawMessage);
    response.status(status).json({
      statusCode: status,
      code: typeof record.error === 'string' ? record.error.toUpperCase().replaceAll(' ', '_') : `HTTP_${status}`,
      message,
      ...(details ? { details } : {}),
      requestId: request.requestId ?? randomUUID(),
      timestamp: new Date().toISOString(),
    });
  }
}
