import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DatabaseService } from '../database/database.service';
import { AdminUser } from './admin-user.types';

const BCRYPT_ROUNDS = 12;

interface AdminUserRow {
  id: string;
  email: string;
  password_hash: string;
  created_at: string | Date;
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
  constructor(private readonly db: DatabaseService) {}

  async count(): Promise<number> {
    const { rows } = await this.db.query<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM admin_users',
    );
    return Number(rows[0]?.count ?? 0);
  }

  async findByEmail(email: string): Promise<AdminUser | null> {
    const normalized = email.trim().toLowerCase();
    const { rows } = await this.db.query<AdminUserRow>(
      `SELECT id, email, password_hash, created_at
       FROM admin_users
       WHERE email = $1
       LIMIT 1`,
      [normalized],
    );
    const data = rows[0] ?? null;
    if (!data) {
      return null;
    }
    return mapRow(data);
  }

  async findById(id: string): Promise<AdminUser | null> {
    const { rows } = await this.db.query<AdminUserRow>(
      `SELECT id, email, password_hash, created_at
       FROM admin_users
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const data = rows[0] ?? null;
    if (!data) {
      return null;
    }
    return mapRow(data);
  }

  async create(email: string, plainPassword: string): Promise<AdminUser> {
    const passwordHash = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
    const { rows } = await this.db.query<AdminUserRow>(
      `INSERT INTO admin_users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, password_hash, created_at`,
      [email.trim().toLowerCase(), passwordHash],
    );
    const data = rows[0];
    if (!data) {
      throw new Error('Failed to create admin user');
    }
    return mapRow(data);
  }

  async validatePassword(
    plain: string,
    passwordHash: string,
  ): Promise<boolean> {
    return bcrypt.compare(plain, passwordHash);
  }
}
