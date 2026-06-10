import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsNumber, IsString, Min } from 'class-validator';

export class InitiatePaymentDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsNotEmpty()
  orderId!: string;

  @IsEmail()
  customerEmail!: string;

  @IsString()
  @IsNotEmpty()
  roomType!: string;

  @IsString()
  @IsNotEmpty()
  checkIn!: string;

  @IsString()
  @IsNotEmpty()
  checkOut!: string;
}
