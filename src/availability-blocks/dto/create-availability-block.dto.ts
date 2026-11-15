import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';
import { ALLOWED_ROOM_IDS } from '../../reservations/dto/create-reservation.dto';

const DATE_YYYY_MM_DD = /^\d{4}-\d{2}-\d{2}$/;

export class CreateAvailabilityBlockDto {
  @Matches(DATE_YYYY_MM_DD, {
    message: 'start_date must be YYYY-MM-DD',
  })
  start_date!: string;

  @Matches(DATE_YYYY_MM_DD, {
    message: 'end_date must be YYYY-MM-DD',
  })
  end_date!: string;

  @IsOptional()
  @IsIn([...ALLOWED_ROOM_IDS])
  room_type?: (typeof ALLOWED_ROOM_IDS)[number] | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  rooms_count?: number | null;

  @IsOptional()
  @IsString()
  reason?: string | null;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
