import { registerLocaleData } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { NotificationItem } from '../../core/models';
import { NotificationsComponent } from './notifications';

describe('NotificationsComponent', () => {
  beforeAll(() => registerLocaleData(localeTh));

  const notice: NotificationItem = {
    id: 'notice-1',
    title: 'มีเหตุแจ้งใหม่',
    message: 'CASE-001',
    createdAt: '2026-08-01T06:00:00.000Z',
    isRead: false,
    incidentId: 'incident-1',
  };

  it('เปิด modal ยืนยันก่อนลบและไม่มีปุ่มอ่านทั้งหมด', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    api.get.and.returnValue(
      of({ items: [notice], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
    );
    api.delete.and.returnValue(of({ deleted: true }));
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('อ่านทั้งหมด');
    expect(element.querySelector('[role="alertdialog"]')).toBeNull();
    expect(element.querySelector('app-pagination')).not.toBeNull();
    expect(
      element.querySelector<HTMLButtonElement>('[aria-label="หน้า 1"]')?.textContent?.trim(),
    ).toBe('1');

    fixture.componentInstance.requestRemove(notice);
    fixture.detectChanges();
    expect(element.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(api.delete).not.toHaveBeenCalled();

    fixture.componentInstance.confirmRemove();
    expect(api.delete).toHaveBeenCalledWith('notifications/notice-1');
  });

  it('กดรายการแจ้งเตือนแล้วทำเครื่องหมายว่าอ่านและเปิดรายละเอียดเหตุ', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    api.get.and.returnValue(
      of({ items: [notice], pagination: { page: 1, limit: 10, total: 1, totalPages: 1 } }),
    );
    api.patch.and.returnValue(of({ read: true }));
    router.navigate.and.resolveTo(true);
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector<HTMLElement>('article')?.click();

    expect(api.patch).toHaveBeenCalledWith('notifications/notice-1/read', {});
    expect(router.navigate).toHaveBeenCalledWith(['/incidents', 'incident-1']);
  });

  it('โหลดการแจ้งเตือนหน้าละ 10 รายการเมื่อเลือกหน้า', () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    api.get.and.returnValue(
      of({ items: [notice], pagination: { page: 2, limit: 10, total: 45, totalPages: 5 } }),
    );
    const component = new NotificationsComponent(api, router);
    component.pagination.set({ page: 1, limit: 10, total: 45, totalPages: 5 });

    component.selectPage(2);

    expect(api.get).toHaveBeenCalledOnceWith('notifications', { page: '2', limit: '10' });
    expect(component.pagination().page).toBe(2);
  });

  it('แสดงเลขหน้าแจ้งเตือนครั้งละ 3 หน้าโดยเริ่มจากหน้าปัจจุบัน', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    const router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    api.get.and.returnValues(
      of({ items: [notice], pagination: { page: 1, limit: 10, total: 50, totalPages: 5 } }),
      of({ items: [notice], pagination: { page: 2, limit: 10, total: 50, totalPages: 5 } }),
    );
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [
        { provide: Router, useValue: router },
        { provide: ApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    const pageLabels = () =>
      Array.from(
        (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
          '.page-button:not(.page-arrow)',
        ),
      ).map((button) => button.textContent?.trim());

    expect(pageLabels()).toEqual(['1', '2', '3']);
    (fixture.nativeElement as HTMLElement)
      .querySelector<HTMLButtonElement>('[aria-label="หน้า 2"]')
      ?.click();
    fixture.detectChanges();
    expect(pageLabels()).toEqual(['2', '3', '4']);
    expect(api.get).toHaveBeenCalledWith('notifications', { page: '2', limit: '10' });
  });
});
