import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  const frontendOrigin =
    config.get<string>('FRONTEND_ORIGIN') ?? 'http://localhost:5290';
  app.enableCors({ origin: frontendOrigin, credentials: true });

  const port = Number(config.get<string>('PORT') ?? 3000);
  await app.listen(port);
  console.log(`football-gm backend listening on http://localhost:${port}`);
}

void bootstrap();
