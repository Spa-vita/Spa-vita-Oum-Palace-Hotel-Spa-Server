import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { UpdateReservationStatusDto } from './dto/update-reservation-status.dto';
import { ReservationsService } from './reservations.service';

@Controller('reservations')
export class ReservationsController {
  private readonly logger = new Logger(ReservationsController.name);

  constructor(private readonly reservations: ReservationsService) {}

  /** Public: création d'une réservation depuis le site */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateReservationDto) {
    this.logger.log(
      `POST /reservations — guest=${dto.guest.email}, room=${dto.summary.roomId}, type=${dto.type}`,
    );
    return this.reservations.create(dto);
  }

  /** Admin: listing des réservations payées (passer ?all=true pour tout voir) */
  @Get()
  @UseGuards(AuthGuard('jwt-admin'))
  async list(@Query('all') all?: string) {
    const includeUnpaid = all === 'true';
    this.logger.log(
      `GET /reservations — admin list (includeUnpaid=${includeUnpaid})`,
    );
    const items = await this.reservations.list(includeUnpaid);
    this.logger.log(`GET /reservations — ${items.length} réservation(s)`);
    return { items };
  }

  /** Admin: modifier le status d'une réservation */
  @Patch(':id')
  @UseGuards(AuthGuard('jwt-admin'))
  async patchStatus(
    @Param('id') id: string,
    @Body() dto: UpdateReservationStatusDto,
  ) {
    this.logger.log(`PATCH /reservations/${id} — status=${dto.status}`);
    const item = await this.reservations.updateStatus(id, dto.status);
    return { item };
  }
}
