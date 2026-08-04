import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { Incident, Summary } from '../../core/models';
import { RealtimeService } from '../../core/realtime.service';
import { DashboardComponent } from './dashboard';

describe('DashboardComponent', () => {
  it('ไม่แสดงปุ่มล้างวันที่', async () => {
    const summary: Summary = {
      total: 0,
      waiting: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      today: 0,
      thisWeek: 0,
      percentageChange: 0,
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValues(of(summary), of([]));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.dashboard-date-actions button',
      ),
    );

    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['แสดงข้อมูล']);
  });

  it('แสดงสีสถานะเหมือนหน้ารายการแจ้งเหตุทุกสถานะ', async () => {
    const summary: Summary = {
      total: 3,
      waiting: 1,
      inProgress: 1,
      completed: 1,
      cancelled: 0,
      today: 3,
      thisWeek: 3,
      percentageChange: 0,
    };
    const baseIncident: Incident = {
      id: 'incident-1',
      caseCode: 'CASE-2026-00001',
      reporterName: 'ผู้แจ้ง',
      reporterPhone: '0800000000',
      type: 'AIRCRAFT_ACCIDENT',
      description: 'รายละเอียด',
      latitude: '13.7563',
      longitude: '100.5018',
      address: 'กรุงเทพมหานคร',
      status: 'RECEIVED',
      priority: 'NORMAL',
      reportedAt: '2026-08-04T12:00:00.000Z',
      images: [],
    };
    const incidents: Incident[] = [
      baseIncident,
      { ...baseIncident, id: 'working', status: 'IN_PROGRESS' },
      { ...baseIncident, id: 'completed', status: 'COMPLETED' },
    ];
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValues(of(summary), of(incidents));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>(
        '.incidents tbody .status',
      ),
    );

    expect(statuses.map((status) => status.dataset['status'])).toEqual([
      'RECEIVED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    expect(statuses.map((status) => getComputedStyle(status).backgroundColor)).toEqual([
      'rgb(239, 25, 49)',
      'rgb(244, 169, 0)',
      'rgb(12, 171, 77)',
    ]);
    expect(statuses.map((status) => getComputedStyle(status).color)).toEqual([
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)',
      'rgb(255, 255, 255)',
    ]);
  });

  it('ส่งช่วงวันที่เดียวกันไปกรองข้อมูลสรุปและรายการล่าสุด', async () => {
    const summary: Summary = {
      total: 0,
      waiting: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      today: 0,
      thisWeek: 0,
      percentageChange: 0,
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValues(of(summary), of([]), of(summary), of([]));
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);
    realtime.on.and.returnValue(() => undefined);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    fixture.detectChanges();
    fixture.componentInstance.filters.setValue({
      dateFrom: '2026-08-01',
      dateTo: '2026-08-04',
    });
    fixture.componentInstance.load();

    const expectedQuery = { dateFrom: '2026-08-01', dateTo: '2026-08-04' };
    expect(api.get).toHaveBeenCalledWith('admin/dashboard/summary', expectedQuery);
    expect(api.get).toHaveBeenCalledWith('admin/dashboard/recent-incidents', expectedQuery);
  });

  it('ไม่เรียก API เมื่อวันที่เริ่มต้นอยู่หลังวันที่สิ้นสุด', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    const realtime = jasmine.createSpyObj<RealtimeService>('RealtimeService', ['on']);

    await TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [
        { provide: ApiService, useValue: api },
        { provide: RealtimeService, useValue: realtime },
        provideRouter([]),
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DashboardComponent);
    const component = fixture.componentInstance;
    component.filters.setValue({ dateFrom: '2026-08-05', dateTo: '2026-08-04' });
    component.load();

    expect(api.get).not.toHaveBeenCalled();
    expect(component.error()).toBe('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  });
});
