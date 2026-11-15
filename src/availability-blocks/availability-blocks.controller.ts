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
import { AvailabilityBlocksService } from './availability-blocks.service';
import { CreateAvailabilityBlockDto } from './dto/create-availability-block.dto';
import { UpdateAvailabilityBlockDto } from './dto/update-availability-block.dto';

@Controller('admin/availability-blocks')
@UseGuards(AuthGuard('jwt-admin'))
export class AvailabilityBlocksController {
  private readonly logger = new Logger(AvailabilityBlocksController.name);

  constructor(private readonly blocks: AvailabilityBlocksService) {}

  @Get()
  async list() {
    this.logger.log('GET /admin/availability-blocks');
    const items = await this.blocks.list();
    return { items };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateAvailabilityBlockDto) {
    this.logger.log(
      `POST /admin/availability-blocks — ${dto.start_date}→${dto.end_date}`,
    );
    const item = await this.blocks.create(dto);
    return { item };
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateAvailabilityBlockDto,
  ) {
    this.logger.log(`PATCH /admin/availability-blocks/${id}`);
    const item = await this.blocks.update(id, dto);
    return { item };
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    this.logger.log(`DELETE /admin/availability-blocks/${id}`);
    await this.blocks.remove(id);
    return { ok: true as const };
  }
}
