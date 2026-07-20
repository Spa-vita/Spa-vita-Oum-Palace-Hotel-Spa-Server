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
  'parking',
  'airport',
  'spa',
] as const;

/**
 * Nightly BB rates (MAD) — breakfast included, do not charge breakfast add-on.
 */
export const ROOM_NIGHTLY_RATES_BB_MAD: Record<
  (typeof ALLOWED_ROOM_IDS)[number],
  number
> = {
  'single-deluxe': 800,
  superior: 1100,
  'superior-vue': 1100,
  deluxe: 1400,
  'deluxe-prestige': 1400,
  'executive-suite': 1800,
  'executive-terrace': 1800,
  presidential: 1800,
  'presidential-panoramic': 1800,
};

type Occupancy = { adults: number; children: number };

/** Allowed (adults, children) combos per listing roomId */
export const ALLOWED_OCCUPANCY_BY_ROOM_ID: Record<
  (typeof ALLOWED_ROOM_IDS)[number],
  Occupancy[]
> = {
  'single-deluxe': [{ adults: 1, children: 0 }],
  superior: [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 1, children: 1 },
  ],
  'superior-vue': [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 1, children: 1 },
  ],
  'executive-suite': [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 2, children: 1 },
    { adults: 2, children: 2 },
  ],
  'executive-terrace': [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 2, children: 1 },
    { adults: 2, children: 2 },
  ],
  deluxe: [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 3, children: 0 },
    { adults: 1, children: 1 },
    { adults: 2, children: 1 },
  ],
  'deluxe-prestige': [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 3, children: 0 },
    { adults: 1, children: 1 },
    { adults: 2, children: 1 },
  ],
  presidential: [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 2, children: 1 },
    { adults: 2, children: 2 },
  ],
  'presidential-panoramic': [
    { adults: 1, children: 0 },
    { adults: 2, children: 0 },
    { adults: 2, children: 1 },
    { adults: 2, children: 2 },
  ],
};

function isAllowedOccupancy(
  roomId: string,
  adults: number,
  children: number,
): boolean {
  const allowed =
    ALLOWED_OCCUPANCY_BY_ROOM_ID[
      roomId as (typeof ALLOWED_ROOM_IDS)[number]
    ];
  if (!allowed) return false;
  return allowed.some((o) => o.adults === adults && o.children === children);
}

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

@ValidatorConstraint({ name: 'isValidRoomOccupancy', async: false })
class IsValidRoomOccupancyConstraint implements ValidatorConstraintInterface {
  validate(rooms: unknown, args?: ValidationArguments): boolean {
    const summary = args?.object as ReservationSummaryDto | undefined;
    if (!summary?.roomId || !Array.isArray(rooms) || rooms.length === 0) {
      return false;
    }
    return rooms.every((room) => {
      if (!room || typeof room !== 'object') return false;
      const { adults, children } = room as Occupancy;
      if (typeof adults !== 'number' || typeof children !== 'number') {
        return false;
      }
      return isAllowedOccupancy(summary.roomId, adults, children);
    });
  }

  defaultMessage(args?: ValidationArguments) {
    const summary = args?.object as ReservationSummaryDto | undefined;
    const roomId = summary?.roomId ?? 'unknown';
    return `Invalid occupancy for roomType "${roomId}": each rooms[] unit must match an allowed (adults, children) combo`;
  }
}

@ValidatorConstraint({ name: 'isValidRoomNightlyRate', async: false })
class IsValidRoomNightlyRateConstraint implements ValidatorConstraintInterface {
  validate(price: unknown, args?: ValidationArguments): boolean {
    const summary = args?.object as ReservationSummaryDto | undefined;
    if (!summary?.roomId || typeof price !== 'number') return false;
    const expected =
      ROOM_NIGHTLY_RATES_BB_MAD[
        summary.roomId as (typeof ALLOWED_ROOM_IDS)[number]
      ];
    return expected !== undefined && price === expected;
  }

  defaultMessage(args?: ValidationArguments) {
    const summary = args?.object as ReservationSummaryDto | undefined;
    const roomId = summary?.roomId ?? 'unknown';
    const expected =
      ROOM_NIGHTLY_RATES_BB_MAD[
        roomId as (typeof ALLOWED_ROOM_IDS)[number]
      ];
    return `Invalid roomPriceFromMAD for "${roomId}": expected BB rate ${String(expected ?? '?')} MAD`;
  }
}

class ReservationRoomDto {
  @IsInt()
  @Min(1)
  adults!: number;

  @IsInt()
  @Min(0)
  children!: number;
}

class ReservationSummaryDto {
  @IsString()
  destination!: string;

  @IsISO8601()
  fromISO!: string;

  @IsISO8601()
  @Validate(IsAfterDateConstraint)
  toISO!: string;

  @IsInt()
  @Min(1)
  nights!: number;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReservationRoomDto)
  @Validate(IsValidRoomOccupancyConstraint)
  rooms!: ReservationRoomDto[];

  @IsInt()
  @Min(1)
  guestsTotal!: number;

  @IsIn(ALLOWED_ROOM_IDS)
  roomId!: string;

  @IsString()
  roomTitleKey!: string;

  @IsOptional()
  @IsString()
  roomImage?: string;

  @IsInt()
  @Min(0)
  @Validate(IsValidRoomNightlyRateConstraint)
  roomPriceFromMAD!: number;

  @IsArray()
  @IsIn(ALLOWED_EXTRAS_IDS, { each: true })
  extrasIds!: string[];

  @IsInt()
  @Min(0)
  roomSubtotalMAD!: number;

  @IsInt()
  @Min(0)
  extrasTotalMAD!: number;

  @IsInt()
  @Min(0)
  estimatedTotalMAD!: number;
}

class ReservationGuestDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsEmail()
  email!: string;

  @Matches(/^\+[1-9]\d{7,14}$/, {
    message: 'phone must be a valid international number (e.g. +212600000000)',
  })
  phone!: string;

  @IsOptional()
  @IsString()
  requests?: string;
}

export class CreateReservationDto {
  @ValidateNested()
  @Type(() => ReservationSummaryDto)
  summary!: ReservationSummaryDto;

  @ValidateNested()
  @Type(() => ReservationGuestDto)
  guest!: ReservationGuestDto;

  @IsIn(['rooms', 'spa', 'restaurant'])
  type!: 'rooms' | 'spa' | 'restaurant';

  @IsOptional()
  @IsIn(['web'])
  source?: 'web';

  @IsOptional()
  @IsString()
  locale?: string;
}
