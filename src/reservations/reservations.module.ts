import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { RoomsModule } from '../rooms/rooms.module';
import { ReservationsController } from './reservations.controller';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [RoomsModule, NotificationsModule],
  controllers: [ReservationsController],
  providers: [ReservationsService],
})
export class ReservationsModule {}

