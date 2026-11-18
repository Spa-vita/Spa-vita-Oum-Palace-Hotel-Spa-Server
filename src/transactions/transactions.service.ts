import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type TransactionType = 'payment' | 'refund';
export type TransactionMethod = 'cmi' | 'manual' | 'cash' | 'transfer';

export interface Transaction {
  id: string;
  reservation_id: string | null;
  type: TransactionType;
  amount: number;
  method: TransactionMethod;
  created_at: string;
}

interface TransactionRow {
  id: string;
  reservation_id: string | null;
  type: TransactionType;
  amount: string | number;
  method: TransactionMethod;
  created_at: string | Date;
}

const SELECT_COLS =
  'id, reservation_id, type, amount, method, created_at';

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: TransactionRow): Transaction {
  return {
    id: row.id,
    reservation_id: row.reservation_id,
    type: row.type,
    amount: typeof row.amount === 'number' ? row.amount : Number(row.amount),
    method: row.method,
    created_at: toIso(row.created_at),
  };
}

/** Pull total from reservation summary jsonb (estimatedTotalMAD). */
export function extractReservationTotal(summary: unknown): number | null {
  if (!summary || typeof summary !== 'object') return null;
  const raw = (summary as { estimatedTotalMAD?: unknown }).estimatedTotalMAD;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(limit = 200): Promise<Transaction[]> {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 200), 500);
    try {
      const { rows } = await this.db.query<TransactionRow>(
        `SELECT ${SELECT_COLS}
         FROM transactions
         ORDER BY created_at DESC
         LIMIT $1`,
        [safeLimit],
      );
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Idempotent payment insert (one payment per reservation).
   * Callers should wrap in try/catch so failures never break payment/status flows.
   */
  async recordPayment(params: {
    reservationId: string;
    amount: number;
    method: TransactionMethod;
  }): Promise<void> {
    if (!Number.isFinite(params.amount)) {
      throw new Error(`Invalid payment amount: ${String(params.amount)}`);
    }
    await this.db.query(
      `INSERT INTO transactions (reservation_id, type, amount, method)
       VALUES ($1, 'payment', $2, $3)
       ON CONFLICT (reservation_id) WHERE (type = 'payment') DO NOTHING`,
      [params.reservationId, params.amount, params.method],
    );
  }
}
