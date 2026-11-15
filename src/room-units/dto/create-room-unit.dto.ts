import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { ALLOWED_ROOM_IDS } from '../../reservations/dto/create-reservation.dto';

export const ROOM_UNIT_STATUSES = [
  'available',
  'occupied',
  'cleaning',
  'maintenance',
] as const;

export type RoomUnitStatus = (typeof ROOM_UNIT_STATUSES)[number];

export class CreateRoomUnitDto {
  @IsString()
  number!: string;

  @IsIn([...ALLOWED_ROOM_IDS])
  type!: (typeof ALLOWED_ROOM_IDS)[number];

  @IsOptional()
  @IsInt()
  floor?: number;

  @IsOptional()
  @IsIn([...ROOM_UNIT_STATUSES])
  status?: RoomUnitStatus;

  @IsOptional()
  @IsString()
  notes?: string;
}
