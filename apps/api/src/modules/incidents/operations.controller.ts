import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  AdminRole,
  IncidentStatus,
  PlatformType,
  Prisma,
  UserStatus,
} from '@prisma/client';
import argon2 from 'argon2';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Matches,
  Min,
  MinLength,
} from 'class-validator';
import { Public, Roles } from '../../common/auth';
import type { AuthenticatedRequest } from '../../common/auth';
import { PrismaService } from '../core/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

class PaginationDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsString() @MaxLength(100) keyword?: string;
}

const auditActionLabels: Readonly<Record<string, string>> = {
  ADMIN_LOGIN: 'เข้าสู่ระบบหลังบ้าน',
  ADMIN_LOGIN_FAILED: 'พยายามเข้าสู่ระบบไม่สำเร็จ',
  ADMIN_LOGOUT: 'ออกจากระบบหลังบ้าน',
  ADMIN_PASSWORD_CHANGED: 'เปลี่ยนรหัสผ่านของตนเอง',
  ADMIN_CREATED: 'เพิ่มบัญชีเจ้าหน้าที่',
  ADMIN_UPDATED: 'แก้ไขข้อมูลบัญชีเจ้าหน้าที่',
  ADMIN_DELETED: 'ลบบัญชีเจ้าหน้าที่',
  ADMIN_STATUS_CHANGED: 'เปลี่ยนสถานะบัญชีเจ้าหน้าที่',
  ADMIN_PASSWORD_RESET: 'ตั้งรหัสผ่านใหม่ให้เจ้าหน้าที่',
  INCIDENT_ACCEPTED: 'รับแจ้งเหตุเพื่อดำเนินการ',
  INCIDENT_COMPLETED: 'ปิดงานเหตุการณ์',
  INCIDENT_NOTE_CREATED: 'เพิ่มบันทึกในเหตุการณ์',
  SETTINGS_UPDATED: 'ปรับปรุงการตั้งค่าระบบ',
};

const auditEntityLabels: Readonly<Record<string, string>> = {
  AdminUser: 'บัญชีเจ้าหน้าที่',
  Incident: 'รายการแจ้งเหตุ',
  IncidentNote: 'บันทึกเหตุการณ์',
  SystemSetting: 'การตั้งค่าระบบ',
  Auth: 'บัญชีผู้ใช้งาน',
};

function matchingAuditValues(
  labels: Readonly<Record<string, string>>,
  keyword: string,
) {
  const normalizedKeyword = keyword.toLocaleLowerCase('th');
  return Object.entries(labels)
    .filter(
      ([value, label]) =>
        value.toLocaleLowerCase('en').includes(normalizedKeyword) ||
        label.toLocaleLowerCase('th').includes(normalizedKeyword),
    )
    .map(([value]) => value);
}

class DashboardDateRangeDto {
  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateTo?: string;
}

class DashboardRecentIncidentsDto extends DashboardDateRangeDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  keyword?: string;

  @IsOptional()
  @IsEnum(IncidentStatus)
  status?: IncidentStatus;
}

function dashboardDateFilter(
  query: DashboardDateRangeDto,
): Prisma.DateTimeFilter | undefined {
  const from = query.dateFrom
    ? new Date(`${query.dateFrom}T00:00:00+07:00`)
    : undefined;
  const to = query.dateTo
    ? new Date(`${query.dateTo}T00:00:00+07:00`)
    : undefined;

  if (from && to && from > to) {
    throw new BadRequestException({
      code: 'INVALID_DASHBOARD_DATE_RANGE',
      message: 'วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด',
    });
  }

  if (to) {
    to.setUTCDate(to.getUTCDate() + 1);
  }

  return from || to ? { gte: from, lt: to } : undefined;
}

class AdminUserDto {
  @IsString() @MinLength(3) @MaxLength(100) username!: string;
  @IsString() @MinLength(2) @MaxLength(191) fullName!: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @IsUUID() positionId!: string;
  @IsString() @MinLength(12) @MaxLength(128) password!: string;
}

class StaffPositionDto {
  @IsString() @MinLength(2) @MaxLength(100) name!: string;
}

class RegisterDeviceDto {
  @IsString() @MinLength(20) @MaxLength(512) token!: string;
  @IsEnum(PlatformType) platform!: PlatformType;
}

class UpdateAdminUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(191) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MaxLength(32) phone?: string;
  @IsOptional() @IsEnum(AdminRole) role?: AdminRole;
  @IsOptional() @IsUUID() positionId?: string;
}

class UpdateUserStatusDto {
  @IsEnum(UserStatus) status!: UserStatus;
}

class ResetPasswordDto {
  @IsString() @MinLength(12) @MaxLength(128) newPassword!: string;
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

  @Get('dashboard/summary')
  async summary(@Query() query: DashboardDateRangeDto) {
    const reportedAt = dashboardDateFilter(query);
    const rangeWhere: Prisma.IncidentWhereInput = reportedAt
      ? { reportedAt }
      : {};
    const now = new Date();
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const week = new Date(today);
    week.setUTCDate(week.getUTCDate() - 6);
    const previousWeek = new Date(week);
    previousWeek.setUTCDate(previousWeek.getUTCDate() - 7);
    const [
      total,
      waiting,
      inProgress,
      completed,
      cancelled,
      todayCount,
      thisWeek,
      previousWeekCount,
    ] = await this.prisma.$transaction([
      this.prisma.incident.count({ where: rangeWhere }),
      this.prisma.incident.count({
        where: { ...rangeWhere, status: 'RECEIVED' },
      }),
      this.prisma.incident.count({
        where: {
          ...rangeWhere,
          status: { in: ['FORWARDED', 'INSPECTING', 'IN_PROGRESS'] },
        },
      }),
      this.prisma.incident.count({
        where: { ...rangeWhere, status: 'COMPLETED' },
      }),
      this.prisma.incident.count({
        where: { ...rangeWhere, status: { in: ['CANCELLED', 'REJECTED'] } },
      }),
      this.prisma.incident.count({ where: { reportedAt: { gte: today } } }),
      this.prisma.incident.count({ where: { reportedAt: { gte: week } } }),
      this.prisma.incident.count({
        where: { reportedAt: { gte: previousWeek, lt: week } },
      }),
    ]);
    const percentageChange =
      previousWeekCount === 0
        ? thisWeek === 0
          ? 0
          : 100
        : Number(
            (
              ((thisWeek - previousWeekCount) / previousWeekCount) *
              100
            ).toFixed(1),
          );
    return {
      total,
      waiting,
      inProgress,
      completed,
      cancelled,
      today: todayCount,
      thisWeek,
      percentageChange,
    };
  }

  @Get('dashboard/recent-incidents')
  recent(@Query() query: DashboardRecentIncidentsDto) {
    const reportedAt = dashboardDateFilter(query);
    const keyword = query.keyword?.trim();
    const where: Prisma.IncidentWhereInput = {
      ...(reportedAt ? { reportedAt } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(keyword
        ? {
            OR: [
              { caseCode: { contains: keyword } },
              { reporterName: { contains: keyword } },
              { reporterPhone: { contains: keyword } },
              { description: { contains: keyword } },
              { address: { contains: keyword } },
              { province: { contains: keyword } },
            ],
          }
        : {}),
    };
    return this.prisma.incident.findMany({
      where: Object.keys(where).length ? where : undefined,
      take: 5,
      orderBy: { reportedAt: 'desc' },
      include: {
        images: { take: 1 },
        assignedAdminUser: { select: { id: true, fullName: true } },
      },
    });
  }

  @Get('dashboard/incidents-by-status')
  byStatus() {
    return this.prisma.incident.groupBy({ by: ['status'], _count: true });
  }

  @Get('dashboard/incidents-by-type')
  byType() {
    return this.prisma.incident.groupBy({ by: ['type'], _count: true });
  }

  @Get('dashboard/incidents-by-date')
  async byDate(@Query('days') rawDays?: string) {
    const days = Math.min(90, Math.max(1, Number(rawDays ?? 30)));
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - days + 1);
    from.setUTCHours(0, 0, 0, 0);
    const rows = await this.prisma.$queryRaw<
      Array<{ date: Date; total: bigint }>
    >(
      Prisma.sql`
        SELECT DATE(reportedAt) AS date, COUNT(*) AS total
        FROM Incident
        WHERE reportedAt >= ${from}
        GROUP BY DATE(reportedAt)
        ORDER BY date ASC
      `,
    );
    return rows.map((row) => ({
      date: row.date,
      total: Number(row.total),
    }));
  }

  @Get('users')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async users(@Query() query: PaginationDto) {
    const where: Prisma.AdminUserWhereInput = query.keyword
      ? {
          OR: [
            { username: { contains: query.keyword } },
            { fullName: { contains: query.keyword } },
            { email: { contains: query.keyword } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.adminUser.findMany({
        where,
        omit: { passwordHash: true },
        include: { position: true },
        orderBy: { fullName: 'asc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.adminUser.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get('staff-positions')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  staffPositions() {
    return this.prisma.staffPosition.findMany({ orderBy: { name: 'asc' } });
  }

  @Post('staff-positions')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async createStaffPosition(
    @Req() req: AuthenticatedRequest,
    @Body() dto: StaffPositionDto,
  ) {
    const name = dto.name.trim();
    if (name.length < 2)
      throw new BadRequestException('กรุณาระบุชื่อตำแหน่งอย่างน้อย 2 ตัวอักษร');
    const existing = await this.prisma.staffPosition.findUnique({
      where: { name },
    });
    if (existing) throw new BadRequestException('มีชื่อตำแหน่งนี้อยู่แล้ว');
    return this.prisma.$transaction(async (tx) => {
      const position = await tx.staffPosition.create({ data: { name } });
      await tx.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'STAFF_POSITION_CREATED',
          entityType: 'StaffPosition',
          entityId: position.id,
          newValue: { name: position.name },
        },
      });
      return position;
    });
  }

  @Post('users')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async createUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: AdminUserDto,
  ) {
    const role = dto.role ?? AdminRole.OFFICER;
    this.assertManageableRole(req, role);
    await this.assertPositionExists(dto.positionId);
    const { password } = dto;
    const data = {
      username: dto.username,
      fullName: dto.fullName,
      email: dto.email,
      phone: dto.phone,
      positionId: dto.positionId,
    };
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.create({
        data: { ...data, role, passwordHash: await argon2.hash(password) },
        omit: { passwordHash: true },
        include: { position: true },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'ADMIN_CREATED',
          entityType: 'AdminUser',
          entityId: user.id,
          newValue: {
            username: user.username,
            role: user.role,
            positionId: user.positionId,
          },
        },
      });
      return user;
    });
  }

  @Get('users/:id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async user(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const user = await this.prisma.adminUser.findUnique({
      where: { id },
      omit: { passwordHash: true },
      include: { position: true },
    });
    if (!user) throw new NotFoundException('ไม่พบบัญชีเจ้าหน้าที่');
    this.assertManageableRole(req, user.role, true);
    return user;
  }

  @Patch('users/:id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async updateUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    const current = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('ไม่พบบัญชีเจ้าหน้าที่');
    this.assertManageableRole(req, current.role);
    if (dto.role) this.assertManageableRole(req, dto.role);
    if (dto.positionId) await this.assertPositionExists(dto.positionId);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.update({
        where: { id },
        data: dto,
        omit: { passwordHash: true },
        include: { position: true },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'ADMIN_UPDATED',
          entityType: 'AdminUser',
          entityId: id,
          oldValue: {
            role: current.role,
            status: current.status,
            positionId: current.positionId,
          },
          newValue: {
            role: user.role,
            status: user.status,
            positionId: user.positionId,
          },
        },
      });
      return user;
    });
  }

  @Patch('users/:id/status')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async userStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const current = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('ไม่พบบัญชีเจ้าหน้าที่');
    if (id === req.user.sub && dto.status !== UserStatus.ACTIVE) {
      throw new BadRequestException('ไม่สามารถปิดใช้งานบัญชีของตนเอง');
    }
    this.assertManageableRole(req, current.role);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.adminUser.update({
        where: { id },
        data: { status: dto.status },
        omit: { passwordHash: true },
      });
      if (dto.status !== UserStatus.ACTIVE) {
        await tx.refreshToken.updateMany({
          where: { ownerType: 'ADMIN', ownerId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'ADMIN_STATUS_CHANGED',
          entityType: 'AdminUser',
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: dto.status },
        },
      });
      return user;
    });
  }

  @Delete('users/:id')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async deleteUser(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const current = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('ไม่พบบัญชีเจ้าหน้าที่');
    if (id === req.user.sub) {
      throw new BadRequestException('ไม่สามารถลบบัญชีของตนเอง');
    }
    this.assertManageableRole(req, current.role);
    const references = await this.prisma.$transaction([
      this.prisma.incident.count({ where: { assignedAdminUserId: id } }),
      this.prisma.incidentStatusHistory.count({
        where: { changedByAdminUserId: id },
      }),
      this.prisma.incidentNote.count({ where: { adminUserId: id } }),
      this.prisma.incidentAssignment.count({
        where: {
          OR: [{ assignedToAdminUserId: id }, { assignedByAdminUserId: id }],
        },
      }),
      this.prisma.notification.count({ where: { adminUserId: id } }),
      this.prisma.auditLog.count({ where: { adminUserId: id } }),
      this.prisma.systemSetting.count({ where: { updatedByAdminUserId: id } }),
    ]);
    if (references.some((count) => count > 0)) {
      throw new BadRequestException({
        code: 'ADMIN_USER_IN_USE',
        message: 'บัญชีนี้มีประวัติการใช้งาน กรุณาปิดใช้งานแทนการลบ',
      });
    }
    await this.prisma.$transaction([
      this.prisma.refreshToken.deleteMany({
        where: { ownerType: 'ADMIN', ownerId: id },
      }),
      this.prisma.adminUser.delete({ where: { id } }),
      this.prisma.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'ADMIN_DELETED',
          entityType: 'AdminUser',
          entityId: id,
          oldValue: {
            username: current.username,
            role: current.role,
            status: current.status,
          },
        },
      }),
    ]);
    return { deleted: true };
  }

  @Post('users/:id/reset-password')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async resetPassword(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ResetPasswordDto,
  ) {
    const current = await this.prisma.adminUser.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('ไม่พบบัญชีเจ้าหน้าที่');
    this.assertManageableRole(req, current.role);
    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.$transaction([
      this.prisma.adminUser.update({
        where: { id },
        data: { passwordHash },
      }),
      this.prisma.refreshToken.updateMany({
        where: { ownerType: 'ADMIN', ownerId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      this.prisma.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'ADMIN_PASSWORD_RESET',
          entityType: 'AdminUser',
          entityId: id,
        },
      }),
    ]);
    return { reset: true };
  }

  @Get('audit-logs')
  @Roles(AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR)
  async audit(@Query() query: PaginationDto) {
    const keyword = query.keyword?.trim();
    const actionMatches = keyword
      ? matchingAuditValues(auditActionLabels, keyword)
      : [];
    const entityMatches = keyword
      ? matchingAuditValues(auditEntityLabels, keyword)
      : [];
    const filters: Prisma.AuditLogWhereInput[] = keyword
      ? [
          { action: { contains: keyword } },
          { entityType: { contains: keyword } },
          { entityId: { contains: keyword } },
          { adminUser: { is: { fullName: { contains: keyword } } } },
        ]
      : [];
    if (actionMatches.length) filters.push({ action: { in: actionMatches } });
    if (entityMatches.length)
      filters.push({ entityType: { in: entityMatches } });
    const where: Prisma.AuditLogWhereInput = keyword ? { OR: filters } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
        include: { adminUser: { select: { fullName: true } } },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get('settings')
  settings() {
    return this.prisma.systemSetting.findMany({ orderBy: { key: 'asc' } });
  }

  @Patch('settings')
  @Roles(AdminRole.SUPER_ADMIN)
  async settingsUpdate(
    @Req() req: AuthenticatedRequest,
    @Body() values: Record<string, Prisma.InputJsonValue>,
  ) {
    const allowedKeys = new Set([
      'emergencyContact',
      'announcement',
      'retentionDays',
    ]);
    const entries = Object.entries(values);
    if (
      !entries.length ||
      entries.some(
        ([key, value]) =>
          !allowedKeys.has(key) || JSON.stringify(value).length > 10_000,
      )
    ) {
      throw new BadRequestException('มีการตั้งค่าที่ไม่อนุญาต');
    }
    return this.prisma.$transaction(async (tx) => {
      const updated = [];
      for (const [key, value] of entries) {
        updated.push(
          await tx.systemSetting.upsert({
            where: { key },
            create: { key, value, updatedByAdminUserId: req.user.sub },
            update: { value, updatedByAdminUserId: req.user.sub },
          }),
        );
      }
      await tx.auditLog.create({
        data: {
          adminUserId: req.user.sub,
          action: 'SETTINGS_UPDATED',
          entityType: 'SystemSetting',
          newValue: { keys: entries.map(([key]) => key) },
        },
      });
      return updated;
    });
  }

  private async assertPositionExists(positionId: string) {
    const position = await this.prisma.staffPosition.findUnique({
      where: { id: positionId },
      select: { id: true },
    });
    if (!position) throw new BadRequestException('ไม่พบตำแหน่งที่เลือก');
  }

  private assertManageableRole(
    req: AuthenticatedRequest,
    role: AdminRole,
    readOnly = false,
  ) {
    if (
      req.user.role === AdminRole.SUPERVISOR &&
      role !== AdminRole.OFFICER &&
      !(readOnly && role === AdminRole.VIEWER)
    ) {
      throw new BadRequestException({
        code: 'PERMISSION_DENIED',
        message: 'หัวหน้าศูนย์จัดการได้เฉพาะบัญชีเจ้าหน้าที่',
      });
    }
  }
}

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  @Get('notifications')
  async list(@Req() req: AuthenticatedRequest, @Query() query: PaginationDto) {
    const where = this.ownerWhere(req);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      items,
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  @Get('notifications/unread-count')
  async unreadCount(@Req() req: AuthenticatedRequest) {
    return {
      count: await this.prisma.notification.count({
        where: { ...this.ownerWhere(req), isRead: false },
      }),
    };
  }

  @Patch('notifications/:id/read')
  async read(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.prisma.notification.updateMany({
      where: { id, ...this.ownerWhere(req) },
      data: { isRead: true, readAt: new Date() },
    });
    if (!result.count) throw new NotFoundException('ไม่พบการแจ้งเตือน');
    this.emitRead(req, { id });
    return { read: true };
  }

  @Patch('notifications/read-all')
  async readAll(@Req() req: AuthenticatedRequest) {
    const result = await this.prisma.notification.updateMany({
      where: { ...this.ownerWhere(req), isRead: false },
      data: { isRead: true, readAt: new Date() },
    });
    this.emitRead(req, { all: true });
    return { updated: result.count };
  }

  @Delete('notifications/:id')
  async remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    const result = await this.prisma.notification.deleteMany({
      where: { id, ...this.ownerWhere(req) },
    });
    if (!result.count) throw new NotFoundException('ไม่พบการแจ้งเตือน');
    if (req.user.kind === 'admin') {
      this.realtime.emitAdmin(req.user.sub, 'notification.deleted', { id });
    } else {
      this.realtime.emitCitizen(req.user.sub, 'notification.deleted', { id });
    }
    return { deleted: true };
  }

  @Post('devices/register')
  async device(
    @Req() req: AuthenticatedRequest,
    @Body() dto: RegisterDeviceDto,
  ) {
    if (req.user.kind !== 'citizen') {
      throw new BadRequestException('รองรับการลงทะเบียนอุปกรณ์ประชาชนเท่านั้น');
    }
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

  @Delete('devices/:id')
  async removeDevice(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    const result = await this.prisma.deviceToken.deleteMany({
      where: { id, citizenUserId: req.user.sub },
    });
    if (!result.count) throw new NotFoundException('ไม่พบอุปกรณ์');
    return { deleted: true };
  }

  private ownerWhere(req: AuthenticatedRequest): Prisma.NotificationWhereInput {
    return req.user.kind === 'admin'
      ? { adminUserId: req.user.sub }
      : { citizenUserId: req.user.sub };
  }

  private emitRead(req: AuthenticatedRequest, payload: unknown) {
    if (req.user.kind === 'admin') {
      this.realtime.emitAdmin(req.user.sub, 'notification.read', payload);
    } else {
      this.realtime.emitCitizen(req.user.sub, 'notification.read', payload);
    }
  }
}

@ApiTags('System')
@Controller()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('ready')
  async ready() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: 'ready' };
  }
}
