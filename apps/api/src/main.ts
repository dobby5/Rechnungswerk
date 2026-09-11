import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { randomUUID } from 'node:crypto';
import { Request, Response, NextFunction } from 'express';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

declare global { interface BigInt { toJSON(): string } }

async function bootstrap(): Promise<void> {
  BigInt.prototype.toJSON = function toJSON(): string { return this.toString(); };
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  app.setGlobalPrefix('api/v1');
  app.enableShutdownHooks();
  app.use((request: Request & { requestId?: string }, response: Response, next: NextFunction) => {
    request.requestId = request.header('x-request-id')?.slice(0, 80) || randomUUID();
    response.setHeader('x-request-id', request.requestId);
    next();
  });
  app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.use(compression());
  app.use(cookieParser());
  app.enableCors({ origin: config.getOrThrow<string>('APP_ORIGIN'), credentials: true, methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, stopAtFirstError: false }));
  app.useGlobalFilters(new AllExceptionsFilter());
  await app.listen(config.get<number>('PORT', 3000), '0.0.0.0');
}

void bootstrap();
