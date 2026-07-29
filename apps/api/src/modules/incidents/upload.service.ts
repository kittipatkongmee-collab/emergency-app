import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

export interface StorageAdapter {
  save(
    file: Express.Multer.File,
  ): Promise<{ storageKey: string; imageUrl: string }>;
}

@Injectable()
export class UploadService implements StorageAdapter {
  async save(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    if (
      !['.jpg', '.jpeg', '.png'].includes(extension) ||
      !['image/jpeg', 'image/png'].includes(file.mimetype)
    ) {
      throw new BadRequestException('รองรับเฉพาะไฟล์ JPG และ PNG');
    }
    if (file.size > 10 * 1024 * 1024)
      throw new BadRequestException('ไฟล์ต้องมีขนาดไม่เกิน 10 MB');
    const key = `${new Date().getUTCFullYear()}/${randomUUID()}${extension}`;
    if (process.env.STORAGE_DRIVER === 's3') {
      return this.saveS3(file, key);
    }
    const root = process.env.STORAGE_LOCAL_PATH ?? 'uploads';
    const path = join(root, key);
    await mkdir(join(root, String(new Date().getUTCFullYear())), {
      recursive: true,
    });
    await writeFile(path, file.buffer);
    return {
      storageKey: key,
      imageUrl: `/uploads/${key.replaceAll('\\', '/')}`,
    };
  }

  private async saveS3(file: Express.Multer.File, key: string) {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new BadRequestException('การตั้งค่า S3 Storage ไม่ครบถ้วน');
    }
    const client = new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'auto',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    });
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      }),
    );
    const publicBase =
      process.env.S3_PUBLIC_BASE_URL ??
      `${endpoint.replace(/\/$/, '')}/${bucket}`;
    return { storageKey: key, imageUrl: `${publicBase}/${key}` };
  }
}
