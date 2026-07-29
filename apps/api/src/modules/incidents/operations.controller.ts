import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminRole, Prisma } from '@prisma/client';
import argon2 from 'argon2';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';
import { Public, Roles } from '../../common/auth';
import type { AuthenticatedRequest } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';

class AdminUserDto {
  @IsString() username!: string;
  @IsString() fullName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsEnum(AdminRole) role!: AdminRole;
  @IsString() @MinLength(12) password!: string;
}
class RegisterDeviceDto {
  @IsString() token!: string;
  @IsEnum(['IOS', 'ANDROID', 'WEB']) platform!: 'IOS' | 'ANDROID' | 'WEB';
}
class UpdateAdminUserDto {
  @IsOptional() @IsString() fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
}
class ResetPasswordDto {
  @IsString() @MinLength(12) newPassword!: string;
}

@ApiTags('Admin Operations')
@ApiBearerAuth()
@Roles(
  AdminRole.SUPER_ADMIN,
  AdminRole.SUPERVISOR,
  AdminRole.OFFICER,
  AdminRole.VIEWER,
)
@Controller('admin')
export class AdminOperationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('dashboard/summary') async summary() {
    const [total, pending, active, completed] = await Promise.all([
      this.prisma.incident.count(),
      this.prisma.incident.count({ where: { status: 'RECEIVED' } }),
      this.prisma.incident.count({
        where: { status: { in: ['FORWARDED', 'INSPECTING', 'IN_PROGRESS'] } },
      }),
      this.prisma.incident.count({ where: { status: 'COMPLETED' } }),
    ]);
    return { total, pending, active, completed };
  }
  @Get('dashboard/recent-incidents') recent() {
    return this.prisma.incident.findMany({
      take: 5,
      orderBy: { reportedAt: 'desc' },
      include: { images: { take: 1 } },
    });
  }
  @Get('dashboard/incidents-by-status') byStatus() {
    return this.prisma.incident.groupBy({ by: ['status'], _count: true });
  }
  @Get('dashboard/incidents-by-type') byType() {
    return this.prisma.incident.groupBy({ by: ['type'], _count: true });
  }
  @Get('users') @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR) users() {
    return this.prisma.adminUser.findMany({
      omit: { passwordHash: true },
      orderBy: { fullName: 'asc' },
    });
  }
  @Post('users') @Roles(AdminRole.SUPER_ADMIN) async createUser(
    @Body() dto: AdminUserDto,
  ) {
    const { password, ...data } = dto;
    return this.prisma.adminUser.create({
      data: { ...data, passwordHash: await argon2.hash(password) },
      omit: { passwordHash: true },
    });
  }
  @Get('users/:id') @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR) user(
    @Param('id') id: string,
  ) {
    return this.prisma.adminUser.findUnique({
      where: { id },
      omit: { passwordHash: true },
    });
  }
  @Patch('users/:id') @Roles(AdminRole.SUPER_ADMIN) updateUser(
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.prisma.adminUser.update({
      where: { id },
      data: dto,
      omit: { passwordHash: true },
    });
  }
  @Patch('users/:id/status') @Roles(AdminRole.SUPER_ADMIN) userStatus(
    @Param('id') id: string,
    @Body('status') status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED',
  ) {
    return this.prisma.adminUser.update({
      where: { id },
      data: { status },
      omit: { passwordHash: true },
    });
  }
  @Post('users/:id/reset-password')
  @Roles(AdminRole.SUPER_ADMIN)
  async resetPassword(@Param('id') id: string, @Body() dto: ResetPasswordDto) {
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id },
        data: { passwordHash: await argon2.hash(dto.newPassword) },
      }),
      this.prisma.refreshToken.updateMany({
        where: { ownerType: 'ADMIN', ownerId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return { reset: true };
  }
  @Get('audit-logs') @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR) audit(
    @Query('limit') limit?: string,
  ) {
    return this.prisma.auditLog.findMany({
      take: Math.min(100, Number(limit ?? 50)),
      orderBy: { createdAt: 'desc' },
      include: { adminUser: { select: { fullName: true } } },
    });
  }
  @Get('settings') settings() {
    return this.prisma.systemSetting.findMany();
  }
  @Patch('settings') @Roles(AdminRole.SUPER_ADMIN) async settingsUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() values: Record<string, Prisma.InputJsonValue>,
  ) {
    return Promise.all(
      Object.entries(values).map(([key, value]) =>
        this.prisma.systemSetting.upsert({
          where: { key },
          create: { key, value, updatedByAdminUserId: req.user.sub },
          update: { value, updatedByAdminUserId: req.user.sub },
        }),
      ),
    );
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly prisma: PrismaService) {}
  @Get('notifications') list(@Req() req: AuthenticatedRequest) {
    return this.prisma.notification.findMany({
      where:
        req.user.kind === 'admin'
          ? { adminUserId: req.user.sub }
          : { citizenUserId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    });
  }
  @Patch('notifications/:id/read') read(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.prisma.notification.updateMany({
      where: {
        id,
        OR: [{ citizenUserId: req.user.sub }, { adminUserId: req.user.sub }],
      },
      data: { isRead: true, readAt: new Date() },
    });
  }
  @Patch('notifications/read-all') readAll(@Req() req: AuthenticatedRequest) {
    return this.prisma.notification.updateMany({
      where:
        req.user.kind === 'admin'
          ? { adminUserId: req.user.sub }
          : { citizenUserId: req.user.sub },
      data: { isRead: true, readAt: new Date() },
    });
  }
  @Post('devices/register') async device(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterDeviceDto,
  ) {
    return this.prisma.deviceToken.upsert({
      where: { token: dto.token },
      create: { citizenUserId: req.user.sub, ...dto },
      update: {
        citizenUserId: req.user.sub,
        platform: dto.platform,
        isActive: true,
      },
    });
  }
}

@ApiTags('System')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}
  @Public() @Get('health') health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
  @Public() @Get('ready') async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
