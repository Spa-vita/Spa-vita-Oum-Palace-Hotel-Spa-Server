import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CreateRoomUnitDto, RoomUnitStatus } from './dto/create-room-unit.dto';
import { UpdateRoomUnitDto } from './dto/update-room-unit.dto';

export interface RoomUnit {
  id: string;
  number: string;
  type: string;
  floor: number | null;
  status: RoomUnitStatus;
  notes: string | null;
  createdAt: string;
}

interface RoomUnitRow {
  id: string;
  number: string;
  type: string;
  floor: number | null;
  status: RoomUnitStatus;
  notes: string | null;
  created_at: string | Date;
}

const SELECT_COLS =
  'id, number, type, floor, status, notes, created_at';

function toIso(value: string | Date): string {
  return typeof value === 'string' ? value : value.toISOString();
}

function mapRow(row: RoomUnitRow): RoomUnit {
  return {
    id: row.id,
    number: row.number,
    type: row.type,
    floor: row.floor,
    status: row.status,
    notes: row.notes,
    createdAt: toIso(row.created_at),
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
export class RoomUnitsService {
  private readonly logger = new Logger(RoomUnitsService.name);

  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<RoomUnit[]> {
    try {
      const { rows } = await this.db.query<RoomUnitRow>(
        `SELECT ${SELECT_COLS} FROM room_units ORDER BY number ASC`,
      );
      return rows.map(mapRow);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`list() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async create(dto: CreateRoomUnitDto): Promise<RoomUnit> {
    try {
      const { rows } = await this.db.query<RoomUnitRow>(
        `INSERT INTO room_units (number, type, floor, status, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING ${SELECT_COLS}`,
        [
          dto.number.trim(),
          dto.type,
          dto.floor ?? null,
          dto.status ?? 'available',
          dto.notes ?? null,
        ],
      );
      const data = rows[0];
      if (!data) {
        throw new InternalServerErrorException('Failed to create room unit');
      }
      return mapRow(data);
    } catch (e) {
      if (e instanceof InternalServerErrorException) throw e;
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          `Room unit number "${dto.number.trim()}" already exists`,
        );
      }
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`create() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async update(id: string, dto: UpdateRoomUnitDto): Promise<RoomUnit> {
    const patch: Record<string, unknown> = {};
    if (dto.number !== undefined) patch.number = dto.number.trim();
    if (dto.type !== undefined) patch.type = dto.type;
    if (dto.floor !== undefined) patch.floor = dto.floor;
    if (dto.status !== undefined) patch.status = dto.status;
    if (dto.notes !== undefined) patch.notes = dto.notes;

    if (Object.keys(patch).length === 0) {
      return this.findById(id);
    }

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(patch)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i += 1;
    }
    values.push(id);

    try {
      const { rows } = await this.db.query<RoomUnitRow>(
        `UPDATE room_units SET ${setClauses.join(', ')}
         WHERE id = $${i}
         RETURNING ${SELECT_COLS}`,
        values,
      );
      const data = rows[0] ?? null;
      if (!data) {
        throw new NotFoundException(`Room unit "${id}" not found`);
      }
      return mapRow(data);
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      if (isUniqueViolation(e)) {
        throw new ConflictException(
          `Room unit number "${String(patch.number)}" already exists`,
        );
      }
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`update() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const { rows } = await this.db.query<{ id: string }>(
        `DELETE FROM room_units WHERE id = $1 RETURNING id`,
        [id],
      );
      if (!rows[0]) {
        throw new NotFoundException(`Room unit "${id}" not found`);
      }
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      const message = e instanceof Error ? e.message : String(e);
      this.logger.error(`remove() database error: ${message}`);
      throw new InternalServerErrorException(message);
    }
  }

  private async findById(id: string): Promise<RoomUnit> {
    const { rows } = await this.db.query<RoomUnitRow>(
      `SELECT ${SELECT_COLS} FROM room_units WHERE id = $1 LIMIT 1`,
      [id],
    );
    const data = rows[0] ?? null;
    if (!data) {
      throw new NotFoundException(`Room unit "${id}" not found`);
    }
    return mapRow(data);
  }
}
