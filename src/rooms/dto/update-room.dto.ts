import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Min,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { Type } from 'class-transformer';

export const ALLOWED_ROOM_TYPE_SLUGS = [
  'deluxe',
  'premium',
  'superior',
  'twin',
  'executive-suite',
  'presidential',
  'single-deluxe',
] as const;

class LocalizedTextDto {
  @IsString()
  fr!: string;

  @IsString()
  en!: string;
}

class PricePerNightDto {
  @IsInt()
  @Min(0)
  amount!: number;

  @IsIn(['MAD'])
  currency!: 'MAD';
}

class RoomImageDto {
  @IsString()
  id!: string;

  @IsString()
  url!: string;

  @IsOptional()
  @IsString()
  alt?: string;
}

@ValidatorConstraint({ name: 'isNotDataUrlImage', async: false })
class IsNotDataUrlImageConstraint implements ValidatorConstraintInterface {
  validate(image: unknown): boolean {
    if (image === null) return true;
    if (!image || typeof image !== 'object') return false;
    const url = (image as { url?: unknown }).url;
    if (typeof url !== 'string' || !url.trim()) return false;
    return !url.trim().toLowerCase().startsWith('data:');
  }

  defaultMessage(args?: ValidationArguments) {
    return `${args?.property ?? 'image'} must not be a data URL (upload via POST /admin/rooms/:id/image)`;
  }
}

/**
 * Corps PUT /admin/rooms/:id.
 * Le front envoie souvent l’objet Room complet — `id` est ignoré ;
 * `image` data URL est rejeté (brouillon front uniquement).
 */
export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  id?: string;

  @IsOptional()
  @IsIn(ALLOWED_ROOM_TYPE_SLUGS)
  typeSlug?: (typeof ALLOWED_ROOM_TYPE_SLUGS)[number];

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  title?: LocalizedTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => LocalizedTextDto)
  description?: LocalizedTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PricePerNightDto)
  pricePerNight?: PricePerNightDto;

  @IsOptional()
  @IsBoolean()
  showOldPrice?: boolean;

  /**
   * Requis si showOldPrice === true (validé aussi dans le service vs prix actuel).
   * null / ignoré si showOldPrice === false.
   */
  @IsOptional()
  @ValidateIf((_, v) => v !== null && v !== undefined)
  @ValidateNested()
  @Type(() => PricePerNightDto)
  oldPricePerNight?: PricePerNightDto | null;

  /** null = retirer l’image ; objet = URL CDN/relative (pas de data:). */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @ValidateNested()
  @Type(() => RoomImageDto)
  @Validate(IsNotDataUrlImageConstraint)
  image?: RoomImageDto | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
