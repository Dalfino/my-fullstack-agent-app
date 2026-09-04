import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.setGlobalPrefix('api/v1');
  const allowedOrigins = (config.get<string>('CORS_ORIGIN', 'http://localhost:3000') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.enableCors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : ['http://localhost:3000'],
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Phase 3: OpenAPI / Swagger documentation at /api/v1/docs
  const swaggerConfig = new DocumentBuilder()
    .setTitle('TalentShowcase API')
    .setDescription(
      'Enterprise internal talent showcase & AI-powered review platform. ' +
        'Agents: Explain, Code Analyst, Security Scanner, Evaluation, Career Advisor.',
    )
    .setVersion('2.0')
    .addBearerAuth()
    .addTag('auth', 'Authentication & MFA')
    .addTag('projects', 'Project lifecycle & status transitions')
    .addTag('ai', 'AI agent reports (async via queue)')
    .addTag('admin', 'Admin dashboards, audit log & user management')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = config.get<number>('PORT', 4000);
  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/api/v1`, 'Bootstrap');
  Logger.log(`Swagger docs at http://localhost:${port}/docs`, 'Bootstrap');
}

bootstrap();
