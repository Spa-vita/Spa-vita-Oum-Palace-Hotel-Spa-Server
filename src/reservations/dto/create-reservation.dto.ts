import {
  ArrayMinSize,
  IsArray,
  IsEmail,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Min,
  Validate,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ALLOWED_ROOM_IDS = [
  'single-deluxe',
  'executive-suite',
  'executive-terrace',
  'deluxe',
  'deluxe-prestige',
  'superior',
  'superior-vue',
  'presidential',
  'presidential-panoramic',
] as const;

export const ALLOWED_EXTRAS_IDS = [
  'breakfast',
  'parking',
  'airport',
  'spa',
] as const;

@ValidatorConstraint({ name: 'isAfterDate', async: false })
class IsAfterDateConstraint implements ValidatorConstraintInterface {
  validate(toISO: unknown, args?: ValidationArguments): boolean {
    const fromISO = (args?.object as ReservationSummaryDto | undefined)?.fromISO;
    if (!fromISO || typeof toISO !== 'string' || !toISO) return false;
    return new Date(toISO) > new Date(fromISO);
  }

  defaultMessage() {
    return 'toISO must be after fromISO';
  }
}

class ReservationRoomDto {
  @IsInt()
  @Min(1)
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
  @Validate(IsAfterDateConstraint)
  toISO: string;

  @IsInt()
  @Min(1)
  nights: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservationRoomDto)
  rooms: ReservationRoomDto[];

  @IsInt()
  @Min(1)
  guestsTotal: number;

  @IsIn(ALLOWED_ROOM_IDS)
  roomId: string;

  @IsString()
  roomTitleKey: string;

  @IsOptional()
  @IsString()
  roomImage?: string;

  @IsInt()
  @Min(0)
  roomPriceFromMAD: number;

  @IsArray()
  @IsIn(ALLOWED_EXTRAS_IDS, { each: true })
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

  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid international number (e.g. +212600000000)',
  })
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

  @IsIn(['rooms', 'spa', 'restaurant'])
  type: 'rooms' | 'spa' | 'restaurant';

  @IsOptional()
  @IsIn(['web'])
  source?: 'web';

  @IsOptional()
  @IsString()
  locale?: string;
}
