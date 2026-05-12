import {
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class ReservationRoomDto {
  @IsInt()
  @Min(0)
  adults: number;

  @IsInt()
  @Min(0)
  children: number;
}

class ReservationSummaryDto {
  @IsString()
  destination: string;

  @IsISO8601()
  fromISO: string;

  @IsISO8601()
  toISO: string;

  @IsInt()
  @Min(0)
  nights: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReservationRoomDto)
  rooms: ReservationRoomDto[];

  @IsInt()
  @Min(0)
  guestsTotal: number;

  @IsString()
  roomId: string;

  @IsString()
  roomTitleKey: string;

  @IsInt()
  @Min(0)
  roomPriceFromMAD: number;

  @IsArray()
  @IsString({ each: true })
  extrasIds: string[];

  @IsInt()
  @Min(0)
  roomSubtotalMAD: number;

  @IsInt()
  @Min(0)
  extrasTotalMAD: number;

  @IsInt()
  @Min(0)
  estimatedTotalMAD: number;
}

class ReservationGuestDto {
  @IsString()
  firstName: string;

  @IsString()
  lastName: string;

  @IsEmail()
  email: string;

  @IsString()
  phone: string;

  @IsOptional()
  @IsString()
  requests?: string;
}

export class CreateReservationDto {
  @ValidateNested()
  @Type(() => ReservationSummaryDto)
  summary: ReservationSummaryDto;

  @ValidateNested()
  @Type(() => ReservationGuestDto)
  guest: ReservationGuestDto;

  @IsOptional()
  @IsIn(['web'])
  source?: 'web';

  @IsOptional()
  @IsString()
  locale?: string;
}
