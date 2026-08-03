import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, computed, signal } from '@angular/core';
import { ApiService } from '../../core/api.service';
import { Page, Pagination } from '../../core/models';

interface AuditItem {
  id: string;
  createdAt: string;
  action: string;
  entityType: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  adminUser?: { fullName: string };
}

@Component({
  standalone: true,
  imports: [DatePipe],
  templateUrl: './audit.html',
  styleUrl: './audit.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuditComponent implements OnInit {
  readonly pageSize = 10;
  readonly items = signal<AuditItem[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly pagination = signal<Pagination>({
    page: 1,
    limit: this.pageSize,
    total: 0,
    totalPages: 0,
  });
  readonly visiblePages = computed(() => {
    const { page, totalPages } = this.pagination();
    if (totalPages <= 5) return Array.from({ length: totalPages }, (_, index) => index + 1);
    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
    return Array.from({ length: 5 }, (_, index) => start + index);
  });
  readonly showLeadingEllipsis = computed(() => this.visiblePages()[0] > 1);
  readonly showTrailingEllipsis = computed(() => {
    const pages = this.visiblePages();
    return pages[pages.length - 1] < this.pagination().totalPages;
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load(page = this.pagination().page) {
    this.loading.set(true);
    this.api
      .get<Page<AuditItem>>('admin/audit-logs', {
        page: String(page),
        limit: String(this.pageSize),
      })
      .subscribe({
        next: (result) => {
          this.items.set(result.items);
          this.pagination.set(result.pagination);
          this.loading.set(false);
        },
        error: () => {
          this.error.set('ไม่สามารถโหลดประวัติการดำเนินการได้');
          this.loading.set(false);
        },
      });
  }

  selectPage(page: number) {
    if (page < 1 || page > this.pagination().totalPages || page === this.pagination().page) return;
    this.load(page);
  }

  actionLabel(action: string) {
    const labels: Record<string, string> = {
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
    return labels[action] ?? 'ดำเนินการในระบบ';
  }

  informationLabel(audit: AuditItem) {
    const entities: Record<string, string> = {
      AdminUser: 'บัญชีเจ้าหน้าที่',
      Incident: 'รายการแจ้งเหตุ',
      IncidentNote: 'บันทึกเหตุการณ์',
      SystemSetting: 'การตั้งค่าระบบ',
      Auth: 'บัญชีผู้ใช้งาน',
    };
    const entityName = entities[audit.entityType] ?? 'ข้อมูลในระบบ';
    const entityReference = audit.entityId
      ? `${entityName} รหัส ${audit.entityId.slice(0, 8)}`
      : entityName;
    const oldStatus = this.statusLabel(this.textValue(audit.oldValue, 'status'));
    const newStatus = this.statusLabel(this.textValue(audit.newValue, 'status'));
    const oldRole = this.roleLabel(this.textValue(audit.oldValue, 'role'));
    const newRole = this.roleLabel(this.textValue(audit.newValue, 'role'));

    switch (audit.action) {
      case 'ADMIN_LOGIN_FAILED': {
        const username = this.textValue(audit.newValue, 'username');
        return username ? `ชื่อผู้ใช้ ${username}` : entityReference;
      }
      case 'ADMIN_CREATED': {
        const username = this.textValue(audit.newValue, 'username');
        return [
          username ? `ชื่อผู้ใช้ ${username}` : entityReference,
          newRole && `บทบาท ${newRole}`,
        ]
          .filter(Boolean)
          .join(' · ');
      }
      case 'ADMIN_UPDATED': {
        const changes = [
          oldRole && newRole && oldRole !== newRole ? `บทบาท ${oldRole} → ${newRole}` : '',
          oldStatus && newStatus && oldStatus !== newStatus
            ? `สถานะ ${oldStatus} → ${newStatus}`
            : '',
        ].filter(Boolean);
        return changes.length ? `${entityReference} · ${changes.join(' · ')}` : entityReference;
      }
      case 'ADMIN_STATUS_CHANGED':
        return oldStatus && newStatus
          ? `${entityReference} · สถานะ ${oldStatus} → ${newStatus}`
          : entityReference;
      case 'INCIDENT_ACCEPTED':
      case 'INCIDENT_COMPLETED':
        return oldStatus && newStatus
          ? `${entityReference} · สถานะ ${oldStatus} → ${newStatus}`
          : entityReference;
      case 'INCIDENT_NOTE_CREATED': {
        const visibleToCitizen = audit.newValue?.['isVisibleToCitizen'];
        if (typeof visibleToCitizen !== 'boolean') return entityReference;
        return `${entityReference} · ${visibleToCitizen ? 'แสดงบันทึกให้ประชาชนเห็น' : 'บันทึกสำหรับเจ้าหน้าที่เท่านั้น'}`;
      }
      case 'SETTINGS_UPDATED': {
        const keys = audit.newValue?.['keys'];
        if (!Array.isArray(keys)) return entityReference;
        const settingLabels: Record<string, string> = {
          emergencyContact: 'ข้อมูลติดต่อฉุกเฉิน',
          announcement: 'ข้อความประกาศ',
          retentionDays: 'ระยะเวลาเก็บข้อมูล',
        };
        const labels = keys
          .filter((key): key is string => typeof key === 'string')
          .map((key) => settingLabels[key] ?? key);
        return labels.length ? `แก้ไข ${labels.join(', ')}` : entityReference;
      }
      default:
        return entityReference;
    }
  }

  private textValue(value: Record<string, unknown> | undefined, key: string) {
    const item = value?.[key];
    return typeof item === 'string' ? item : undefined;
  }

  private roleLabel(role?: string) {
    const labels: Record<string, string> = {
      SUPER_ADMIN: 'ผู้ดูแลระบบสูงสุด',
      SUPERVISOR: 'หัวหน้าศูนย์',
      OFFICER: 'เจ้าหน้าที่ปฏิบัติการ',
      VIEWER: 'ผู้ดูข้อมูล',
    };
    return role ? (labels[role] ?? role) : undefined;
  }

  private statusLabel(status?: string) {
    const labels: Record<string, string> = {
      ACTIVE: 'เปิดใช้งาน',
      INACTIVE: 'ปิดใช้งาน',
      SUSPENDED: 'ระงับใช้งาน',
      WAITING: 'รอดำเนินการ',
      IN_PROGRESS: 'กำลังดำเนินการ',
      COMPLETED: 'เสร็จสิ้น',
      CANCELLED: 'ยกเลิก',
    };
    return status ? (labels[status] ?? status) : undefined;
  }

  rangeStart() {
    const { page, limit, total } = this.pagination();
    return total ? (page - 1) * limit + 1 : 0;
  }

  rangeEnd() {
    const { page, limit, total } = this.pagination();
    return Math.min(page * limit, total);
  }
}
