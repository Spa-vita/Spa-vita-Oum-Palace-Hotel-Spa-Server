import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, QueryResultRow } from 'pg';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(private readonly config: ConfigService) {
    const connectionString = this.config.getOrThrow<string>('DATABASE_URL').trim();
    // Do not force SSL — suitable for an internal private network.
    this.pool = new Pool({
      connectionString,
      ssl: false,
    });
  }

  async query<T extends QueryResultRow = QueryResultRow>(
    text: string,
    params?: any[],
  ): Promise<{ rows: T[] }> {
    const result = await this.pool.query<T>(text, params);
    return { rows: result.rows };
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
