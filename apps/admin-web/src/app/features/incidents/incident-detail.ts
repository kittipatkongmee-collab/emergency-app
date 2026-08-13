import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Incident } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { environment } from '../../../environments/environment';
import { ThaiBuddhistDatePipe } from '../../shared/thai-buddhist-date.pipe';

interface ImagePreview {
  url: string;
  alt: string;
}

@Component({
  standalone: true,
  imports: [ThaiBuddhistDatePipe],
  templateUrl: './incident-detail.html',
  styleUrl: './incident-detail.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IncidentDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  readonly item = signal<Incident | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly saving = signal(false);
  readonly confirmation = signal<'accept' | 'complete' | 'delete' | null>(null);
  readonly imagePreview = signal<ImagePreview | null>(null);
  readonly id = this.route.snapshot.paramMap.get('id')!;
  private cleanup?: () => void;

  get canAct(): boolean {
    return ['SUPER_ADMIN', 'SUPERVISOR', 'OFFICER'].includes(this.auth.user()?.role ?? '');
  }

  get canAccept(): boolean {
    const status = this.item()?.status;
    return this.canAct && ['RECEIVED', 'FORWARDED', 'INSPECTING'].includes(status ?? '');
  }

  get canComplete(): boolean {
    const incident = this.item();
    return (
      this.canAct &&
      incident?.status === 'IN_PROGRESS' &&
      incident.assignedAdminUser?.id === this.auth.user()?.id
    );
  }

  get canDelete(): boolean {
    return ['SUPER_ADMIN', 'SUPERVISOR'].includes(this.auth.user()?.role ?? '');
  }

  constructor(
    private readonly api: ApiService,
    private readonly sanitizer: DomSanitizer,
    private readonly realtime: RealtimeService,
    private readonly auth: AuthService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.load();
    this.cleanup = this.realtime.on('incident.updated', () => this.load(false));
  }

  ngOnDestroy() {
    this.cleanup?.();
  }

  load(showLoading = true) {
    if (showLoading) this.loading.set(true);
    this.error.set('');
    this.api.get<Incident>(`admin/incidents/${this.id}`).subscribe({
      next: (incident) => {
        this.item.set(incident);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่พบหรือไม่สามารถเปิดเหตุการณ์นี้ได้');
        this.loading.set(false);
      },
    });
  }

  mapUrl(incident: Incident): SafeResourceUrl {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    const delta = 0.01;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `${environment.mapEmbedBaseUrl}?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`,
    );
  }

  mapExternalUrl(incident: Incident): string {
    const latitude = Number(incident.latitude);
    const longitude = Number(incident.longitude);
    return `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;
  }

  mediaUrl(path: string): string {
    if (/^https?:\/\//i.test(path)) return path;
    return `${environment.mediaBaseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  openImagePreview(imageUrl: string, originalName: string) {
    this.imagePreview.set({ url: this.mediaUrl(imageUrl), alt: originalName });
  }

  closeImagePreview() {
    this.imagePreview.set(null);
  }

  @HostListener('document:keydown.escape')
  closeOverlay() {
    if (this.imagePreview()) {
      this.closeImagePreview();
      return;
    }
    this.closeConfirmation();
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

  openConfirmation(action: 'accept' | 'complete' | 'delete') {
    if (this.saving()) return;
    this.confirmation.set(action);
  }

  closeConfirmation() {
    if (!this.saving()) this.confirmation.set(null);
  }

  confirmWorkflowAction() {
    const action = this.confirmation();
    if (!action || this.saving()) return;
    this.saving.set(true);
    if (action === 'delete') {
      this.api
        .delete<{ deleted: boolean; id: string; caseCode: string }>(
          `admin/incidents/${this.id}`,
        )
        .pipe(finalize(() => this.saving.set(false)))
        .subscribe({
          next: () => void this.router.navigateByUrl('/incidents'),
          error: () => {
            this.confirmation.set(null);
            this.error.set('ไม่สามารถลบรายการแจ้งเหตุได้ กรุณาลองใหม่อีกครั้ง');
          },
        });
      return;
    }
    this.api
      .patch<Incident>(`admin/incidents/${this.id}/${action}`, {})
      .pipe(finalize(() => this.saving.set(false)))
      .subscribe({
        next: (incident) => {
          this.item.set(incident);
          this.confirmation.set(null);
          this.error.set('');
        },
        error: () => {
          this.confirmation.set(null);
          this.load(false);
          this.error.set(
            action === 'accept'
              ? 'รับแจ้งเหตุไม่สำเร็จ อาจมีเจ้าหน้าที่คนอื่นรับไปแล้ว'
              : 'ยืนยันภารกิจสำเร็จไม่สำเร็จ กรุณาตรวจสอบผู้รับผิดชอบ',
          );
        },
      });
  }

}
