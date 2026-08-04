import { ThaiBuddhistDatePipe } from './thai-buddhist-date.pipe';

describe('ThaiBuddhistDatePipe', () => {
  const pipe = new ThaiBuddhistDatePipe();

  it('แสดงปีพุทธศักราชและเรียงวัน เดือน ปี', () => {
    const result = pipe.transform(new Date(2026, 7, 4, 19, 7), 'short');

    expect(result).toContain('04/08/2569');
    expect(result).toContain('19:07');
  });

  it('คืนค่าว่างเมื่อไม่มีวันที่หรือวันที่ไม่ถูกต้อง', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform('not-a-date')).toBe('');
  });
});
