import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { UpdateRoomDto } from './dto/update-room.dto';
import { StoredImage } from './media-storage.service';

export type RoomImage = {
  id: string;
  url: string;
  alt?: string;
};

export type MoneyMAD = {
  amount: number;
  currency: 'MAD';
};

export type Room = {
  id: string;
  typeSlug: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  pricePerNight: MoneyMAD;
  showOldPrice: boolean;
  oldPricePerNight: MoneyMAD | null;
  image: RoomImage | null;
  isActive: boolean;
  updatedAt: string;
};

interface RoomRow {
  id: string;
  type_slug: string;
  title: { fr: string; en: string };
  description: { fr: string; en: string };
  price_amount: number;
  price_currency: string;
  show_old_price: boolean | null;
  old_price_amount: number | null;
  old_price_currency: string | null;
  image: RoomImage | null;
  is_active: boolean;
  updated_at: string | Date;
}

const SELECT_COLS =
  'id, type_slug, title, description, price_amount, price_currency, show_old_price, old_price_amount, old_price_currency, image, is_active, updated_at';

const JSONB_COLS = new Set(['title', 'description', 'image']);

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: RoomRow): Room {
  const showOldPrice = row.show_old_price === true;
  const oldAmount = row.old_price_amount;
  return {
    id: row.id,
    typeSlug: row.type_slug,
    title: row.title,
    description: row.description,
    pricePerNight: {
      amount: row.price_amount,
      currency: 'MAD',
    },
    showOldPrice,
    oldPricePerNight:
      showOldPrice && typeof oldAmount === 'number'
        ? { amount: oldAmount, currency: 'MAD' }
        : null,
    image: row.image ?? null,
    isActive: row.is_active,
    updatedAt: toIso(row.updated_at),
  };
}

@Injectable()
export class RoomsService {
  private readonly logger = new Logger(RoomsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<Room[]> {
    try {
      const { rows } = await this.db.query<RoomRow>(
        `SELECT ${SELECT_COLS} FROM rooms ORDER BY id ASC`,
      );
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  /** Chambres publiées pour le site public (sans auth). */
  async listPublished(): Promise<Room[]> {
    try {
      const { rows } = await this.db.query<RoomRow>(
        `SELECT ${SELECT_COLS}
         FROM rooms
         WHERE is_active = $1
         ORDER BY id ASC`,
        [true],
      );
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`listPublished() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async findById(id: string): Promise<Room> {
    let rows: RoomRow[];
    try {
      const result = await this.db.query<RoomRow>(
        `SELECT ${SELECT_COLS} FROM rooms WHERE id = $1 LIMIT 1`,
        [id],
      );
      rows = result.rows;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`findById() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
    const data = rows[0] ?? null;
    if (!data) {
      throw new NotFoundException(`Room "${id}" not found`);
    }
    return mapRow(data);
  }

  async update(id: string, dto: UpdateRoomDto): Promise<{ savedAt: string; room: Room }> {
    const current = await this.findById(id);

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (dto.typeSlug !== undefined) patch.type_slug = dto.typeSlug;
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.pricePerNight !== undefined) {
      patch.price_amount = dto.pricePerNight.amount;
      patch.price_currency = dto.pricePerNight.currency;
    }
    if (dto.isActive !== undefined) patch.is_active = dto.isActive;
    if (dto.image !== undefined) patch.image = dto.image;

    const nextPrice =
      dto.pricePerNight?.amount ?? current.pricePerNight.amount;
    const nextShowOld =
      dto.showOldPrice !== undefined ? dto.showOldPrice : current.showOldPrice;

    if (dto.showOldPrice !== undefined || dto.oldPricePerNight !== undefined) {
      if (!nextShowOld) {
        patch.show_old_price = false;
        patch.old_price_amount = null;
        patch.old_price_currency = null;
      } else {
        const oldAmount =
          dto.oldPricePerNight?.amount ?? current.oldPricePerNight?.amount;
        if (typeof oldAmount !== 'number') {
          throw new BadRequestException(
            'oldPricePerNight.amount is required when showOldPrice is true',
          );
        }
        if (oldAmount <= nextPrice) {
          throw new BadRequestException(
            `oldPricePerNight.amount must be greater than pricePerNight.amount (${nextPrice})`,
          );
        }
        patch.show_old_price = true;
        patch.old_price_amount = oldAmount;
        patch.old_price_currency = 'MAD';
      }
    } else if (dto.pricePerNight !== undefined && current.showOldPrice) {
      // Prix courant baissé sous l’ancien prix affiché → garder la cohérence
      const oldAmount = current.oldPricePerNight?.amount;
      if (typeof oldAmount === 'number' && oldAmount <= nextPrice) {
        throw new BadRequestException(
          `pricePerNight.amount must be less than oldPricePerNight.amount (${oldAmount}) while showOldPrice is true`,
        );
      }
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(patch)) {
      if (JSONB_COLS.has(key) && value !== null && typeof value === 'object') {
        setClauses.push(`${key} = $${i}::jsonb`);
        values.push(JSON.stringify(value));
      } else {
        setClauses.push(`${key} = $${i}`);
        values.push(value);
      }
      i += 1;
    }
    values.push(id);

    let data: RoomRow | null;
    try {
      const { rows } = await this.db.query<RoomRow>(
        `UPDATE rooms SET ${setClauses.join(', ')}
         WHERE id = $${i}
         RETURNING ${SELECT_COLS}`,
        values,
      );
      data = rows[0] ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      const msg = message.toLowerCase();
      if (msg.includes('0 rows') || msg.includes('no rows')) {
        throw new NotFoundException(`Room "${id}" not found`);
      }
      this.logger.error(`update() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
    if (!data) {
      throw new NotFoundException(`Room "${id}" not found`);
    }

    const room = mapRow(data);
    return { savedAt: room.updatedAt, room };
  }

  async setImage(
    id: string,
    image: StoredImage,
  ): Promise<{ savedAt: string; room: Room }> {
    await this.findById(id);
    const updatedAt = new Date().toISOString();
    let data: RoomRow | null;
    try {
      const { rows } = await this.db.query<RoomRow>(
        `UPDATE rooms
         SET image = $1::jsonb, updated_at = $2
         WHERE id = $3
         RETURNING ${SELECT_COLS}`,
        [JSON.stringify(image), updatedAt, id],
      );
      data = rows[0] ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`setImage() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
    if (!data) {
      throw new NotFoundException(`Room "${id}" not found`);
    }
    const room = mapRow(data);
    return { savedAt: room.updatedAt, room };
  }
}
