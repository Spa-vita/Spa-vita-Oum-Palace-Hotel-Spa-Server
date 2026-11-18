import { IsIn } from 'class-validator';

export class UpdateReservationStatusDto {
  @IsIn(['pending', 'paid', 'confirmed', 'cancelled'])
  status: 'pending' | 'paid' | 'confirmed' | 'cancelled';
}
