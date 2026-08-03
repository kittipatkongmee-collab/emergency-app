import { registerLocaleData } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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
  };

  it('เปิด modal ยืนยันก่อนลบและไม่มีปุ่มอ่านทั้งหมด', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    api.get.and.returnValue(
      of({ items: [notice], pagination: { page: 1, limit: 100, total: 1, totalPages: 1 } }),
    );
    api.delete.and.returnValue(of({ deleted: true }));
    await TestBed.configureTestingModule({
      imports: [NotificationsComponent],
      providers: [provideRouter([]), { provide: ApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(NotificationsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    expect(element.textContent).not.toContain('อ่านทั้งหมด');
    expect(element.querySelector('[role="alertdialog"]')).toBeNull();

    fixture.componentInstance.requestRemove(notice);
    fixture.detectChanges();
    expect(element.querySelector('[role="alertdialog"]')).not.toBeNull();
    expect(api.delete).not.toHaveBeenCalled();

    fixture.componentInstance.confirmRemove();
    expect(api.delete).toHaveBeenCalledWith('notifications/notice-1');
  });
});
