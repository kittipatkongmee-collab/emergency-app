import { ChangeDetectionStrategy, Component, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { NotificationItem, Page } from '../../core/models';
import { ThaiBuddhistDatePipe } from '../../shared/thai-buddhist-date.pipe';

@Component({
  standalone: true,
  imports: [ThaiBuddhistDatePipe],
  templateUrl: './notifications.html',
  styleUrl: './notifications.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationsComponent implements OnInit {
  readonly items = signal<NotificationItem[]>([]);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly pendingDelete = signal<NotificationItem | null>(null);
  readonly deleteError = signal('');

  constructor(
    private readonly api: ApiService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.api.get<Page<NotificationItem>>('notifications', { limit: '100' }).subscribe({
      next: (result) => {
        this.items.set(result.items);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('ไม่สามารถโหลดการแจ้งเตือนได้');
        this.loading.set(false);
      },
    });
  }

  read(notice: NotificationItem) {
    this.api.patch(`notifications/${notice.id}/read`, {}).subscribe({ next: () => this.load() });
  }

  openIncident(notice: NotificationItem) {
    if (!notice.incidentId) return;

    const navigate = () => {
      void this.router.navigate(['/incidents', notice.incidentId]);
    };

    if (notice.isRead) {
      navigate();
      return;
    }

    this.api.patch(`notifications/${notice.id}/read`, {}).subscribe({
      next: navigate,
      error: navigate,
    });
  }

  requestRemove(notice: NotificationItem) {
    this.deleteError.set('');
    this.pendingDelete.set(notice);
  }

  cancelRemove() {
    if (this.busy()) return;
    this.pendingDelete.set(null);
    this.deleteError.set('');
  }

  confirmRemove() {
    const notice = this.pendingDelete();
    if (!notice || this.busy()) return;
    this.busy.set(true);
    this.api
      .delete<{ deleted: boolean }>(`notifications/${notice.id}`)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          this.pendingDelete.set(null);
          this.load();
        },
        error: () => this.deleteError.set('ไม่สามารถลบการแจ้งเตือนนี้ได้'),
      });
  }
}
