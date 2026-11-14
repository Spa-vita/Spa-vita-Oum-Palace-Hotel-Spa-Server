import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { randomUUID } from 'crypto';

export type StoredImage = {
  id: string;
  url: string;
  alt?: string;
};

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable()
export class MediaStorageService {
  private readonly logger = new Logger(MediaStorageService.name);
  private readonly cloudConfigured: boolean;

  constructor(private readonly config: ConfigService) {
    const cloudName = this.config.get<string>('CLOUDINARY_CLOUD_NAME')?.trim();
    const apiKey = this.config.get<string>('CLOUDINARY_API_KEY')?.trim();
    const apiSecret = this.config.get<string>('CLOUDINARY_API_SECRET')?.trim();
    this.cloudConfigured = Boolean(cloudName && apiKey && apiSecret);
    if (this.cloudConfigured) {
      cloudinary.config({
        cloud_name: cloudName,
        api_key: apiKey,
        api_secret: apiSecret,
        secure: true,
      });
      this.logger.log('Media storage: Cloudinary');
    } else {
      this.logger.warn(
        'Media storage: disque local (CLOUDINARY_* manquant — uploads dans ./uploads)',
      );
    }
  }

  isAllowedMime(mime: string): boolean {
    return ALLOWED_MIME.has(mime);
  }

  async uploadRoomCover(
    roomId: string,
    file: Express.Multer.File,
    alt?: string,
  ): Promise<StoredImage> {
    if (this.cloudConfigured) {
      return this.uploadToCloudinary(roomId, file, alt);
    }
    return this.uploadToDisk(roomId, file, alt);
  }

  private async uploadToCloudinary(
    roomId: string,
    file: Express.Multer.File,
    alt?: string,
  ): Promise<StoredImage> {
    const publicId = `rooms/${roomId}-${Date.now()}`;
    let result: UploadApiResponse;
    try {
      result = await new Promise<UploadApiResponse>((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: 'oum-palace/rooms',
            public_id: publicId.replace(/^rooms\//, ''),
            resource_type: 'image',
            overwrite: true,
          },
          (err, res) => {
            if (err || !res) reject(err ?? new Error('Cloudinary empty response'));
            else resolve(res);
          },
        );
        Readable.from(file.buffer).pipe(stream);
      });
    } catch (e) {
      this.logger.error(`Cloudinary upload failed: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Image upload failed');
    }
    return {
      id: result.public_id,
      url: result.secure_url,
      ...(alt ? { alt } : {}),
    };
  }

  private async uploadToDisk(
    roomId: string,
    file: Express.Multer.File,
    alt?: string,
  ): Promise<StoredImage> {
    const ext =
      file.mimetype === 'image/png'
        ? 'png'
        : file.mimetype === 'image/webp'
          ? 'webp'
          : 'jpg';
    const filename = `${roomId}-${Date.now()}.${ext}`;
    const uploadRoot = join(process.cwd(), 'uploads', 'rooms');
    if (!existsSync(uploadRoot)) {
      mkdirSync(uploadRoot, { recursive: true });
    }
    const absPath = join(uploadRoot, filename);
    await pipeline(Readable.from(file.buffer), createWriteStream(absPath));

    const publicBase = (
      this.config.get<string>('PUBLIC_API_URL')?.trim() ||
      `http://localhost:${this.config.get<string>('PORT') ?? '3001'}`
    ).replace(/\/$/, '');
    const id = randomUUID();
    return {
      id,
      url: `${publicBase}/uploads/rooms/${filename}`,
      ...(alt ? { alt } : {}),
    };
  }
}
