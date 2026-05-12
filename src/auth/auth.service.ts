import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import { AdminUsersService } from '../admin-users/admin-users.service';
import { SupabaseService } from '../supabase/supabase.service';

const AUTH_INVALID = 'Invalid credentials';

export interface JwtPayload {
  sub: string;
  email: string;
  typ: 'admin_access';
}

interface RefreshRow {
  id: string;
  user_id: string;
  expires_at: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly adminUsers: AdminUsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly supabase: SupabaseService,
  ) {}

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }

  private newRefreshTokenValue(): string {
    return randomBytes(48).toString('base64url');
  }

  private refreshExpiresAt(): Date {
    const days = Number(
      this.config.get<string>('JWT_REFRESH_EXPIRES_DAYS') ?? '7',
    );
    const d = new Date();
    d.setDate(d.getDate() + (Number.isFinite(days) && days > 0 ? days : 7));
    return d;
  }

  async login(email: string, password: string) {
    const user = await this.adminUsers.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const ok = await this.adminUsers.validatePassword(
      password,
      user.passwordHash,
    );
    if (!ok) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    await this.purgeExpiredRefreshTokens();
    const refreshToken = this.newRefreshTokenValue();
    const tokenHash = this.hashRefreshToken(refreshToken);
    const { error } = await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .insert({
        user_id: user.id,
        token_hash: tokenHash,
        expires_at: this.refreshExpiresAt().toISOString(),
      } as never);
    if (error) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const accessToken = await this.signAccess(user.id, user.email);
    return {
      accessToken,
      refreshToken,
      tokenType: 'Bearer' as const,
      expiresIn: this.accessExpiresSeconds(),
    };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const { data: row, error: findErr } = await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .select('id, user_id, expires_at')
      .eq('token_hash', tokenHash)
      .maybeSingle();
    if (findErr) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const typed = row as RefreshRow | null;
    if (!typed || new Date(typed.expires_at) < new Date()) {
      if (typed) {
        await this.supabase
          .getClient()
          .from('admin_refresh_tokens')
          .delete()
          .eq('id', typed.id);
      }
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const user = await this.adminUsers.findById(typed.user_id);
    if (!user) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .delete()
      .eq('id', typed.id);
    const newRt = this.newRefreshTokenValue();
    const newHash = this.hashRefreshToken(newRt);
    const { error: insErr } = await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .insert({
        user_id: user.id,
        token_hash: newHash,
        expires_at: this.refreshExpiresAt().toISOString(),
      } as never);
    if (insErr) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const accessToken = await this.signAccess(user.id, user.email);
    return {
      accessToken,
      refreshToken: newRt,
      tokenType: 'Bearer' as const,
      expiresIn: this.accessExpiresSeconds(),
    };
  }

  async logout(refreshToken: string): Promise<{ ok: true }> {
    const tokenHash = this.hashRefreshToken(refreshToken);
    await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .delete()
      .eq('token_hash', tokenHash);
    return { ok: true };
  }

  async validateAccessPayload(payload: JwtPayload) {
    if (payload.typ !== 'admin_access') {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    const user = await this.adminUsers.findById(payload.sub);
    if (!user || user.email !== payload.email) {
      throw new UnauthorizedException(AUTH_INVALID);
    }
    return { userId: user.id, email: user.email };
  }

  private accessExpiresSeconds(): number {
    const raw = this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    const m = /^(\d+)m$/i.exec(raw.trim());
    if (m) return parseInt(m[1], 10) * 60;
    const s = /^(\d+)s$/i.exec(raw.trim());
    if (s) return parseInt(s[1], 10);
    return 900;
  }

  private async signAccess(userId: string, email: string): Promise<string> {
    const secret = this.config.getOrThrow<string>('JWT_SECRET');
    const expiresIn = this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m';
    const payload: JwtPayload = {
      sub: userId,
      email,
      typ: 'admin_access',
    };
    return this.jwt.signAsync(payload, {
      secret,
      expiresIn: expiresIn as `${number}m` | `${number}s` | number,
    });
  }

  private async purgeExpiredRefreshTokens(): Promise<void> {
    await this.supabase
      .getClient()
      .from('admin_refresh_tokens')
      .delete()
      .lt('expires_at', new Date().toISOString());
  }
}
