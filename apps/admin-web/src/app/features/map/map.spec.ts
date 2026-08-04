import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, IncidentPage } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { IncidentLocationMapComponent } from './incident-location-map';
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
    const page: IncidentPage = {
      items: [baseIncident, completedIncident],
      pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
    };
    const completedPage: IncidentPage = {
      ...page,
      items: [{ ...baseIncident, status: 'COMPLETED' }, completedIncident],
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValues(of(page), of(completedPage));
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

    expect(fixture.componentInstance.activeIncidents().length).toBe(1);
    expect(element.querySelectorAll('.aggregate-map-canvas .incident-map-marker').length).toBe(1);
    expect(element.querySelectorAll('app-incident-location-map').length).toBe(1);
    expect(element.querySelectorAll('.locations article').length).toBe(2);
    expect(element.querySelector('.locations article.completed')?.textContent).toContain('สำเร็จ');
    expect(api.get).toHaveBeenCalledWith('admin/incidents', { page: '1', limit: '100' });
    expect(realtime.on).toHaveBeenCalledWith('incident.updated', jasmine.any(Function));

    const listButtons = element.querySelectorAll<HTMLButtonElement>('.locations article > button');
    listButtons[1].click();
    fixture.detectChanges();

    expect(fixture.componentInstance.selectedId()).toBe('incident-completed');
    expect(
      fixture.debugElement.query(By.directive(IncidentLocationMapComponent)).componentInstance
        .incident.id,
    ).toBe('incident-completed');

    updatedListener?.();
    fixture.detectChanges();
    await Promise.resolve();

    expect(fixture.componentInstance.activeIncidents().length).toBe(0);
    expect(element.querySelectorAll('.aggregate-map-canvas .incident-map-marker').length).toBe(0);
    expect(element.querySelectorAll('app-incident-location-map').length).toBe(1);
    expect(element.querySelectorAll('.locations article').length).toBe(2);
  });
});
