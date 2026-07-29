import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AdminRole, IncidentStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../core/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { PushNotificationService } from './push-notification.service';
import {
  AssignmentDto,
  CreateIncidentDto,
  IncidentQueryDto,
  NoteDto,
  StatusDto,
} from './incidents.dto';
import { canTransition } from '../../common/security';

const include = {
  images: true,
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedByAdminUser: { select: { fullName: true } } },
  },
  assignedAdminUser: { select: { id: true, fullName: true, role: true } },
} satisfies Prisma.IncidentInclude;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushNotificationService,
  ) {}

  async create(citizenUserId: string, dto: CreateIncidentDto) {
    const year = new Date().getUTCFullYear();
    const count = await this.prisma.incident.count({
      where: { reportedAt: { gte: new Date(`${year}-01-01T00:00:00Z`) } },
    });
    const caseCode = `CASE-${year}-${String(count + 1).padStart(5, '0')}`;
    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({
        data: {
          ...dto,
          latitude: new Prisma.Decimal(dto.latitude),
          longitude: new Prisma.Decimal(dto.longitude),
          citizenUserId,
          caseCode,
          statusHistory: {
            create: { toStatus: 'RECEIVED', note: 'ระบบรับแจ้งเหตุแล้ว' },
          },
        },
        include,
      });
      await tx.notification.create({
        data: {
          citizenUserId,
          incidentId: created.id,
          title: 'รับแจ้งเหตุแล้ว',
          message: `เลขที่ ${caseCode}`,
          type: 'INCIDENT_CREATED',
        },
      });
      return created;
    });
    this.realtime.emitAdmins('incident.created', incident);
    this.realtime.emitAdmins('dashboard.summary.changed', {});
    return incident;
  }

  mine(citizenId: string) {
    return this.prisma.incident.findMany({
      where: { citizenUserId: citizenId },
      include,
      orderBy: { reportedAt: 'desc' },
    });
  }

  async detailForCitizen(idOrCode: string, citizenId: string, byCode = false) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        ...(byCode ? { caseCode: idOrCode } : { id: idOrCode }),
        citizenUserId: citizenId,
      },
      include,
    });
    if (!incident) throw new NotFoundException('ไม่พบข้อมูลเหตุการณ์');
    return incident;
  }

  async listAdmin(
    query: IncidentQueryDto,
    principal: { sub: string; role?: AdminRole },
  ) {
    const page = Math.max(1, Number(query.page ?? 1));
    const limit = Math.min(100, Math.max(1, Number(query.limit ?? 20)));
    const where: Prisma.IncidentWhereInput = {
      status: query.status,
      type: query.type,
      assignedAdminUserId:
        principal.role === 'OFFICER' ? principal.sub : undefined,
      OR: query.keyword
        ? [
            { caseCode: { contains: query.keyword, mode: 'insensitive' } },
            { reporterName: { contains: query.keyword, mode: 'insensitive' } },
            { description: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include,
        orderBy: { reportedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.incident.count({ where }),
    ]);
    return {
      items,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async adminDetail(id: string, principal: { sub: string; role?: AdminRole }) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        ...include,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { adminUser: { select: { fullName: true } } },
        },
        assignments: true,
        citizenUser: true,
      },
    });
    if (!incident) throw new NotFoundException('ไม่พบข้อมูลเหตุการณ์');
    if (
      principal.role === 'OFFICER' &&
      incident.assignedAdminUserId !== principal.sub
    )
      throw new ForbiddenException('เหตุการณ์นี้ไม่ได้มอบหมายให้คุณ');
    return incident;
  }

  async status(id: string, adminId: string, dto: StatusDto) {
    const current = await this.prisma.incident.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('ไม่พบข้อมูลเหตุการณ์');
    if (!canTransition(current.status, dto.status)) {
      throw new BadRequestException(
        `ไม่สามารถเปลี่ยนสถานะจาก ${current.status} เป็น ${dto.status}`,
      );
    }
    const completedAt =
      dto.status === IncidentStatus.COMPLETED ? new Date() : null;
    const updated = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.update({
        where: { id },
        data: { status: dto.status, completedAt },
        include,
      });
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: current.status,
          toStatus: dto.status,
          note: dto.note,
          changedByAdminUserId: adminId,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: adminId,
          action: 'INCIDENT_STATUS_CHANGED',
          entityType: 'Incident',
          entityId: id,
          oldValue: { status: current.status },
          newValue: { status: dto.status, note: dto.note },
        },
      });
      await tx.notification.create({
        data: {
          citizenUserId: current.citizenUserId,
          incidentId: id,
          title: 'สถานะเหตุการณ์เปลี่ยนแปลง',
          message: `สถานะใหม่: ${dto.status}`,
          type: 'STATUS_CHANGED',
        },
      });
      return incident;
    });
    this.realtime.emitCitizen(
      current.citizenUserId,
      'incident.status.changed',
      updated,
    );
    this.realtime.emitAdmins('incident.updated', updated);
    await this.push.incidentStatusChanged(
      current.citizenUserId,
      current.caseCode,
      dto.status,
    );
    return updated;
  }

  async assign(id: string, adminId: string, dto: AssignmentDto) {
    const current = await this.prisma.incident.findUniqueOrThrow({
      where: { id },
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.incidentAssignment.updateMany({
        where: { incidentId: id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.incidentAssignment.create({
        data: {
          incidentId: id,
          assignedToAdminUserId: dto.assignedAdminUserId,
          assignedByAdminUserId: adminId,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: adminId,
          action: 'INCIDENT_ASSIGNED',
          entityType: 'Incident',
          entityId: id,
          oldValue: { assignedAdminUserId: current.assignedAdminUserId },
          newValue: { assignedAdminUserId: dto.assignedAdminUserId },
        },
      });
      return tx.incident.update({
        where: { id },
        data: {
          assignedAdminUserId: dto.assignedAdminUserId,
          status: current.status === 'RECEIVED' ? 'FORWARDED' : current.status,
        },
        include,
      });
    });
    this.realtime.emitAdmins('incident.assigned', updated);
    return updated;
  }

  async note(id: string, adminId: string, dto: NoteDto) {
    return this.prisma.$transaction(async (tx) => {
      const note = await tx.incidentNote.create({
        data: {
          incidentId: id,
          adminUserId: adminId,
          note: dto.note,
          isVisibleToCitizen: dto.isVisibleToCitizen ?? false,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: adminId,
          action: 'INCIDENT_NOTE_CREATED',
          entityType: 'Incident',
          entityId: id,
          newValue: { isVisibleToCitizen: note.isVisibleToCitizen },
        },
      });
      return note;
    });
  }
}
