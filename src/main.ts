import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] API démarrée sur http://0.0.0.0:${port}`);
  console.log('[Nest] Routes réservations :');
  console.log(`  POST   http://localhost:${port}/reservations  (public)`);
  console.log(`  GET    http://localhost:${port}/reservations  (admin JWT)`);
  console.log(`  PATCH  http://localhost:${port}/reservations/:id  (admin JWT)`);
  console.log('[Nest] Routes chambres :');
  console.log(`  GET    http://localhost:${port}/rooms  (public, isActive)`);
  console.log(`  GET    http://localhost:${port}/admin/rooms  (admin JWT)`);
  console.log(`  GET    http://localhost:${port}/admin/rooms/:id  (admin JWT)`);
  console.log(`  PUT    http://localhost:${port}/admin/rooms/:id  (admin JWT)`);
  console.log(`  POST   http://localhost:${port}/admin/rooms/:id/image  (admin JWT)`);
  console.log('[Nest] Routes paiement CMI :');
  console.log(`  POST   http://localhost:${port}/payments/cmi/initiate  (public)`);
  console.log(`  POST   http://localhost:${port}/payments/cmi/callback  (CMI)`);
  console.log(`  GET    http://localhost:${port}/payments/cmi/success`);
  console.log(`  GET    http://localhost:${port}/payments/cmi/fail`);
  console.log(
    `[Nest] Proxy Next : /api/* → http://localhost:${port}/* (sans préfixe /api)`,
  );
}
void bootstrap();
