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

interface NavigationItem {
  readonly label: string;
  readonly route: string;
  readonly iconPath: string;
  readonly visible: boolean;
}

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
  readonly now = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());
  readonly menu = computed(() => {
    const role = this.auth.user()?.role;
    const items: readonly NavigationItem[] = [
      {
        label: 'แดชบอร์ด',
        route: '/dashboard',
        iconPath: 'M3 13h8V3H3v10Zm0 8h8v-6H3v6Zm10 0h8V11h-8v10Zm0-18v6h8V3h-8Z',
        visible: true,
      },
      {
        label: 'รายการแจ้งเหตุ',
        route: '/incidents',
        iconPath:
          'M19 3h-4.18A3 3 0 0 0 12 1a3 3 0 0 0-2.82 2H5a2 2 0 0 0-2 2v16h18V5a2 2 0 0 0-2-2Zm-7 0a1 1 0 1 1 0 2 1 1 0 0 1 0-2Zm-2 14-4-4 1.41-1.41L10 14.17l6.59-6.58L18 9l-8 8Z',
        visible: true,
      },
      {
        label: 'แผนที่เหตุการณ์',
        route: '/map',
        iconPath:
          'M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9A.5.5 0 0 0 3 5.38V21l6-2 6 2 5.64-1.9a.5.5 0 0 0 .36-.48V3.5a.5.5 0 0 0-.5-.5ZM10 5.47l4 1.33v11.73l-4-1.33V5.47ZM5 6.82l3-1v11.36l-3 1V6.82Zm14 10.36-3 1V6.82l3-1v11.36Z',
        visible: true,
      },
      {
        label: 'ผู้ใช้งาน',
        route: '/users',
        iconPath:
          'M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3ZM8 11c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm8 2c-2 0-6 1-6 3v3h12v-3c0-2-4-3-6-3ZM8 13c-2.33 0-7 1.17-7 3.5V19h7v-3c0-.85.33-1.56.88-2.16A5.98 5.98 0 0 0 8 13Z',
        visible: role === 'SUPER_ADMIN' || role === 'SUPERVISOR',
      },
      {
        label: 'การแจ้งเตือน',
        route: '/notifications',
        iconPath:
          'M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6v-5a7 7 0 0 0-6-6.92V3a1 1 0 0 0-2 0v1.08A7 7 0 0 0 5 11v5l-2 2v1h18v-1l-2-2Z',
        visible: true,
      },
      {
        label: 'ประวัติการดำเนินการ',
        route: '/audit',
        iconPath:
          'M13 3a9 9 0 1 1-8.95 10H1l4-4 4 4H6.05A7 7 0 1 0 13 5v3l-4-4 4-4v3Zm-1 4h2v6l5 3-1 1.73-6-3.73V7Z',
        visible: role === 'SUPER_ADMIN' || role === 'SUPERVISOR',
      },
    ];
    return items.filter((item) => item.visible);
  });
  readonly bottomMenu = computed(() => {
    const primaryRoutes = new Set(['/dashboard', '/incidents', '/map', '/notifications']);
    return this.menu().filter((item) => primaryRoutes.has(item.route));
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
