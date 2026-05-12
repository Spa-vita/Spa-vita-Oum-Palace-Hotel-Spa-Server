import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';



@Injectable()
export class HealthService {
  constructor(private readonly supabase: SupabaseService) {}

  async getHealth() {
    const supabase = await this.supabase.getConnectionStatus();
    return {
      status: supabase.connected ? 'ok' : 'degraded',
      supabase: {
        connected: supabase.connected,
        message: supabase.message,
        adminUsersTable: supabase.adminUsersTable,
      },
      checkedAt: new Date().toISOString(),
    };
  }
}
