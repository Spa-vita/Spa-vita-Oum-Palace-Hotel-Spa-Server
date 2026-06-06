import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

export function configureApp(app: INestApplication): void {
  const expressApp = app as NestExpressApplication;
  if (process.env.NODE_ENV === 'production') {
    expressApp.set('trust proxy', 1);
  }
  expressApp.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const ms = Date.now() - start;
      console.log(
        `[HTTP] ${req.method} ${req.originalUrl} → ${res.statusCode} (${ms}ms)`,
      );
      if (req.originalUrl.startsWith('/api/')) {
        console.warn(
          `[HTTP] ⚠ Route /api/* introuvable sur Nest. Utiliser /reservations (sans /api).`,
        );
      }
    });
    next();
  });
  app.use(helmet());
  const deployedFrontend =
    'http://s88so40wkksskw8gcwggcokk.76.13.38.80.sslip.io';
  const fromEnv =
    process.env.FRONTEND_ORIGIN?.split(',').map((o) => o.trim()).filter(Boolean) ??
    [];
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd && fromEnv.length === 0) {
    app.enableCors({ origin: true, credentials: true });
  } else {
    const origins = [...new Set([deployedFrontend, ...fromEnv])];
    app.enableCors({ origin: origins, credentials: true });
  }
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
