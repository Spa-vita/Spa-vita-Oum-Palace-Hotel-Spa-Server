import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);
  const port = process.env.PORT ?? 3001;
  await app.listen(port, '0.0.0.0');
  console.log(`[Nest] API démarrée sur http://0.0.0.0:${port}`);
  console.log('[Nest] Routes réservations :');
  console.log(`  POST   http://localhost:${port}/reservations  (public)`);
  console.log(`  GET    http://localhost:${port}/reservations  (admin JWT)`);
  console.log(`  PATCH  http://localhost:${port}/reservations/:id  (admin JWT)`);
  console.log(
    `[Nest] ⚠ Pas de préfixe /api — le proxy Next doit appeler ${port}/reservations`,
  );
}
void bootstrap();
