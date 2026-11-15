import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateAvailabilityBlockDto } from './dto/create-availability-block.dto';
import { UpdateAvailabilityBlockDto } from './dto/update-availability-block.dto';

export interface AvailabilityBlock {
  id: string;
  startDate: string;
  endDate: string;
  roomType: string | null;
  roomsCount: number | null;
  reason: string | null;
  active: boolean;
  createdAt: string;
}

interface AvailabilityBlockRow {
  id: string;
  start_date: string;
  end_date: string;
  room_type: string | null;
  rooms_count: number | null;
  reason: string | null;
  active: boolean;
  created_at: string | Date;
}

const SELECT_COLS = `id,
  start_date::text AS start_date,
  end_date::text AS end_date,
  room_type,
  rooms_count,
  reason,
  active,
  created_at`;

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: AvailabilityBlockRow): AvailabilityBlock {
  return {
    id: row.id,
    startDate: row.start_date.slice(0, 10),
    endDate: row.end_date.slice(0, 10),
    roomType: row.room_type,
    roomsCount: row.rooms_count,
    reason: row.reason,
    active: row.active,
    createdAt: toIso(row.created_at),
  };
}

function assertDateRange(start: string, end: string): void {
  if (end < start) {
    throw new BadRequestException('end_date must be on or after start_date');
  }
}

@Injectable()
export class AvailabilityBlocksService {
  private readonly logger = new Logger(AvailabilityBlocksService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<AvailabilityBlock[]> {
    try {
      const { rows } = await this.db.query<AvailabilityBlockRow>(
        `SELECT ${SELECT_COLS}
         FROM availability_blocks
         ORDER BY start_date DESC`,
      );
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async create(dto: CreateAvailabilityBlockDto): Promise<AvailabilityBlock> {
    assertDateRange(dto.start_date, dto.end_date);
    try {
      const { rows } = await this.db.query<AvailabilityBlockRow>(
        `INSERT INTO availability_blocks
           (start_date, end_date, room_type, rooms_count, reason, active)
         VALUES ($1::date, $2::date, $3, $4, $5, $6)
         RETURNING ${SELECT_COLS}`,
        [
          dto.start_date,
          dto.end_date,
          dto.room_type ?? null,
          dto.rooms_count ?? null,
          dto.reason ?? null,
          dto.active ?? true,
        ],
      );
      const data = rows[0];
      if (!data) {
        throw new InternalServerErrorException(
          'Failed to create availability block',
        );
      }
      return mapRow(data);
    } catch (e) {
      if (e instanceof InternalServerErrorException) throw e;
      if (e instanceof BadRequestException) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`create() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async update(
    id: string,
    dto: UpdateAvailabilityBlockDto,
  ): Promise<AvailabilityBlock> {
    const current = await this.findById(id);

    const nextStart = dto.start_date ?? current.startDate;
    const nextEnd = dto.end_date ?? current.endDate;
    assertDateRange(nextStart, nextEnd);

    const patch: Record<string, unknown> = {};
    if (dto.start_date !== undefined) patch.start_date = dto.start_date;
    if (dto.end_date !== undefined) patch.end_date = dto.end_date;
    if (dto.room_type !== undefined) patch.room_type = dto.room_type;
    if (dto.rooms_count !== undefined) patch.rooms_count = dto.rooms_count;
    if (dto.reason !== undefined) patch.reason = dto.reason;
    if (dto.active !== undefined) patch.active = dto.active;

    if (Object.keys(patch).length === 0) {
      return current;
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(patch)) {
      if (key === 'start_date' || key === 'end_date') {
        setClauses.push(`${key} = $${i}::date`);
      } else {
        setClauses.push(`${key} = $${i}`);
      }
      values.push(value);
      i += 1;
    }
    values.push(id);

    try {
      const { rows } = await this.db.query<AvailabilityBlockRow>(
        `UPDATE availability_blocks SET ${setClauses.join(', ')}
         WHERE id = $${i}
         RETURNING ${SELECT_COLS}`,
        values,
      );
      const data = rows[0] ?? null;
      if (!data) {
        throw new NotFoundException(`Availability block "${id}" not found`);
      }
      return mapRow(data);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      if (e instanceof BadRequestException) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`update() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `DELETE FROM availability_blocks WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0]) {
        throw new NotFoundException(`Availability block "${id}" not found`);
      }
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`remove() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  private async findById(id: string): Promise<AvailabilityBlock> {
    const { rows } = await this.db.query<AvailabilityBlockRow>(
      `SELECT ${SELECT_COLS}
       FROM availability_blocks
       WHERE id = $1
       LIMIT 1`,
      [id],
    );
    const data = rows[0] ?? null;
    if (!data) {
      throw new NotFoundException(`Availability block "${id}" not found`);
    }
    return mapRow(data);
  }
}
