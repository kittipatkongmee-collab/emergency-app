import { BadRequestException } from '@nestjs/common';
import { UploadService } from './upload.service';

function file(
  originalname: string,
  mimetype: string,
  buffer: Buffer,
): Express.Multer.File {
  return {
    fieldname: 'files',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: '',
    path: '',
    stream: undefined as never,
  };
}

describe('UploadService validation', () => {
  const service = new UploadService();

  it('rejects an extension and MIME mismatch', async () => {
    await expect(
      service.save(
        file('evidence.png', 'image/jpeg', Buffer.from([0xff, 0xd8, 0xff])),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a spoofed PNG signature', async () => {
    await expect(
      service.save(file('evidence.png', 'image/png', Buffer.from('not-png'))),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
