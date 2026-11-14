import { Controller, Get, Logger } from '@nestjs/common';
import { RoomsService } from './rooms.service';

/** API publique — chambres actives pour le site (visiteurs). */
@Controller('rooms')
export class PublicRoomsController {
  private readonly logger = new Logger(PublicRoomsController.name);

  constructor(private readonly rooms: RoomsService) {}

  @Get()
  async list() {
    this.logger.log('GET /rooms (public)');
    const rooms = await this.rooms.listPublished();
    const items = rooms.map(({ updatedAt: _updatedAt, ...item }) => item);
    return { items };
  }
}
