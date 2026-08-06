import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../core/api.service';
import { AuthService } from '../core/auth.service';
import { AdminUser } from '../core/models';
import { RealtimeService } from '../core/realtime.service';
import { ShellComponent } from './shell';

describe('ShellComponent', () => {
  it('แสดงไอคอนกระดิ่งและจำนวนการแจ้งเตือนที่ยังไม่ได้อ่านในเมนู', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of({ count: 3 }));
    const user: AdminUser = {
      id: 'admin-1',
      username: 'admin',
      fullName: 'ผู้ดูแลระบบ',
      role: 'SUPER_ADMIN',
      status: 'ACTIVE',
    };
    const auth = {
      user: signal<AdminUser | null>(user),
      logout: jasmine.createSpy('logout'),
    } as unknown as AuthService;
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on', 'disconnect']);
    realtime.on.and.returnValue(() => undefined);
    await TestBed.configureTestingModule({
      imports: [ShellComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: AuthService, useValue: auth },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ShellComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    const brandLogos = Array.from(
      element.querySelectorAll<HTMLImageElement>('.identity img, .office img'),
    );
    expect(brandLogos.length).toBe(2);
    expect(brandLogos[0].getAttribute('src')).toBe(
      'images/police-aviation-logo-transparent.png',
    );
    expect(brandLogos[0].getAttribute('alt')).toBe(
      'โลโก้หน่วยค้นหาและช่วยเหลืออากาศยานและเรือที่ประสบภัย (SRU)',
    );
    expect(brandLogos[1].getAttribute('src')).toBe('images/royal-thai-police-logo.png');
    expect(brandLogos[1].getAttribute('alt')).toBe('ตราสำนักงานตำรวจแห่งชาติ');
    expect(element.querySelector('.nav-badge')?.textContent?.trim()).toBe('3');
    const identityTitleLines = Array.from(
      element.querySelectorAll<HTMLElement>('.identity-title-line'),
    ).map((line) => line.textContent?.trim());
    expect(identityTitleLines).toEqual([
      'หน่วยค้นหาและช่วยเหลืออากาศยาน',
      'และเรือที่ประสบภัย (SRU)',
    ]);
    expect(element.querySelectorAll('.nav-icon svg').length).toBe(6);
    expect(element.querySelectorAll('.mobile-tabs a').length).toBe(4);
    expect(element.querySelector('.mobile-header-brand')).not.toBeNull();
    expect(element.textContent).not.toContain('ตั้งค่าระบบ');
    expect(element.querySelector('.user b')?.textContent?.trim()).toBe('ผู้ดูแลระบบ');
    expect(element.querySelector('.user > span')).toBeNull();
    expect(element.querySelector('.user i')).toBeNull();
    const headerNotification = element.querySelector<HTMLElement>('.header-notification');
    expect(headerNotification?.querySelector('svg')).not.toBeNull();
    expect(getComputedStyle(headerNotification!).color).toBe('rgb(207, 0, 26)');
    expect(realtime.on).toHaveBeenCalledWith('notification.read', jasmine.any(Function));
    expect(realtime.on).toHaveBeenCalledWith('notification.deleted', jasmine.any(Function));
  });
});
