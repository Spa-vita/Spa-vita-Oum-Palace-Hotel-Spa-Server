import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

export function configureApp(app: INestApplication): void {
  if (process.env.NODE_ENV === 'production') {
    (app as NestExpressApplication).set('trust proxy', 1);
  }
  app.use(helmet());
  const frontend = process.env.FRONTEND_ORIGIN;
  app.enableCors(
    frontend
      ? { origin: frontend.split(',').map((o) => o.trim()), credentials: true }
      : { origin: true, credentials: true },
  );
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
