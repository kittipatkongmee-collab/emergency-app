import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, Summary } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { environment } from '../../../environments/environment';

@Component({
  standalone: true,
  imports: [DatePipe, RouterLink],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent implements OnInit, OnDestroy {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly summary = signal<Summary | null>(null);
  readonly incidents = signal<Incident[]>([]);
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
    if (showLoading) this.loading.set(true);
    this.error.set('');
    forkJoin({
      summary: this.api.get<Summary>('admin/dashboard/summary'),
      incidents: this.api.get<Incident[]>('admin/dashboard/recent-incidents'),
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

  value(key: keyof Summary) {
    return this.summary()?.[key] ?? 0;
  }

  statusLabel(status: string) {
    return (
      {
        RECEIVED: 'รับแจ้งแล้ว',
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
