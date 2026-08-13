import { registerLocaleData } from '@angular/common';
import localeTh from '@angular/common/locales/th';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Incident } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { IncidentDetailComponent } from './incident-detail';

registerLocaleData(localeTh);

describe('IncidentDetailComponent', () => {
  it('เปิดรูปขนาดใหญ่และไม่แสดงความสำคัญหรือข้อความผลสำเร็จซ้ำ', async () => {
    const incident: Incident = {
      id: 'incident-1',
      caseCode: 'CASE-001',
      reporterName: 'ผู้แจ้งเหตุ',
      reporterPhone: '0812345678',
      type: 'AIRCRAFT_ACCIDENT',
      description: 'รายละเอียดเหตุการณ์',
      latitude: '13.7563',
      longitude: '100.5018',
      address: 'กรุงเทพมหานคร',
      status: 'COMPLETED',
      priority: 'NORMAL',
      reportedAt: '2026-08-01T06:00:00.000Z',
      images: [
        {
          id: 'image-1',
          imageUrl: '/uploads/incident.jpg',
          originalName: 'ภาพเหตุการณ์.jpg',
        },
      ],
      statusHistory: [],
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    api.get.and.returnValue(of(incident));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    auth.user.and.returnValue(null);
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [IncidentDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: incident.id }) } },
        },
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentDetailComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.textContent).not.toContain('ความสำคัญ');
    expect(element.textContent).not.toContain('ดำเนินการและแจ้งผลให้ผู้แจ้งเหตุแล้ว');

    const imageButton = element.querySelector<HTMLButtonElement>('.gallery-image');
    imageButton?.click();
    fixture.detectChanges();

    expect(element.querySelector('.image-preview')).not.toBeNull();
    expect(element.querySelector<HTMLImageElement>('.image-preview img')?.alt).toBe(
      'ภาพเหตุการณ์.jpg',
    );

    element.querySelector<HTMLButtonElement>('.image-preview-close')?.click();
    fixture.detectChanges();
    expect(element.querySelector('.image-preview')).toBeNull();
  });

  it('จำกัดสิทธิ์และขอคำยืนยันก่อนลบรายการแจ้งเหตุ', async () => {
    const incident: Incident = {
      id: 'incident-delete-1',
      caseCode: 'CASE-2026-00001',
      reporterName: 'ผู้แจ้งเหตุ',
      reporterPhone: '0812345678',
      type: 'AIRCRAFT_ACCIDENT',
      description: 'รายละเอียดเหตุการณ์สำหรับทดสอบการลบ',
      latitude: '13.7563',
      longitude: '100.5018',
      address: 'กรุงเทพมหานคร',
      status: 'RECEIVED',
      priority: 'NORMAL',
      reportedAt: '2026-08-01T06:00:00.000Z',
      images: [],
      statusHistory: [],
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'patch', 'delete']);
    api.get.and.returnValue(of(incident));
    api.delete.and.returnValue(
      of({ deleted: true, id: incident.id, caseCode: incident.caseCode }),
    );
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);
    const auth = jasmine.createSpyObj<AuthService>('AuthService', ['user']);
    auth.user.and.returnValue({
      id: 'admin-1',
      username: 'supervisor',
      fullName: 'หัวหน้าศูนย์ทดสอบ',
      role: 'SUPERVISOR',
      status: 'ACTIVE',
    });
    const router = jasmine.createSpyObj<Router>('Router', ['navigateByUrl']);

    await TestBed.configureTestingModule({
      imports: [IncidentDetailComponent],
      providers: [
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: incident.id }) } },
        },
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        { provide: AuthService, useValue: auth },
        { provide: Router, useValue: router },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentDetailComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    element.querySelector<HTMLButtonElement>('.delete-incident')?.click();
    fixture.detectChanges();
    expect(api.delete).not.toHaveBeenCalled();
    expect(element.textContent).toContain('ยืนยันการลบรายการแจ้งเหตุ');

    element.querySelector<HTMLButtonElement>('.danger-button')?.click();
    fixture.detectChanges();
    expect(api.delete).toHaveBeenCalledOnceWith(`admin/incidents/${incident.id}`);
    expect(router.navigateByUrl).toHaveBeenCalledOnceWith('/incidents');
  });
});
