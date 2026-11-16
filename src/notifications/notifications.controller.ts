import {
  Body,
  Controller,
  DefaultValuePipe,
  Get,
  Logger,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UpdateNotificationDto } from './dto/update-notification.dto';
import { NotificationsService } from './notifications.service';

@Controller('admin/notifications')
@UseGuards(AuthGuard('jwt-admin'))
export class NotificationsController {
  private readonly logger = new Logger(NotificationsController.name);

  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  async list(
    @Query('limit', new DefaultValuePipe(30), ParseIntPipe) limit: number,
  ) {
    this.logger.log(`GET /admin/notifications — limit=${limit}`);
    return this.notifications.list(limit);
  }

  @Post('read-all')
  async markAllRead() {
    this.logger.log('POST /admin/notifications/read-all');
    await this.notifications.markAllRead();
    return { ok: true as const };
  }

  @Patch(':id')
  async markRead(
    @Param('id') id: string,
    @Body() dto: UpdateNotificationDto,
  ) {
    this.logger.log(`PATCH /admin/notifications/${id} — read=${dto.read}`);
    const item = await this.notifications.markRead(id);
    return { item };
  }
}
