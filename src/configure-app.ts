import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export function configureApp(app: INestApplication): void {
  if (process.env.NODE_ENV === 'production') {
    (app as NestExpressApplication).set('trust proxy', 1);
  }
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
