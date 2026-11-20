import {
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type NotificationType = 'booking' | 'review' | 'system';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  reservation_id: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  read: boolean;
  reservation_id: string | null;
  created_at: string | Date;
}

const SELECT_COLS = 'id, type, title, body, read, reservation_id, created_at';

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: NotificationRow): Notification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    read: row.read,
    reservation_id: row.reservation_id ?? null,
    createdAt: toIso(row.created_at),
  };
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(limit = 30): Promise<{ items: Notification[]; unread: number }> {
    const safeLimit = Math.min(Math.max(1, Math.floor(limit) || 30), 100);
    try {
      const [listResult, unreadResult] = await Promise.all([
        this.db.query<NotificationRow>(
          `SELECT ${SELECT_COLS}
           FROM notifications
           ORDER BY created_at DESC
           LIMIT $1`,
          [safeLimit],
        ),
        this.db.query<{ count: string }>(
          `SELECT COUNT(*)::text AS count
           FROM notifications
           WHERE read = false`,
        ),
      ]);
      return {
        items: listResult.rows.map(mapRow),
        unread: Number(unreadResult.rows[0]?.count ?? 0),
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async markRead(id: string): Promise<Notification> {
    try {
      const { rows } = await this.db.query<NotificationRow>(
        `UPDATE notifications
         SET read = true
         WHERE id = $1
         RETURNING ${SELECT_COLS}`,
        [id],
      );
      const data = rows[0] ?? null;
      if (!data) {
        throw new NotFoundException(`Notification "${id}" not found`);
      }
      return mapRow(data);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`markRead() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async markAllRead(): Promise<void> {
    try {
      await this.db.query(
        `UPDATE notifications SET read = true WHERE read = false`,
      );
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`markAllRead() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /**
   * Used by reservation create — callers should wrap in try/catch so failures
   * never block the booking.
   */
  async createBookingNotification(params: {
    guestName: string;
    reference: string;
    reservationId: string;
  }): Promise<Notification> {
    const guestName = params.guestName.trim() || 'Invité';
    const body = `${guestName} · ${params.reference}`;
    const { rows } = await this.db.query<NotificationRow>(
      `INSERT INTO notifications (type, title, body, reservation_id)
       VALUES ($1, $2, $3, $4)
       RETURNING ${SELECT_COLS}`,
      ['booking', 'Nouvelle réservation', body, params.reservationId],
    );
    const data = rows[0];
    if (!data) {
      throw new Error('Failed to create notification');
    }
    return mapRow(data);
  }
}
