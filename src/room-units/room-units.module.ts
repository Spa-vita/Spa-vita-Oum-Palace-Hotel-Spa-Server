import { Module } from '@nestjs/common';
import { RoomUnitsController } from './room-units.controller';
import { RoomUnitsService } from './room-units.service';

@Module({
  controllers: [RoomUnitsController],
  providers: [RoomUnitsService],
  exports: [RoomUnitsService],
})
export class RoomUnitsModule {}
