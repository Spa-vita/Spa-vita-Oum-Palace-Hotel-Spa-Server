import { Equals, IsBoolean } from 'class-validator';

export class UpdateNotificationDto {
  @IsBoolean()
  @Equals(true)
  read!: true;
}
