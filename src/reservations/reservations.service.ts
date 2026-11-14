import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomInt } from 'crypto';
import { DatabaseService } from '../database/database.service';
import { RoomsService } from '../rooms/rooms.service';
import {
  ALLOWED_EXTRAS_IDS,
  CreateReservationDto,
  ROOM_NIGHTLY_RATES_BB_MAD,
} from './dto/create-reservation.dto';

type ReservationStatus = 'pending' | 'paid' | 'confirmed' | 'cancelled';
type ReservationType = 'rooms' | 'spa' | 'restaurant';

/** Statuts visibles dans le dashboard admin (réservations payées ou confirmées). */
const DASHBOARD_STATUSES: ReservationStatus[] = ['paid', 'confirmed'];

/** Tarifs extras (MAD) — alignés sur le front `ROOM_EXTRA_PRICE_MAD`. */
const EXTRA_PRICE_MAD: Record<(typeof ALLOWED_EXTRAS_IDS)[number], number> = {
  parking: 120,
  airport: 450,
  spa: 500,
};

interface ReservationRow {
  id: string;
  reference: string;
  status: ReservationStatus;
  type: ReservationType;
  created_at: string | Date;
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

const SELECT_COLS =
  'id, reference, status, type, created_at, summary, guest';

function pad4(n: number): string {
  return String(n).padStart(4, '0');
}

function makeReference(now = new Date()): string {
  const year = now.getFullYear();
  const seq = pad4(randomInt(0, 10_000));
  return `OPH-${year}-${seq}`;
}

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: ReservationRow): ReservationRecord {
  return {
    id: row.id,
    reference: row.reference,
    status: row.status,
    type: row.type,
    createdAt: toIso(row.created_at),
    summary: row.summary,
    guest: row.guest,
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const e = error as { code?: string; message?: string };
  if (e.code === '23505') return true;
  const msg = e.message?.toLowerCase?.() ?? '';
  return msg.includes('duplicate') || msg.includes('unique');
}

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly rooms: RoomsService,
  ) {}

  /**
   * Tarif nuitée = CMS `rooms.price_amount` (fallback seed hardcodé si table absente).
   */
  private async resolveNightlyRateMad(roomId: string): Promise<number> {
    try {
      const room = await this.rooms.findById(roomId);
      if (!room.isActive) {
        throw new BadRequestException(`Room "${roomId}" is not available`);
      }
      return room.pricePerNight.amount;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      if (!(e instanceof NotFoundException)) throw e;
      const fallback =
        ROOM_NIGHTLY_RATES_BB_MAD[
          roomId as keyof typeof ROOM_NIGHTLY_RATES_BB_MAD
        ];
      if (fallback === undefined) {
        throw new BadRequestException(`Unknown room "${roomId}"`);
      }
      this.logger.warn(
        `resolveNightlyRateMad() — room "${roomId}" absent de CMS, fallback ${fallback} MAD`,
      );
      return fallback;
    }
  }

  private async assertSummaryPricing(dto: CreateReservationDto): Promise<void> {
    const { summary } = dto;
    const nightly = await this.resolveNightlyRateMad(summary.roomId);
    if (summary.roomPriceFromMAD !== nightly) {
      throw new BadRequestException(
        `Invalid roomPriceFromMAD for "${summary.roomId}": expected ${nightly} MAD (CMS)`,
      );
    }

    const roomsCount = summary.rooms.length;
    const expectedSubtotal = nightly * summary.nights * roomsCount;
    if (summary.roomSubtotalMAD !== expectedSubtotal) {
      throw new BadRequestException(
        `Invalid roomSubtotalMAD: expected ${expectedSubtotal} MAD`,
      );
    }

    const expectedExtras = summary.extrasIds.reduce((sum, id) => {
      const key = id as (typeof ALLOWED_EXTRAS_IDS)[number];
      return sum + (EXTRA_PRICE_MAD[key] ?? 0);
    }, 0);
    if (summary.extrasTotalMAD !== expectedExtras) {
      throw new BadRequestException(
        `Invalid extrasTotalMAD: expected ${expectedExtras} MAD`,
      );
    }

    const expectedTotal = expectedSubtotal + expectedExtras;
    if (summary.estimatedTotalMAD !== expectedTotal) {
      throw new BadRequestException(
        `Invalid estimatedTotalMAD: expected ${expectedTotal} MAD`,
      );
    }
  }

  async create(dto: CreateReservationDto): Promise<ReservationRecord> {
    this.logger.debug(
      `create() — from=${dto.summary.fromISO} to=${dto.summary.toISO}`,
    );
    await this.assertSummaryPricing(dto);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const reference = makeReference();
      this.logger.debug(`create() — tentative ${attempt + 1}, ref=${reference}`);
      try {
        const { rows } = await this.db.query<ReservationRow>(
          `INSERT INTO reservations
             (reference, status, type, source, locale, summary, guest)
           VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb)
           RETURNING ${SELECT_COLS}`,
          [
            reference,
            'pending',
            dto.type,
            dto.source ?? 'web',
            dto.locale ?? null,
            JSON.stringify(dto.summary),
            JSON.stringify(dto.guest),
          ],
        );
        const data = rows[0];
        if (!data) {
          throw new InternalServerErrorException(
            'Failed to create reservation',
          );
        }
        const row = mapRow(data);
        this.logger.log(`create() OK — id=${row.id} ref=${row.reference}`);
        return row;
      } catch (e) {
        if (e instanceof InternalServerErrorException) throw e;
        const message = e instanceof Error ? e.message : String(e);
        this.logger.error(`create() database error: ${message}`);
        if (isUniqueViolation(e)) {
          continue;
        }
        throw new InternalServerErrorException(message);
      }
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
      `list() — lecture database (includeUnpaid=${includeUnpaid})`,
    );
    try {
      let rows: ReservationRow[];
      if (!includeUnpaid) {
        const result = await this.db.query<ReservationRow>(
          `SELECT ${SELECT_COLS}
           FROM reservations
           WHERE status = ANY($1::text[])
           ORDER BY created_at DESC`,
          [DASHBOARD_STATUSES],
        );
        rows = result.rows;
      } else {
        const result = await this.db.query<ReservationRow>(
          `SELECT ${SELECT_COLS}
           FROM reservations
           ORDER BY created_at DESC`,
        );
        rows = result.rows;
      }
      this.logger.log(`list() OK — ${rows.length} ligne(s)`);
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async updateStatus(
    id: string,
    status: ReservationStatus,
  ): Promise<ReservationRecord> {
    this.logger.debug(`updateStatus() — id=${id} status=${status}`);
    let data: ReservationRow | null;
    try {
      const { rows } = await this.db.query<ReservationRow>(
        `UPDATE reservations
         SET status = $1
         WHERE id = $2
         RETURNING ${SELECT_COLS}`,
        [status, id],
      );
      data = rows[0] ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const msg = message.toLowerCase();
      if (msg.includes('0 rows') || msg.includes('no rows')) {
        throw new NotFoundException('Reservation not found');
      }
      throw new InternalServerErrorException(message);
    }
    if (!data) {
      this.logger.warn(`updateStatus() — réservation introuvable id=${id}`);
      throw new NotFoundException('Reservation not found');
    }
    const row = mapRow(data);
    this.logger.log(`updateStatus() OK — ref=${row.reference} status=${row.status}`);
    return row;
  }
}
