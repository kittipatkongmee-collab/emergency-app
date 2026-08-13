import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';

interface SettingItem {
  key: string;
  value: unknown;
}

@Component({
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './settings.html',
  styleUrl: './settings.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent implements OnInit {
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly message = signal('');
  readonly form = new FormGroup({
    phone: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    hours: new FormControl('', { nonNullable: true }),
    announcement: new FormControl('', { nonNullable: true }),
  });

  constructor(private readonly api: ApiService) {}

  ngOnInit() {
    this.api.get<SettingItem[]>('admin/settings').subscribe({
      next: (items) => {
        const contact = items.find((item) => item.key === 'emergencyContact')?.value;
        if (contact && typeof contact === 'object') {
          this.form.patchValue(contact as Record<string, string>);
        }
        this.loading.set(false);
      },
      error: () => {
        this.message.set('ไม่สามารถโหลดการตั้งค่าได้');
        this.loading.set(false);
      },
    });
  }

  save() {
    if (this.form.invalid || this.saving()) return;
    this.saving.set(true);
    this.api
      .patch('admin/settings', { emergencyContact: this.form.getRawValue() })
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: () => this.message.set('บันทึกการตั้งค่าแล้ว'),
        error: () => this.message.set('บันทึกไม่สำเร็จ'),
      });
  }
}
