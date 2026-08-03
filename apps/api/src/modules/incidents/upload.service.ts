import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { extname, isAbsolute, join, normalize, resolve } from 'node:path';
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';

export interface StorageAdapter {
  save(
    file: Express.Multer.File,
  ): Promise<{ storageKey: string; imageUrl: string }>;
  remove(storageKey: string): Promise<void>;
}

@Injectable()
export class UploadService implements StorageAdapter {
  async save(file: Express.Multer.File) {
    const extension = extname(file.originalname).toLowerCase();
    const allowed = new Map([
      ['.jpg', 'image/jpeg'],
      ['.jpeg', 'image/jpeg'],
      ['.png', 'image/png'],
      ['.webp', 'image/webp'],
    ]);
    if (!allowed.has(extension) || allowed.get(extension) !== file.mimetype) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'รองรับเฉพาะไฟล์ JPG, JPEG, PNG และ WEBP',
      });
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException({
        code: 'FILE_TOO_LARGE',
        message: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB',
      });
    }
    if (!this.hasValidSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException({
        code: 'FILE_TYPE_NOT_ALLOWED',
        message: 'เนื้อหาไฟล์ไม่ตรงกับชนิดรูปภาพที่ระบุ',
      });
    }
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

  async remove(storageKey: string) {
    if (process.env.STORAGE_DRIVER === 's3') {
      const client = this.s3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: process.env.S3_BUCKET!,
          Key: storageKey,
        }),
      );
      return;
    }
    const root = resolve(process.env.STORAGE_LOCAL_PATH ?? 'uploads');
    const target = resolve(root, normalize(storageKey));
    if (
      target === root ||
      !target.startsWith(
        `${root}${process.platform === 'win32' ? '\\' : '/'}`,
      ) ||
      isAbsolute(storageKey)
    ) {
      throw new BadRequestException('Storage key ไม่ถูกต้อง');
    }
    await unlink(target).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  private async saveS3(file: Express.Multer.File, key: string) {
    const endpoint = process.env.S3_ENDPOINT!;
    const bucket = process.env.S3_BUCKET!;
    const client = this.s3Client();
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

  private s3Client() {
    const endpoint = process.env.S3_ENDPOINT;
    const bucket = process.env.S3_BUCKET;
    const accessKeyId = process.env.S3_ACCESS_KEY;
    const secretAccessKey = process.env.S3_SECRET_KEY;
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new BadRequestException('การตั้งค่า S3 Storage ไม่ครบถ้วน');
    }
    return new S3Client({
      endpoint,
      region: process.env.S3_REGION ?? 'auto',
      forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== 'false',
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  private hasValidSignature(buffer: Buffer, mimeType: string) {
    if (mimeType === 'image/jpeg') {
      return (
        buffer.length >= 3 &&
        buffer[0] === 0xff &&
        buffer[1] === 0xd8 &&
        buffer[2] === 0xff
      );
    }
    if (mimeType === 'image/png') {
      return (
        buffer.length >= 8 &&
        buffer
          .subarray(0, 8)
          .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
      );
    }
    return (
      mimeType === 'image/webp' &&
      buffer.length >= 12 &&
      buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP'
    );
  }
}
