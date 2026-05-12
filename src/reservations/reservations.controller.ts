import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  /** Public: création d'une réservation depuis le site */
  @Post()
  create(@Body() dto: CreateReservationDto) {
    return this.reservations.create(dto);
  }

  /** Admin: listing des réservations */
  @Get()
  @UseGuards(AuthGuard('jwt-admin'))
  async list() {
    const items = await this.reservations.list();
    // Le front accepte soit tableau direct, soit { items }
    return { items };
  }

  /** Admin: modifier le status d'une réservation */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt-admin'))
  async patchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    const item = await this.reservations.updateStatus(id, dto.status);
    return { item };
  }
}
