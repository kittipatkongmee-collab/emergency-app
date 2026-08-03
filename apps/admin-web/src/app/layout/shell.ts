import {
  ChangeDetectionStrategy,
  Component,
  computed,
  HostListener,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { RealtimeService } from '../core/realtime.service';

@Component({
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ShellComponent implements OnInit, OnDestroy {
  readonly open = signal(false);
  readonly userMenuOpen = signal(false);
  readonly unread = signal(0);
  readonly now = new Intl.DateTimeFormat('th-TH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  readonly menu = computed(() => {
    const role = this.auth.user()?.role;
    const items: Array<[string, string, string, boolean]> = [
      ['⌂', 'แดชบอร์ด', '/dashboard', true],
      ['☷', 'รายการแจ้งเหตุ', '/incidents', true],
      ['⌖', 'แผนที่เหตุการณ์', '/map', true],
      ['♙', 'ผู้ใช้งาน', '/users', role === 'SUPER_ADMIN' || role === 'SUPERVISOR'],
      ['🔔', 'การแจ้งเตือน', '/notifications', true],
      ['◴', 'ประวัติการดำเนินการ', '/audit', role === 'SUPER_ADMIN' || role === 'SUPERVISOR'],
      ['⚙', 'ตั้งค่าระบบ', '/settings', role === 'SUPER_ADMIN'],
    ];
    return items.filter((item) => item[3]);
  });
  private readonly realtimeCleanups: Array<() => void> = [];

  constructor(
    readonly auth: AuthService,
    private readonly api: ApiService,
    private readonly realtime: RealtimeService,
  ) {}

  ngOnInit() {
    this.loadUnread();
    this.realtimeCleanups.push(
      this.realtime.on('notification.created', () => this.loadUnread()),
      this.realtime.on('notification.read', () => this.loadUnread()),
      this.realtime.on('notification.deleted', () => this.loadUnread()),
    );
  }

  ngOnDestroy() {
    this.realtimeCleanups.forEach((cleanup) => cleanup());
  }

  loadUnread() {
    this.api
      .get<{ count: number }>('notifications/unread-count')
      .subscribe({ next: (result) => this.unread.set(result.count) });
  }

  toggleUserMenu(event: MouseEvent) {
    event.stopPropagation();
    this.userMenuOpen.update((value) => !value);
  }

  closeMenus() {
    this.userMenuOpen.set(false);
    this.open.set(false);
  }

  @HostListener('document:click')
  closeUserMenu() {
    this.userMenuOpen.set(false);
  }

  @HostListener('document:keydown.escape')
  closeUserMenuWithKeyboard() {
    this.userMenuOpen.set(false);
  }

  hideMissingLogo(event: Event) {
    const image = event.currentTarget;
    if (image instanceof HTMLImageElement) image.hidden = true;
  }

  logout() {
    this.closeMenus();
    this.realtime.disconnect();
    this.auth.logout();
  }
}
