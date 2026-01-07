import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import * as bodyParser from 'body-parser';
import helmet from 'helmet';
import { csrf } from './csrf';

// Validate required secrets at startup
function validateSecrets() {
  const requiredSecrets = [
    { name: 'JWT_SECRET', minLength: 32 },
    { name: 'CSRF_SECRET', minLength: 32 },
    { name: 'STRIPE_SECRET_KEY', minLength: 10 },
    { name: 'STRIPE_WEBHOOK_SECRET', minLength: 10 },
  ];

  const errors: string[] = [];
  const isProduction = process.env.NODE_ENV === 'production';

  for (const { name, minLength } of requiredSecrets) {
    const value = process.env[name];
    if (!value) {
      errors.push(`Missing required environment variable: ${name}`);
    } else if (isProduction && value.length < minLength) {
      errors.push(`${name} must be at least ${minLength} characters in production`);
    }
  }

  if (errors.length > 0) {
    console.error('\n❌ Security Configuration Errors:');
    errors.forEach((err) => console.error(`   - ${err}`));
    if (isProduction) {
      throw new Error('Server startup aborted due to security configuration errors');
    } else {
      console.warn('\n⚠️  Continuing in development mode despite configuration warnings...\n');
    }
  }
}

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = (value ?? '').trim();
  if (!raw) return ['http://localhost:3000'];

  const origins = raw
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return origins.length ? origins : ['http://localhost:3000'];
}

function isUnsafeMethod(method?: string): boolean {
  const m = (method ?? '').toUpperCase();
  return m === 'POST' || m === 'PUT' || m === 'PATCH' || m === 'DELETE';
}

async function bootstrap() {
  // Validate secrets before starting
  validateSecrets();

  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  // Security headers
  const isProduction = process.env.NODE_ENV === 'production';
  app.use(
    helmet({
      contentSecurityPolicy: isProduction
        ? {
            directives: {
              defaultSrc: ["'self'"],
              scriptSrc: ["'self'"],
              styleSrc: ["'self'", "'unsafe-inline'"],
              imgSrc: ["'self'", 'data:', 'https:'],
              connectSrc: ["'self'", 'https://api.stripe.com'],
              frameSrc: ["'self'", 'https://js.stripe.com'],
              objectSrc: ["'none'"],
              upgradeInsecureRequests: [],
            },
          }
        : false,
    }),
  );

  // CSRF protection (per NestJS docs via `csrf-csrf`).
  // Enforced only when cookie-authenticated (access_token present) and method is unsafe.
  // Frontend must send: header `x-csrf-token` with the token returned by `generateCsrfToken()`.
  app.use(csrf.doubleCsrfProtection);

  const allowedOrigins = parseCorsOrigins(process.env.CORS_ORIGIN);
  if (allowedOrigins.includes('*')) {
    throw new Error('CORS_ORIGIN cannot include "*" when credentials are enabled');
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Allow non-browser tools (no Origin header)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'), false);
    },
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    exposedHeaders: ['x-csrf-token'],
  });

  app.use(
    bodyParser.json({
      verify: (req: any, res, buf) => {
        if (req.originalUrl.startsWith('/checkout/webhook')) {
          req.rawBody = buf;
        }
        return true;
      },
    }),
  );

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  await app.listen(process.env.PORT ?? 5000);
}
bootstrap();
