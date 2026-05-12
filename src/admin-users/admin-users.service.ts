import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { SupabaseService } from '../supabase/supabase.service';
import { AdminUser } from './admin-user.types';

const BCRYPT_ROUNDS = 12;

interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string;
}

function mapRow(row: AdminUserRow): AdminUser {
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    createdAt: new Date(row.created_at),
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly supabase: SupabaseService) {}

  async count(): Promise<number> {
    const { count, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('*', { count: 'exact', head: true });
    if (error) {
      throw new Error(error.message);
    }
    return count ?? 0;
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const normalized = email.trim().toLowerCase();
    const { data, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('id, email, password_hash, created_at')
      .eq('email', normalized)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    return mapRow(data as AdminUserRow);
  }

  async findById(id: string): Promise<AdminUser | null> {
    const { data, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .select('id, email, password_hash, created_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return null;
    }
    return mapRow(data as AdminUserRow);
  }

  async create(email: string, plainPassword: string): Promise<AdminUser> {
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    const { data, error } = await this.supabase
      .getClient()
      .from('admin_users')
      .insert({
        email: email.trim().toLowerCase(),
        password_hash: passwordHash,
      } as never)
      .select('id, email, password_hash, created_at')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    return mapRow(data as AdminUserRow);
  }

  async validatePassword(
    plain: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }
}
