import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateRoomUnitDto } from './dto/create-room-unit.dto';
import { UpdateRoomUnitDto } from './dto/update-room-unit.dto';
import { RoomUnitsService } from './room-units.service';

@Controller('admin/room-units')
@UseGuards(AuthGuard('jwt-admin'))
export class RoomUnitsController {
  private readonly logger = new Logger(RoomUnitsController.name);

  constructor(private readonly roomUnits: RoomUnitsService) {}

  @Get()
  async list() {
    this.logger.log('GET /admin/room-units');
    const items = await this.roomUnits.list();
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateRoomUnitDto) {
    this.logger.log(`POST /admin/room-units — number=${dto.number}`);
    const item = await this.roomUnits.create(dto);
    return { item };
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomUnitDto) {
    this.logger.log(`PATCH /admin/room-units/${id}`);
    const item = await this.roomUnits.update(id, dto);
    return { item };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`DELETE /admin/room-units/${id}`);
    await this.roomUnits.remove(id);
    return { ok: true as const };
  }
}
