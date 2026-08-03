import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentPage } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { IncidentMapComponent } from './map';

describe('IncidentMapComponent', () => {
  it('แสดงหมุดเฉพาะเหตุที่ยังไม่สำเร็จและคงรายการที่สำเร็จไว้', async () => {
    const baseIncident: Incident = {
      id: 'incident-active',
      caseCode: 'CASE-001',
      reporterName: 'ผู้แจ้ง',
      reporterPhone: '0812345678',
      type: 'AIRCRAFT_ACCIDENT',
      description: 'รายละเอียด',
      latitude: '13.7563',
      longitude: '100.5018',
      address: 'กรุงเทพมหานคร',
      status: 'IN_PROGRESS',
      priority: 'NORMAL',
      reportedAt: '2026-08-01T06:00:00.000Z',
      images: [],
    };
    const completedIncident: Incident = {
      ...baseIncident,
      id: 'incident-completed',
      caseCode: 'CASE-002',
      latitude: '13.8',
      longitude: '100.6',
      status: 'COMPLETED',
    };
    const page: IncidentPage = {
      items: [baseIncident, completedIncident],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(page));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);
    await TestBed.configureTestingModule({
      imports: [IncidentMapComponent],
      providers: [
        provideRouter([]),
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentMapComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;

    expect(fixture.componentInstance.activeIncidents().length).toBe(1);
    expect(element.querySelectorAll('.map-marker').length).toBe(1);
    expect(element.querySelector('.locations article.completed')?.textContent).toContain('สำเร็จ');
    expect(realtime.on).toHaveBeenCalledWith('incident.updated', jasmine.any(Function));
  });
});
