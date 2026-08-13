import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentPage } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { IncidentMapComponent } from './map';

describe('IncidentMapComponent', () => {
  it('แสดงแผนที่รวมด้านบนและเลือกดูแผนที่แต่ละรายการด้วยรายการด้านข้าง', async () => {
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
    const offPageIncident: Incident = {
      ...baseIncident,
      id: 'incident-off-page',
      caseCode: 'CASE-003',
      latitude: '14.1',
      longitude: '101.2',
      status: 'RECEIVED',
    };
    const page: IncidentPage = {
      items: [baseIncident, completedIncident],
      pagination: { page: 1, limit: 6, total: 8, totalPages: 2 },
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValues(
      of([baseIncident, completedIncident, offPageIncident]),
      of(page),
      of(page),
      of([baseIncident, completedIncident, offPageIncident]),
    );
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    let updatedListener: (() => void) | undefined;
    realtime.on.and.callFake((event: string, listener: () => void) => {
      if (event === 'incident.updated') updatedListener = listener;
      return () => undefined;
    });
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

    expect(fixture.componentInstance.plottedIncidents().length).toBe(2);
    expect(element.querySelectorAll('.aggregate-map-canvas .incident-map-marker').length).toBe(2);
    expect(element.querySelectorAll('app-incident-location-map').length).toBe(1);
    expect(element.querySelectorAll('.locations article').length).toBe(2);
    expect(element.querySelector('.locations article.completed')?.textContent).toContain('สำเร็จ');
    expect(element.querySelector('.map-caption a')).toBeNull();
    expect(element.querySelector('.map-caption .selected-status')?.textContent).toContain(
      'กำลังดำเนินการ',
    );
    expect(element.querySelector('#map-incident-keyword')).toBeNull();
    expect(element.querySelector('app-pagination')).not.toBeNull();
    expect(element.querySelector('.locations app-pagination')).toBeNull();
    expect(element.querySelector('.locations-column > app-pagination')).not.toBeNull();
    expect(api.get).toHaveBeenCalledWith('admin/incidents/map-points');
    expect(api.get).toHaveBeenCalledWith('admin/incidents', { page: '1', limit: '6' });
    expect(realtime.on).toHaveBeenCalledWith('incident.updated', jasmine.any(Function));

    const listButtons = element.querySelectorAll<HTMLButtonElement>('.locations article > button');
    listButtons[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedId()).toBe('incident-completed');
    expect(element.querySelectorAll('app-incident-location-map').length).toBe(0);
    expect(element.querySelector('.item-map-state')?.textContent).toContain('ไม่แสดงหมุดบนแผนที่');

    updatedListener?.();
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.componentInstance.plottedIncidents().length).toBe(2);
    expect(element.querySelectorAll('.aggregate-map-canvas .incident-map-marker').length).toBe(2);
    expect(element.querySelectorAll('app-incident-location-map').length).toBe(0);
    expect(element.querySelectorAll('.locations article').length).toBe(2);
  });

  it('โหลดเฉพาะรายการหน้าที่เลือกโดยไม่เปลี่ยนชุดหมุดรวม', () => {
    const emptyPage: IncidentPage = {
      items: [],
      pagination: { page: 2, limit: 6, total: 24, totalPages: 4 },
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(emptyPage));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    const component = new IncidentMapComponent(api, realtime);
    component.pagination.set({ page: 1, limit: 6, total: 24, totalPages: 4 });

    component.selectPage(2);

    expect(api.get).toHaveBeenCalledWith('admin/incidents', { page: '2', limit: '6' });
    expect(api.get).not.toHaveBeenCalledWith('admin/incidents/map-points');
  });
});
