import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import express from 'express';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './global-exception.filter';

async function bootstrap() {
  // Disable NestJS default body parser so we can set our own 5mb limit.
  // Required to support game state imports (full saves can exceed the default 100kb).
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Fail fast on missing or weak JWT_SECRET — prevents silent prod misconfig.
  const config = app.get(ConfigService);
  const jwtSecret = config.get<string>('JWT_SECRET');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'JWT_SECRET env var must be set and at least 32 characters long. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"',
    );
  }

  app.use(helmet());
  app.useGlobalFilters(new GlobalExceptionFilter());

  const frontendOrigin =
    config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5290';
  app.enableCors({ origin: frontendOrigin, credentials: true });

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  Logger.log(`football-gm backend listening on http://localhost:${port}`, 'Bootstrap');
}

void bootstrap();
