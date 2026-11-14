import {
  BadRequestException,
  Controller,
  Get,
  Logger,
  Param,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UpdateRoomDto } from './dto/update-room.dto';
import { MediaStorageService } from './media-storage.service';
import { RoomsService } from './rooms.service';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

@Controller('admin/rooms')
@UseGuards(AuthGuard('jwt-admin'))
export class RoomsController {
  private readonly logger = new Logger(RoomsController.name);

  constructor(
    private readonly rooms: RoomsService,
    private readonly media: MediaStorageService,
  ) {}

  @Get()
  async list() {
    this.logger.log('GET /admin/rooms');
    const items = await this.rooms.list();
    return { items };
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    this.logger.log(`GET /admin/rooms/${id}`);
    return this.rooms.findById(id);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateRoomDto) {
    this.logger.log(`PUT /admin/rooms/${id}`);
    return this.rooms.update(id, dto);
  }

  @Post(':id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  async uploadImage(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    this.logger.log(`POST /admin/rooms/${id}/image`);
    if (!file) {
      throw new BadRequestException('Missing multipart field "file"');
    }
    if (!this.media.isAllowedMime(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Allowed: image/jpeg, image/png, image/webp',
      );
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new BadRequestException('File too large (max 5 MB)');
    }

    const alt = file.originalname?.replace(/\.[^.]+$/, '') || undefined;
    const stored = await this.media.uploadRoomCover(id, file, alt);
    const { room } = await this.rooms.setImage(id, stored);
    return room.image;
  }
}
