import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { IncidentPage } from '../../core/models';
import { IncidentsComponent } from './incidents';

interface FlatpickrInput extends HTMLInputElement {
  _flatpickr?: {
    setDate(date: string, triggerChange: boolean, format: string): void;
  };
}

describe('IncidentsComponent', () => {
  const emptyPage: IncidentPage = {
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };

  it('แสดงตัวกรองตามลำดับ วันที่เริ่มต้น วันที่สิ้นสุด ค้นหา ปุ่มค้นหา ประเภท และสถานะ', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(emptyPage));
    await TestBed.configureTestingModule({
      imports: [IncidentsComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const filterForm = element.querySelector<HTMLFormElement>('.filters');
    const controls = Array.from(filterForm?.children ?? []).map((column) => {
      const control = column.matches('input, button, ng-select')
        ? (column as HTMLElement)
        : column.querySelector<HTMLElement>('input, button, ng-select');
      return control?.id || control?.tagName;
    });

    expect(controls).toEqual([
      'incident-date-from',
      'incident-date-to',
      'incident-keyword',
      'BUTTON',
      'incident-type',
      'incident-status',
    ]);
    expect(fixture.componentInstance.statusOptions.map((option) => option.value)).toEqual([
      '',
      'RECEIVED',
      'IN_PROGRESS',
      'COMPLETED',
    ]);
    expect(element.querySelector('#incident-priority')).toBeNull();
    expect(element.querySelector('#incident-sort')).toBeNull();
    expect(element.querySelector('#incident-order')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('admin/incidents', { page: '1', limit: '20' });
  });

  it('ส่งประเภทและสถานะที่เลือกไปกรองรายการแจ้งเหตุ', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(emptyPage));
    await TestBed.configureTestingModule({
      imports: [IncidentsComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    fixture.componentInstance.filters.patchValue({
      type: 'DISASTER_RELIEF',
      status: 'IN_PROGRESS',
    });
    fixture.componentInstance.load();

    expect(api.get).toHaveBeenCalledWith('admin/incidents', {
      type: 'DISASTER_RELIEF',
      status: 'IN_PROGRESS',
      page: '1',
      limit: '20',
    });
  });

  it('ใช้ Flatpickr โดยแสดงวัน เดือน ปี พ.ศ. แต่ส่งค่า API เป็นวันที่มาตรฐาน', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(emptyPage));
    await TestBed.configureTestingModule({
      imports: [IncidentsComponent],
      providers: [{ provide: ApiService, useValue: api }],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const originalInput = element.querySelector<FlatpickrInput>('#incident-date-from');
    const visibleInput = element.querySelector<HTMLInputElement>(
      '.date-field input[type="text"]:not(#incident-date-from)',
    );

    originalInput?._flatpickr?.setDate('2026-08-04', true, 'Y-m-d');
    fixture.detectChanges();

    expect(originalInput?._flatpickr).toBeDefined();
    expect(visibleInput?.value).toBe('04/08/2569');
    expect(fixture.componentInstance.filters.controls.dateFrom.value).toBe('2026-08-04');
    expect(document.querySelector('.buddhist-year-label')?.textContent).toMatch(/^25\d{2}$/);
  });

  it('กำหนดสีสถานะรอดำเนินการ กำลังดำเนินการ และสำเร็จตามสถานะจริง', async () => {
    const baseIncident = {
      id: 'incident-1',
      caseCode: 'CASE-2026-00001',
      reporterName: 'ผู้แจ้ง',
      reporterPhone: '0800000000',
      type: 'AIRCRAFT_ACCIDENT',
      description: 'รายละเอียด',
      latitude: '13.7563',
      longitude: '100.5018',
      address: 'กรุงเทพมหานคร',
      priority: 'NORMAL',
      reportedAt: '2026-08-04T12:00:00.000Z',
      images: [],
    };
    const page: IncidentPage = {
      items: [
        { ...baseIncident, id: 'waiting', status: 'RECEIVED' },
        { ...baseIncident, id: 'working', status: 'IN_PROGRESS' },
        { ...baseIncident, id: 'complete', status: 'COMPLETED' },
      ],
      pagination: { page: 1, limit: 20, total: 3, totalPages: 1 },
    };
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.returnValue(of(page));
    await TestBed.configureTestingModule({
      imports: [IncidentsComponent],
      providers: [{ provide: ApiService, useValue: api }, provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(IncidentsComponent);
    fixture.detectChanges();
    const statuses = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLElement>('.status'),
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
  });
});
