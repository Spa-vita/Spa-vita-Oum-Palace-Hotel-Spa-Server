import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client!: ReturnType<typeof createClient>;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const url = this.resolveUrl();
    const key = this.resolveKey();
    this.client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const usingAnon = !this.config
      .get<string>('SUPABASE_SERVICE_ROLE_KEY')
      ?.trim();
    if (usingAnon) {
      console.warn(
        '[Supabase] Attention : clé publishable / anon détectée. Pour le backend Nest, préférez SUPABASE_SERVICE_ROLE_KEY (Dashboard → Settings → API), sinon RLS peut bloquer les écritures.',
      );
    }
    void this.logStartupConnection();
  }

  getClient(): ReturnType<typeof createClient> {
    return this.client;
  }

  /** Ping PostgREST + optional lecture de admin_users */
  async getConnectionStatus(): Promise<{
    connected: boolean;
    message: string;
    adminUsersTable?: 'ok' | 'unavailable';
  }> {
    const url = this.resolveUrl().replace(/\/$/, '');
    const key = this.resolveKey();
    try {
      const res = await fetch(`${url}/rest/v1/`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      });
      if (res.status === 401) {
        return {
          connected: false,
          message: 'Clé API refusée (401) — vérifiez SUPABASE_SERVICE_ROLE_KEY',
        };
      }
      if (!res.ok) {
        return {
          connected: false,
          message: `HTTP ${String(res.status)} — impossible d’atteindre l’API Supabase`,
        };
      }
      const { error } = await this.client
        .from('admin_users')
        .select('id')
        .limit(1);
      const adminUsersTable = error ? 'unavailable' : 'ok';
      const baseMsg =
        adminUsersTable === 'ok'
          ? 'API Supabase joignable, table admin_users OK'
          : 'API Supabase joignable — table admin_users absente ou non exposée (sql/supabase-admin-tables.sql)';
      return {
        connected: true,
        message: baseMsg,
        adminUsersTable,
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        connected: false,
        message: `Erreur réseau ou URL : ${msg}`,
      };
    }
  }

  private async logStartupConnection(): Promise<void> {
    const s = await this.getConnectionStatus();
    if (s.connected) {
      console.log(
        '[Base de données / Supabase] Connecté — la base est joignable via l’API.',
      );
      console.log(`[Base de données / Supabase] Détail : ${s.message}`);
      if (s.adminUsersTable === 'unavailable') {
        console.warn(
          '[Base de données / Supabase] Table admin_users absente ou inaccessible — exécutez sql/supabase-admin-tables.sql dans le SQL Editor Supabase.',
        );
      }
    } else {
      console.error(
        '[Base de données / Supabase] Non connecté — impossible de joindre la base.',
      );
      console.error(`[Base de données / Supabase] Raison : ${s.message}`);
    }
  }

  private resolveUrl(): string {
    const url =
      this.config.get<string>('SUPABASE_URL')?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL')?.trim();
    if (!url) {
      throw new Error(
        'Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL in environment',
      );
    }
    return url;
  }

  private resolveKey(): string {
    const key =
      this.config.get<string>('SUPABASE_SERVICE_ROLE_KEY')?.trim() ||
      this.config.get<string>('SUPABASE_ANON_KEY')?.trim() ||
      this.config
        .get<string>('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY')
        ?.trim() ||
      this.config.get<string>('NEXT_PUBLIC_SUPABASE_ANON_KEY')?.trim();
    if (!key) {
      throw new Error(
        'Missing Supabase key: set SUPABASE_SERVICE_ROLE_KEY (recommended) or SUPABASE_ANON_KEY / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY',
      );
    }
    return key;
  }
}
