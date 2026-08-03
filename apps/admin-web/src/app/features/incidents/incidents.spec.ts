import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { ApiService } from '../../core/api.service';
import { IncidentPage } from '../../core/models';
import { IncidentsComponent } from './incidents';

describe('IncidentsComponent', () => {
  const emptyPage: IncidentPage = {
    items: [],
    pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
  };

  it('แสดงตัวกรองตามลำดับ วันที่เริ่มต้น วันที่สิ้นสุด ค้นหา ปุ่มค้นหา และประเภท', async () => {
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
      const control = column.matches('input, button, select')
        ? (column as HTMLElement)
        : column.querySelector<HTMLElement>('input, button, select');
      return control?.id || control?.tagName;
    });

    expect(controls).toEqual([
      'incident-date-from',
      'incident-date-to',
      'incident-keyword',
      'BUTTON',
      'incident-type',
    ]);
    expect(element.querySelector('#incident-status')).toBeNull();
    expect(element.querySelector('#incident-priority')).toBeNull();
    expect(element.querySelector('#incident-sort')).toBeNull();
    expect(element.querySelector('#incident-order')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('admin/incidents', { page: '1', limit: '20' });
  });
});
