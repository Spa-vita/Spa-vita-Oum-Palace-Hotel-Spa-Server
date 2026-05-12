import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/configure-app';
import { SupabaseService } from './../src/supabase/supabase.service';

function createMockSupabaseClient() {
  const empty = { data: null, error: null };
  return {
    from() {
      return {
        select(_sel?: string, opts?: { count?: string; head?: boolean }) {
          if (opts?.head && opts?.count === 'exact') {
            return Promise.resolve({ count: 0, error: null });
          }
          return {
            eq() {
              return {
                maybeSingle: () => Promise.resolve(empty),
                single: () => Promise.resolve(empty),
              };
            },
          };
        },
        insert() {
          return Promise.resolve({ error: null });
        },
        delete() {
          return {
            eq: () => Promise.resolve(empty),
            lt: () => Promise.resolve(empty),
          };
        },
      };
    },
  };
}

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(SupabaseService)
      .useValue({
        getClient: () => createMockSupabaseClient(),
        getConnectionStatus: () =>
          Promise.resolve({
            connected: true,
            message: 'e2e mock',
            adminUsersTable: 'ok' as const,
          }),
      })
      .compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });
});
