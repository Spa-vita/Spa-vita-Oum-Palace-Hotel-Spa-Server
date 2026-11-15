import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';
import { ALLOWED_ROOM_IDS } from '../../reservations/dto/create-reservation.dto';
import { ROOM_UNIT_STATUSES } from './create-room-unit.dto';

export class UpdateRoomUnitDto {
  @IsOptional()
  @IsString()
  number?: string;

  @IsOptional()
  @IsIn([...ALLOWED_ROOM_IDS])
  type?: (typeof ALLOWED_ROOM_IDS)[number];

  @IsOptional()
  @IsInt()
  floor?: number | null;

  @IsOptional()
  @IsIn([...ROOM_UNIT_STATUSES])
  status?: (typeof ROOM_UNIT_STATUSES)[number];

  @IsOptional()
  @IsString()
  notes?: string | null;
}
