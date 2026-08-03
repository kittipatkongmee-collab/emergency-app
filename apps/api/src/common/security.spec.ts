import { canAcceptIncident, canCompleteIncident, maskPhone } from './security';

describe('security utilities', () => {
  it('masks personally identifiable phone digits', () => {
    expect(maskPhone('081-234-5678')).toBe('081-***-5678');
    expect(maskPhone('123')).toBe('***');
  });

  it('enforces the two-step incident workflow', () => {
    expect(canAcceptIncident('RECEIVED')).toBe(true);
    expect(canAcceptIncident('FORWARDED')).toBe(true);
    expect(canAcceptIncident('INSPECTING')).toBe(true);
    expect(canAcceptIncident('IN_PROGRESS')).toBe(false);
    expect(canCompleteIncident('IN_PROGRESS')).toBe(true);
    expect(canCompleteIncident('COMPLETED')).toBe(false);
  });
});
