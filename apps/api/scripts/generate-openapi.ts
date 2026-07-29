import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';

async function main() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api/v1');
  const config = new DocumentBuilder()
    .setTitle('Police Incident API')
    .setDescription('API ระบบแจ้งเหตุและติดตามสถานะเหตุฉุกเฉิน กองบินตำรวจ')
    .setVersion('1.0.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  await writeFile(
    resolve(process.cwd(), '../../packages/api-spec/openapi.json'),
    JSON.stringify(document, null, 2),
    'utf8',
  );
  await app.close();
}

void main();
