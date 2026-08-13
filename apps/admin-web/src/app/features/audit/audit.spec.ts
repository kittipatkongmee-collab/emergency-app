import { registerLocaleData } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuditComponent } from './audit';

describe('AuditComponent', () => {
  beforeAll(() => registerLocaleData(localeTh));

  const page = {
    items: [
      {
        id: 'audit-1',
        createdAt: '2026-08-01T06:00:00.000Z',
        action: 'INCIDENT_ACCEPTED',
        entityType: 'Incident',
        entityId: '12345678-1234-1234-1234-123456789012',
        oldValue: { status: 'WAITING' },
        newValue: { status: 'IN_PROGRESS' },
      },
    ],
    pagination: { page: 1, limit: 10, total: 35, totalPages: 4 },
  };

  function createComponent() {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(page));
    return { component: new AuditComponent(api), api };
  }

  it('โหลดประวัติครั้งละ 10 รายการและเปลี่ยนหน้าได้', () => {
    const { component, api } = createComponent();

    component.load();
    expect(api.get).toHaveBeenCalledWith('admin/audit-logs', { page: '1', limit: '10' });
    expect(component.items()).toEqual(page.items);
    expect(component.visiblePages()).toEqual([1, 2, 3, 4]);

    component.selectPage(2);
    expect(api.get).toHaveBeenCalledWith('admin/audit-logs', { page: '2', limit: '10' });
  });

  it('ค้นหาประวัติจากฐานข้อมูลและเริ่มที่หน้าแรก', () => {
    const { component, api } = createComponent();
    component.pagination.set({ page: 3, limit: 10, total: 35, totalPages: 4 });
    component.keyword.setValue('สมชาย');

    component.search();

    expect(api.get).toHaveBeenCalledWith('admin/audit-logs', {
      page: '1',
      limit: '10',
      keyword: 'สมชาย',
    });
  });

  it('แสดงการกระทำและข้อมูลเป็นภาษาไทยที่เข้าใจง่าย', () => {
    const { component } = createComponent();

    expect(component.actionLabel('INCIDENT_ACCEPTED')).toBe('รับแจ้งเหตุเพื่อดำเนินการ');
    expect(
      component.informationLabel({
        id: 'audit-1',
        createdAt: '2026-08-01T06:00:00.000Z',
        action: 'INCIDENT_ACCEPTED',
        entityType: 'Incident',
        entityId: '12345678-1234-1234-1234-123456789012',
        oldValue: { status: 'WAITING' },
        newValue: { status: 'IN_PROGRESS' },
      }),
    ).toBe('รายการแจ้งเหตุ รหัส 12345678 · สถานะ รอดำเนินการ → กำลังดำเนินการ');
  });

  it('แสดงคำอธิบายภาษาไทยและปุ่มเลือกหน้าที่ด้านล่างตาราง', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [AuditComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(AuditComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('tbody')?.textContent).toContain('รับแจ้งเหตุเพื่อดำเนินการ');
    expect(element.querySelector('tbody')?.textContent).toContain(
      'สถานะ รอดำเนินการ → กำลังดำเนินการ',
    );
    expect(element.querySelector('.pagination')?.textContent).toContain('แสดง 1–10 จาก 35 รายการ');
    expect(element.querySelectorAll('.page-button.active').length).toBe(1);
    expect(element.querySelector<HTMLInputElement>('#audit-keyword')).not.toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.audit-search button')?.textContent).toContain(
      'ค้นหา',
    );
  });
});
