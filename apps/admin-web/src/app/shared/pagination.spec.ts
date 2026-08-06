import { TestBed } from '@angular/core/testing';
import { PaginationComponent } from './pagination';

describe('PaginationComponent', () => {
  it('แสดงเลขหน้า 4 หน้าโดยเริ่มจากหน้าปัจจุบันและส่งหน้าที่เลือก', async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('pagination', {
      page: 2,
      limit: 10,
      total: 80,
      totalPages: 8,
    });
    fixture.detectChanges();

    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>(
        '.page-button:not(.page-arrow)',
      ),
    );
    expect(buttons.map((button) => button.textContent?.trim())).toEqual(['2', '3', '4', '5']);

    let selectedPage = 0;
    fixture.componentInstance.pageChange.subscribe((page) => (selectedPage = page));
    buttons[2]?.click();
    expect(selectedPage).toBe(4);
  });

  it('เลื่อนชุดเลขหน้ากลับมาให้ครบเมื่ออยู่หน้าสุดท้าย', async () => {
    await TestBed.configureTestingModule({ imports: [PaginationComponent] }).compileComponents();
    const fixture = TestBed.createComponent(PaginationComponent);
    fixture.componentRef.setInput('pagination', {
      page: 8,
      limit: 10,
      total: 80,
      totalPages: 8,
    });
    fixture.detectChanges();

    expect(fixture.componentInstance.visiblePages).toEqual([5, 6, 7, 8]);
  });
});
