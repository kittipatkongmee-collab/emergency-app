import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, Summary } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { environment } from '../../../environments/environment';
import { BuddhistDatepickerDirective } from '../../shared/buddhist-datepicker.directive';
import { ThaiBuddhistDatePipe } from '../../shared/thai-buddhist-date.pipe';

@Component({
  standalone: true,
  imports: [BuddhistDatepickerDirective, ReactiveFormsModule, RouterLink, ThaiBuddhistDatePipe],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly summary = signal<Summary | null>(null);
  readonly incidents = signal<Incident[]>([]);
  readonly filters = new FormGroup({
    dateFrom: new FormControl('', { nonNullable: true }),
    dateTo: new FormControl('', { nonNullable: true }),
  });
  readonly cards = [
    ['total', '▣', 'แจ้งเหตุทั้งหมด'],
    ['waiting', '◷', 'รอการดำเนินการ'],
    ['inProgress', '⌖', 'กำลังดำเนินการ'],
    ['completed', '✓', 'ภารกิจสำเร็จ'],
  ] as const;
  private cleanups: Array<() => void> = [];

  constructor(
    private readonly api: ApiService,
    private readonly realtime: RealtimeService,
  ) {}

  ngOnInit() {
    this.load();
    this.cleanups = [
      this.realtime.on('incident.created', () => this.load(false)),
      this.realtime.on('dashboard.summary.changed', () => this.load(false)),
    ];
  }

  ngOnDestroy() {
    this.cleanups.forEach((cleanup) => cleanup());
  }

  load(showLoading = true) {
    const query = this.filters.getRawValue();
    if (query.dateFrom && query.dateTo && query.dateFrom > query.dateTo) {
      this.error.set('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
      this.loading.set(false);
      return;
    }
    if (showLoading) this.loading.set(true);
    this.error.set('');
    const dateQuery = Object.fromEntries(Object.entries(query).filter(([, value]) => value));
    forkJoin({
      summary: this.api.get<Summary>('admin/dashboard/summary', dateQuery),
      incidents: this.api.get<Incident[]>('admin/dashboard/recent-incidents', dateQuery),
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.incidents.set(result.incidents);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดข้อมูลแดชบอร์ดได้');
        this.loading.set(false);
      },
    });
  }

  hasActiveDateRange() {
    const { dateFrom, dateTo } = this.filters.getRawValue();
    return Boolean(dateFrom || dateTo);
  }

  value(key: keyof Summary) {
    return this.summary()?.[key] ?? 0;
  }

  statusLabel(status: string) {
    return (
      {
        RECEIVED: 'รอดำเนินการ',
        FORWARDED: 'ส่งต่อเจ้าหน้าที่',
        INSPECTING: 'กำลังตรวจสอบ',
        IN_PROGRESS: 'กำลังดำเนินการ',
        COMPLETED: 'ภารกิจสำเร็จ',
        CANCELLED: 'ยกเลิก',
      }[status] ?? status
    );
  }

  typeLabel(type: string) {
    return (
      {
        AIRCRAFT_ACCIDENT: 'อากาศยานประสบภัย',
        DISASTER_RELIEF: 'ช่วยเหลือบรรเทาสาธารณภัย',
      }[type] ?? type
    );
  }

  mediaUrl(path: string) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${environment.mediaBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }
}
