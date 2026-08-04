import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NgSelectComponent } from '@ng-select/ng-select';
import { ApiService } from '../../core/api.service';
import { IncidentPage } from '../../core/models';
import { BuddhistDatepickerDirective } from '../../shared/buddhist-datepicker.directive';
import { ThaiBuddhistDatePipe } from '../../shared/thai-buddhist-date.pipe';

@Component({
  standalone: true,
  imports: [
    BuddhistDatepickerDirective,
    NgSelectComponent,
    ReactiveFormsModule,
    RouterLink,
    ThaiBuddhistDatePipe,
  ],
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
    status: new FormControl('', { nonNullable: true }),
  });
  readonly typeOptions = [
    { value: '', label: 'ทุกประเภท' },
    { value: 'AIRCRAFT_ACCIDENT', label: 'อากาศยานประสบภัย' },
    { value: 'DISASTER_RELIEF', label: 'ช่วยเหลือบรรเทาสาธารณภัย' },
  ];
  readonly statusOptions = [
    { value: '', label: 'สถานะทั้งหมด' },
    { value: 'RECEIVED', label: 'รอดำเนินการ' },
    { value: 'IN_PROGRESS', label: 'กำลังดำเนินการ' },
    { value: 'COMPLETED', label: 'ภารกิจสำเร็จ' },
  ];

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
        RECEIVED: 'รอดำเนินการ',
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
