import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class HealthService {
  constructor(private readonly db: DatabaseService) {}

  async getHealth() {
    try {
      await this.db.query('SELECT 1');
      let adminUsersTable: 'ok' | 'unavailable' = 'ok';
      let message =
        'Database reachable, table admin_users OK';
      try {
        await this.db.query('SELECT id FROM admin_users LIMIT 1');
      } catch {
        adminUsersTable = 'unavailable';
        message =
          'Database reachable — table admin_users missing or inaccessible (sql/supabase-admin-tables.sql)';
      }
      return {
        status: 'ok' as const,
        supabase: {
          connected: true,
          message,
          adminUsersTable,
        },
        checkedAt: new Date().toISOString(),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      return {
        status: 'degraded' as const,
        supabase: {
          connected: false,
          message,
        },
        checkedAt: new Date().toISOString(),
      };
    }
  }
}
