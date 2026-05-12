import { IsIn } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsIn(['pending', 'confirmed', 'cancelled'])
  status: 'pending' | 'confirmed' | 'cancelled';
}
