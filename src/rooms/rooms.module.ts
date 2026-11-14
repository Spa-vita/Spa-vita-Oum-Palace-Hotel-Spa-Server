import { Module } from '@nestjs/common';
import { MediaStorageService } from './media-storage.service';
import { PublicRoomsController } from './public-rooms.controller';
import { RoomsController } from './rooms.controller';
import { RoomsService } from './rooms.service';

@Module({
  controllers: [PublicRoomsController, RoomsController],
  providers: [RoomsService, MediaStorageService],
  exports: [RoomsService],
})
export class RoomsModule {}
