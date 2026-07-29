import { canTransition, maskPhone } from './security';

describe('security utilities', () => {
  it('masks personally identifiable phone digits', () => {
    expect(maskPhone('081-234-5678')).toBe('081-***-5678');
    expect(maskPhone('123')).toBe('***');
  });

  it('allows only forward operational status transitions', () => {
    expect(canTransition('RECEIVED', 'FORWARDED')).toBe(true);
    expect(canTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    expect(canTransition('COMPLETED', 'RECEIVED')).toBe(false);
  });
});
