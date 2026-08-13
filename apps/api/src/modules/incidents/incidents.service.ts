import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminRole,
  IncidentStatus,
  NotificationType,
  Prisma,
} from '@prisma/client';
import type { AuthPrincipal } from '../../common/auth';
import { canAcceptIncident, canCompleteIncident } from '../../common/security';
import { PrismaService } from '../core/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateIncidentDto, IncidentQueryDto, NoteDto } from './incidents.dto';
import { PushNotificationService } from './push-notification.service';
import { UploadService } from './upload.service';

const adminInclude = {
  images: true,
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedByAdminUser: { select: { id: true, fullName: true } } },
  },
  assignedAdminUser: {
    select: { id: true, fullName: true, role: true, status: true },
  },
} satisfies Prisma.IncidentInclude;

const citizenInclude = {
  images: true,
  statusHistory: {
    orderBy: { changedAt: 'asc' as const },
    include: { changedByAdminUser: { select: { fullName: true } } },
  },
  notes: {
    where: { isVisibleToCitizen: true },
    orderBy: { createdAt: 'asc' as const },
    select: {
      id: true,
      note: true,
      isVisibleToCitizen: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  assignedAdminUser: {
    select: { id: true, fullName: true, role: true },
  },
} satisfies Prisma.IncidentInclude;

@Injectable()
export class IncidentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    private readonly push: PushNotificationService,
    private readonly upload: UploadService,
  ) {}

  async create(
    citizenUserId: string,
    dto: CreateIncidentDto,
    rawIdempotencyKey?: string,
  ) {
    const idempotencyKey = rawIdempotencyKey?.trim();
    if (
      idempotencyKey &&
      (idempotencyKey.length > 100 || !/^[\w.-]+$/.test(idempotencyKey))
    ) {
      throw new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Idempotency-Key ไม่ถูกต้อง',
      });
    }
    const clientRequestId = idempotencyKey
      ? `${citizenUserId}:${idempotencyKey}`
      : undefined;
    if (clientRequestId) {
      const existing = await this.prisma.incident.findUnique({
        where: { clientRequestId },
        include: citizenInclude,
      });
      if (existing) return existing;
    }

    const year = new Date().getUTCFullYear();
    try {
      const incident = await this.prisma.$transaction(
        async (tx) => {
          const counter = await tx.caseCounter.upsert({
            where: { year },
            create: { year, lastNumber: 1 },
            update: { lastNumber: { increment: 1 } },
          });
          const caseCode = `CASE-${year}-${String(counter.lastNumber).padStart(5, '0')}`;
          const created = await tx.incident.create({
            data: {
              ...dto,
              latitude: new Prisma.Decimal(dto.latitude),
              longitude: new Prisma.Decimal(dto.longitude),
              citizenUserId,
              caseCode,
              clientRequestId,
              statusHistory: {
                create: {
                  toStatus: IncidentStatus.RECEIVED,
                  note: 'ระบบได้รับรายการและรอดำเนินการ',
                },
              },
            },
            include: citizenInclude,
          });
          await tx.notification.create({
            data: {
              citizenUserId,
              incidentId: created.id,
              title: 'รอดำเนินการ',
              message: `ระบบได้รับรายการเลขที่ ${caseCode} และกำลังรอเจ้าหน้าที่รับแจ้งเหตุ`,
              type: NotificationType.INCIDENT_CREATED,
            },
          });
          const admins = await tx.adminUser.findMany({
            where: {
              status: 'ACTIVE',
              role: { in: [AdminRole.SUPER_ADMIN, AdminRole.SUPERVISOR] },
            },
            select: { id: true },
          });
          if (admins.length) {
            await tx.notification.createMany({
              data: admins.map(({ id }) => ({
                adminUserId: id,
                incidentId: created.id,
                title: 'มีเหตุการณ์ใหม่',
                message: `${caseCode}: ${created.description}`,
                type: NotificationType.INCIDENT_CREATED,
              })),
            });
          }
          return created;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      this.realtime.emitAdmins('incident.created', incident);
      this.realtime.emitAdmins('dashboard.summary.changed', {});
      this.realtime.emitCitizen(citizenUserId, 'notification.created', {
        incidentId: incident.id,
      });
      return incident;
    } catch (error) {
      if (
        clientRequestId &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.incident.findUnique({
          where: { clientRequestId },
          include: citizenInclude,
        });
        if (existing) return existing;
      }
      throw error;
    }
  }

  async mine(citizenId: string, query: IncidentQueryDto) {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.IncidentWhereInput = {
      citizenUserId: citizenId,
      status: query.status,
      type: query.type,
      priority: query.priority,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: citizenInclude,
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

  async detailForCitizen(idOrCode: string, citizenId: string, byCode = false) {
    const incident = await this.prisma.incident.findFirst({
      where: {
        ...(byCode ? { caseCode: idOrCode } : { id: idOrCode }),
        citizenUserId: citizenId,
      },
      include: citizenInclude,
    });
    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'ไม่พบข้อมูลเหตุการณ์',
      });
    }
    return incident;
  }

  async listAdmin(query: IncidentQueryDto, principal: AuthPrincipal) {
    const page = query.page;
    const limit = query.limit;
    const where: Prisma.IncidentWhereInput = {
      status: query.status,
      type: query.type,
      priority: query.priority,
      assignedAdminUserId:
        principal.role === AdminRole.OFFICER
          ? principal.sub
          : query.assignedAdminUserId,
      province: query.province,
      reportedAt:
        query.dateFrom || query.dateTo
          ? {
              gte: query.dateFrom ? new Date(query.dateFrom) : undefined,
              lte: query.dateTo ? new Date(query.dateTo) : undefined,
            }
          : undefined,
      OR: query.keyword
        ? [
            { caseCode: { contains: query.keyword } },
            { reporterName: { contains: query.keyword } },
            { reporterPhone: { contains: query.keyword } },
            { description: { contains: query.keyword } },
            { address: { contains: query.keyword } },
            { province: { contains: query.keyword } },
          ]
        : undefined,
    };
    const sortBy = query.sortBy ?? 'reportedAt';
    const [items, total] = await this.prisma.$transaction([
      this.prisma.incident.findMany({
        where,
        include: adminInclude,
        orderBy: { [sortBy]: query.sortOrder ?? 'desc' },
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

  async listMapPoints(principal: AuthPrincipal) {
    return this.prisma.incident.findMany({
      where: {
        assignedAdminUserId:
          principal.role === AdminRole.OFFICER ? principal.sub : undefined,
      },
      select: {
        id: true,
        caseCode: true,
        latitude: true,
        longitude: true,
        address: true,
        status: true,
      },
      orderBy: { reportedAt: 'desc' },
    });
  }

  async adminDetail(id: string, principal: AuthPrincipal) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        ...adminInclude,
        notes: {
          orderBy: { createdAt: 'desc' },
          include: { adminUser: { select: { id: true, fullName: true } } },
        },
        assignments: {
          orderBy: { assignedAt: 'desc' },
          include: {
            assignedToAdminUser: { select: { id: true, fullName: true } },
            assignedByAdminUser: { select: { id: true, fullName: true } },
          },
        },
        citizenUser: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            profileImageUrl: true,
          },
        },
      },
    });
    if (!incident) {
      throw new NotFoundException({
        code: 'INCIDENT_NOT_FOUND',
        message: 'ไม่พบข้อมูลเหตุการณ์',
      });
    }
    this.assertOfficerOwnership(incident.assignedAdminUserId, principal);
    return incident;
  }

  async accept(id: string, principal: AuthPrincipal) {
    const result = await this.prisma.$transaction(async (tx) => {
      const [current, acceptingAdmin] = await Promise.all([
        tx.incident.findUnique({ where: { id } }),
        tx.adminUser.findFirst({
          where: { id: principal.sub, status: 'ACTIVE' },
          select: { id: true, fullName: true },
        }),
      ]);
      if (!current) {
        throw new NotFoundException({
          code: 'INCIDENT_NOT_FOUND',
          message: 'ไม่พบข้อมูลเหตุการณ์',
        });
      }
      if (!acceptingAdmin) {
        throw new ForbiddenException({
          code: 'ADMIN_ACCOUNT_INACTIVE',
          message: 'บัญชีเจ้าหน้าที่ไม่พร้อมใช้งาน',
        });
      }
      if (!canAcceptIncident(current.status)) {
        throw new BadRequestException({
          code: 'INCIDENT_CANNOT_BE_ACCEPTED',
          message: 'เหตุการณ์นี้ถูกรับแจ้งหรือสิ้นสุดการดำเนินการแล้ว',
        });
      }

      const updated = await tx.incident.updateMany({
        where: { id, status: current.status },
        data: {
          assignedAdminUserId: acceptingAdmin.id,
          status: IncidentStatus.IN_PROGRESS,
          completedAt: null,
        },
      });
      if (updated.count !== 1) {
        throw new BadRequestException({
          code: 'INCIDENT_ALREADY_ACCEPTED',
          message: 'มีเจ้าหน้าที่รับแจ้งเหตุนี้แล้ว กรุณาโหลดข้อมูลใหม่',
        });
      }

      await tx.incidentAssignment.updateMany({
        where: { incidentId: id, unassignedAt: null },
        data: { unassignedAt: new Date() },
      });
      await tx.incidentAssignment.create({
        data: {
          incidentId: id,
          assignedToAdminUserId: acceptingAdmin.id,
          assignedByAdminUserId: acceptingAdmin.id,
        },
      });
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: current.status,
          toStatus: IncidentStatus.IN_PROGRESS,
          note: `รับแจ้งเหตุโดย ${acceptingAdmin.fullName}`,
          changedByAdminUserId: acceptingAdmin.id,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: acceptingAdmin.id,
          action: 'INCIDENT_ACCEPTED',
          entityType: 'Incident',
          entityId: id,
          oldValue: {
            status: current.status,
            assignedAdminUserId: current.assignedAdminUserId,
          },
          newValue: {
            status: IncidentStatus.IN_PROGRESS,
            assignedAdminUserId: acceptingAdmin.id,
          },
        },
      });
      const notification = await tx.notification.create({
        data: {
          citizenUserId: current.citizenUserId,
          incidentId: id,
          title: 'เจ้าหน้าที่รับแจ้งเหตุแล้ว',
          message: `${acceptingAdmin.fullName} กำลังดำเนินการเหตุ ${current.caseCode}`,
          type: NotificationType.INCIDENT_STATUS_CHANGED,
        },
      });
      const incident = await tx.incident.findUniqueOrThrow({
        where: { id },
        include: adminInclude,
      });
      return { incident, current, notification };
    });

    this.publishWorkflowUpdate(
      result.current.citizenUserId,
      result.incident,
      result.notification,
    );
    await this.push.incidentStatusChanged(
      result.current.citizenUserId,
      result.current.caseCode,
      IncidentStatus.IN_PROGRESS,
    );
    return result.incident;
  }

  async complete(id: string, principal: AuthPrincipal) {
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.incident.findUnique({ where: { id } });
      if (!current) {
        throw new NotFoundException({
          code: 'INCIDENT_NOT_FOUND',
          message: 'ไม่พบข้อมูลเหตุการณ์',
        });
      }
      if (!canCompleteIncident(current.status)) {
        throw new BadRequestException({
          code: 'INCIDENT_CANNOT_BE_COMPLETED',
          message: 'เหตุการณ์นี้ยังไม่อยู่ระหว่างดำเนินการหรือเสร็จสิ้นแล้ว',
        });
      }
      if (current.assignedAdminUserId !== principal.sub) {
        throw new ForbiddenException({
          code: 'INCIDENT_NOT_ASSIGNEE',
          message:
            'เฉพาะเจ้าหน้าที่ผู้รับผิดชอบเท่านั้นที่ยืนยันภารกิจสำเร็จได้',
        });
      }

      const completedAt = new Date();
      const updated = await tx.incident.updateMany({
        where: {
          id,
          status: IncidentStatus.IN_PROGRESS,
          assignedAdminUserId: principal.sub,
        },
        data: { status: IncidentStatus.COMPLETED, completedAt },
      });
      if (updated.count !== 1) {
        throw new BadRequestException({
          code: 'INCIDENT_ALREADY_COMPLETED',
          message: 'สถานะเหตุการณ์เปลี่ยนแปลงแล้ว กรุณาโหลดข้อมูลใหม่',
        });
      }
      await tx.incidentStatusHistory.create({
        data: {
          incidentId: id,
          fromStatus: IncidentStatus.IN_PROGRESS,
          toStatus: IncidentStatus.COMPLETED,
          note: 'ยืนยันภารกิจสำเร็จ',
          changedByAdminUserId: principal.sub,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: principal.sub,
          action: 'INCIDENT_COMPLETED',
          entityType: 'Incident',
          entityId: id,
          oldValue: { status: IncidentStatus.IN_PROGRESS },
          newValue: {
            status: IncidentStatus.COMPLETED,
            completedAt: completedAt.toISOString(),
          },
        },
      });
      const notification = await tx.notification.create({
        data: {
          citizenUserId: current.citizenUserId,
          incidentId: id,
          title: 'ภารกิจสำเร็จ',
          message: `ดำเนินการเหตุ ${current.caseCode} เสร็จสิ้นแล้ว`,
          type: NotificationType.INCIDENT_STATUS_CHANGED,
        },
      });
      const incident = await tx.incident.findUniqueOrThrow({
        where: { id },
        include: adminInclude,
      });
      return { incident, current, notification };
    });

    this.publishWorkflowUpdate(
      result.current.citizenUserId,
      result.incident,
      result.notification,
    );
    await this.push.incidentStatusChanged(
      result.current.citizenUserId,
      result.current.caseCode,
      IncidentStatus.COMPLETED,
    );
    return result.incident;
  }

  async note(id: string, principal: AuthPrincipal, dto: NoteDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const incident = await tx.incident.findUnique({ where: { id } });
      if (!incident) {
        throw new NotFoundException({
          code: 'INCIDENT_NOT_FOUND',
          message: 'ไม่พบข้อมูลเหตุการณ์',
        });
      }
      this.assertOfficerOwnership(incident.assignedAdminUserId, principal);
      const note = await tx.incidentNote.create({
        data: {
          incidentId: id,
          adminUserId: principal.sub,
          note: dto.note,
          isVisibleToCitizen: dto.isVisibleToCitizen ?? false,
        },
      });
      await tx.auditLog.create({
        data: {
          adminUserId: principal.sub,
          action: 'INCIDENT_NOTE_CREATED',
          entityType: 'Incident',
          entityId: id,
          newValue: { isVisibleToCitizen: note.isVisibleToCitizen },
        },
      });
      const notification = note.isVisibleToCitizen
        ? await tx.notification.create({
            data: {
              citizenUserId: incident.citizenUserId,
              incidentId: id,
              title: 'มีหมายเหตุใหม่',
              message: note.note,
              type: NotificationType.INCIDENT_STATUS_CHANGED,
            },
          })
        : null;
      return { note, incident, notification };
    });
    if (result.notification) {
      this.realtime.emitCitizen(
        result.incident.citizenUserId,
        'notification.created',
        result.notification,
      );
    }
    this.realtime.emitAdmins('incident.updated', { id });
    return result.note;
  }

  async addImages(
    incidentId: string,
    citizenUserId: string,
    files: Express.Multer.File[],
  ) {
    await this.detailForCitizen(incidentId, citizenUserId);
    const existing = await this.prisma.incidentImage.count({
      where: { incidentId },
    });
    if (!files?.length) {
      throw new BadRequestException({
        code: 'FILE_LIMIT_EXCEEDED',
        message: 'กรุณาแนบรูปภาพอย่างน้อย 1 รูป',
      });
    }
    if (existing + files.length > 5) {
      throw new BadRequestException({
        code: 'FILE_LIMIT_EXCEEDED',
        message: 'แนบรูปภาพได้ไม่เกิน 5 รูปต่อเหตุการณ์',
      });
    }
    const stored: Array<{
      storageKey: string;
      imageUrl: string;
      file: Express.Multer.File;
    }> = [];
    try {
      for (const file of files) {
        stored.push({ ...(await this.upload.save(file)), file });
      }
      const images = await this.prisma.$transaction(
        stored.map(({ storageKey, imageUrl, file }) =>
          this.prisma.incidentImage.create({
            data: {
              incidentId,
              fileName: storageKey.split('/').at(-1)!,
              originalName: file.originalname,
              mimeType: file.mimetype,
              fileSize: file.size,
              storageDriver: process.env.STORAGE_DRIVER ?? 'local',
              storageKey,
              imageUrl,
            },
          }),
        ),
      );
      this.realtime.emitAdmins('incident.updated', { id: incidentId });
      return images;
    } catch (error) {
      await Promise.allSettled(
        stored.map(({ storageKey }) => this.upload.remove(storageKey)),
      );
      throw error;
    }
  }

  private assertOfficerOwnership(
    assignedAdminUserId: string | null,
    principal: AuthPrincipal,
  ) {
    if (
      principal.role === AdminRole.OFFICER &&
      assignedAdminUserId !== principal.sub
    ) {
      throw new ForbiddenException({
        code: 'INCIDENT_ACCESS_DENIED',
        message: 'เหตุการณ์นี้ไม่ได้มอบหมายให้คุณ',
      });
    }
  }

  private publishWorkflowUpdate(
    citizenUserId: string,
    incident: unknown,
    notification: unknown,
  ) {
    this.realtime.emitCitizen(
      citizenUserId,
      'incident.status.changed',
      incident,
    );
    this.realtime.emitCitizen(
      citizenUserId,
      'notification.created',
      notification,
    );
    this.realtime.emitAdmins('incident.updated', incident);
    this.realtime.emitAdmins('dashboard.summary.changed', {});
  }
}
