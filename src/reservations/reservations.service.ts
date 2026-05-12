import { Injectable } from '@nestjs/common';
import { randomInt } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

type ReservationStatus = 'pending' | 'confirmed' | 'cancelled';

interface ReservationRow {
  id: string;
  reference: string;
  status: ReservationStatus;
  created_at: string;
  source: string | null;
  locale: string | null;
  summary: unknown;
  guest: unknown;
}

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function makeReference(now = new Date()): string {
  const year = now.getFullYear();
  const seq = pad4(randomInt(0, 10_000));
  return `OPH-${year}-${seq}`;
}

@Injectable()
export class ReservationsService {
  constructor(private readonly supabase: SupabaseService) {}

  async create(
    dto: CreateReservationDto,
  ): Promise<{ id: string; reference: string }> {
    // محاولة توليد مرجع فريد (قد يحدث تصادم نادر جداً)
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = makeReference();
      const { data, error } = await this.supabase
        .getClient()
        .from('reservations')
        .insert({
          reference,
          status: 'pending',
          source: dto.source ?? 'web',
          locale: dto.locale ?? null,
          summary: dto.summary,
          guest: dto.guest,
        } as never)
        .select('id, reference')
        .single();

      if (!error) {
        return {
          id: (data as { id: string; reference: string }).id,
          reference: (data as { id: string; reference: string }).reference,
        };
      }

      // Violation unique (reference) → retry
      const msg = error.message?.toLowerCase?.() ?? '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        continue;
      }
      throw new Error(error.message);
    }
    throw new Error('Unable to generate a unique reservation reference');
  }

  async list(): Promise<
    Array<{
      id: string;
      reference: string;
      status: ReservationStatus;
      createdAt: string;
      summary: unknown;
      guest: unknown;
    }>
  > {
    const { data, error } = await this.supabase
      .getClient()
      .from('reservations')
      .select('id, reference, status, created_at, summary, guest')
      .order('created_at', { ascending: false });
    if (error) {
      throw new Error(error.message);
    }
    const rows = (data ?? []) as ReservationRow[];
    return rows.map((r) => ({
      id: r.id,
      reference: r.reference,
      status: r.status,
      createdAt: r.created_at,
      summary: r.summary,
      guest: r.guest,
    }));
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<{
    id: string;
    reference: string;
    status: ReservationStatus;
    createdAt: string;
    summary: unknown;
    guest: unknown;
  }> {
    const { data, error } = await this.supabase
      .getClient()
      .from('reservations')
      .update({ status } as never)
      .eq('id', id)
      .select('id, reference, status, created_at, summary, guest')
      .single();
    if (error) {
      throw new Error(error.message);
    }
    const row = data as ReservationRow;
    return {
      id: row.id,
      reference: row.reference,
      status: row.status,
      createdAt: row.created_at,
      summary: row.summary,
      guest: row.guest,
    };
  }
}
