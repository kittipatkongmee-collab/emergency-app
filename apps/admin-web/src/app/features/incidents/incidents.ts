import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../core/api.service';
import { IncidentPage } from '../../core/models';

@Component({
  standalone: true,
  imports: [DatePipe, ReactiveFormsModule, RouterLink],
  templateUrl: './incidents.html',
  styleUrl: './incidents.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentsComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal('');
  readonly result = signal<IncidentPage | null>(null);
  readonly filters = new FormGroup({
    dateFrom: new FormControl('', { nonNullable: true }),
    dateTo: new FormControl('', { nonNullable: true }),
    keyword: new FormControl('', { nonNullable: true }),
    type: new FormControl('', { nonNullable: true }),
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.load();
  }

  load(page = 1) {
    this.loading.set(true);
    this.error.set('');
    const value = this.filters.getRawValue();
    const query = Object.fromEntries(
      Object.entries({ ...value, page: String(page), limit: '20' }).filter(([, item]) => item),
    );
    this.api.get<IncidentPage>('admin/incidents', query).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดรายการแจ้งเหตุได้');
        this.loading.set(false);
      },
    });
  }

  typeLabel(type: string): string {
    return (
      {
        AIRCRAFT_ACCIDENT: 'อากาศยานประสบภัย',
        DISASTER_RELIEF: 'ช่วยเหลือบรรเทาสาธารณภัย',
      }[type] ?? type
    );
  }

  statusLabel(status: string): string {
    return (
      {
        RECEIVED: 'รับแจ้งแล้ว',
        FORWARDED: 'ส่งต่อเจ้าหน้าที่',
        INSPECTING: 'กำลังตรวจสอบ',
        IN_PROGRESS: 'กำลังดำเนินการ',
        COMPLETED: 'ภารกิจสำเร็จ',
        CANCELLED: 'ยกเลิก',
        REJECTED: 'ปฏิเสธ',
      }[status] ?? status
    );
  }
}
