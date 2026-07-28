import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateReservationDto } from './dto/create-reservation.dto';

type ReservationStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled';
type ReservationType = 'rooms' | 'spa' | 'restaurant';

/** Statuts visibles dans le dashboard admin (réservations payées ou confirmées). */
const DASHBOARD_STATUSES: ReservationStatus[] = ['paid', 'confirmed'];

interface ReservationRow {
  id: string;
  reference: string;
  status: ReservationStatus;
  type: ReservationType;
  created_at: string;
  source: string | null;
  locale: string | null;
  summary: unknown;
  guest: unknown;
}

export interface ReservationRecord {
  id: string;
  reference: string;
  status: ReservationStatus;
  type: ReservationType;
  createdAt: string;
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

function mapRow(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    type: row.type,
    createdAt: row.created_at,
    summary: row.summary,
    guest: row.guest,
  };
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  async create(dto: CreateReservationDto): Promise<ReservationRecord> {
    this.logger.debug(
      `create() — from=${dto.summary.fromISO} to=${dto.summary.toISO}`,
    );
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = makeReference();
      this.logger.debug(`create() — tentative ${attempt + 1}, ref=${reference}`);
      const { data, error } = await this.supabase
        .getClient()
        .from('reservations')
        .insert({
          reference,
          status: 'pending',
          type: dto.type,
          source: dto.source ?? 'web',
          locale: dto.locale ?? null,
          summary: dto.summary,
          guest: dto.guest,
        } as never)
        .select('id, reference, status, type, created_at, summary, guest')
        .single();

      if (!error) {
        const row = mapRow(data as ReservationRow);
        this.logger.log(`create() OK — id=${row.id} ref=${row.reference}`);
        return row;
      }

      const msg = error.message?.toLowerCase?.() ?? '';
      this.logger.error(`create() Supabase error: ${error.message}`);
      if (msg.includes('duplicate') || msg.includes('unique')) {
        continue;
      }
      throw new InternalServerErrorException(error.message);
    }
    throw new InternalServerErrorException(
      'Unable to generate a unique reservation reference',
    );
  }

  /**
   * @param includeUnpaid — si false (défaut), exclut les réservations non payées (pending).
   */
  async list(includeUnpaid = false): Promise<ReservationRecord[]> {
    this.logger.debug(
      `list() — lecture Supabase (includeUnpaid=${includeUnpaid})`,
    );
    let query = this.supabase
      .getClient()
      .from('reservations')
      .select('id, reference, status, type, created_at, summary, guest')
      .order('created_at', { ascending: false });

    if (!includeUnpaid) {
      query = query.in('status', DASHBOARD_STATUSES);
    }

    const { data, error } = await query;
    if (error) {
      this.logger.error(`list() Supabase error: ${error.message}`);
      throw new InternalServerErrorException(error.message);
    }
    const rows = (data ?? []) as ReservationRow[];
    this.logger.log(`list() OK — ${rows.length} ligne(s)`);
    return rows.map(mapRow);
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    this.logger.debug(`updateStatus() — id=${id} status=${status}`);
    const { data, error } = await this.supabase
      .getClient()
      .from('reservations')
      .update({ status } as never)
      .eq('id', id)
      .select('id, reference, status, type, created_at, summary, guest')
      .single();
    if (error) {
      const msg = error.message?.toLowerCase?.() ?? '';
      if (msg.includes('0 rows') || msg.includes('no rows')) {
        throw new NotFoundException('Reservation not found');
      }
      throw new InternalServerErrorException(error.message);
    }
    if (!data) {
      this.logger.warn(`updateStatus() — réservation introuvable id=${id}`);
      throw new NotFoundException('Reservation not found');
    }
    const row = mapRow(data as ReservationRow);
    this.logger.log(`updateStatus() OK — ref=${row.reference} status=${row.status}`);
    return row;
  }
}
