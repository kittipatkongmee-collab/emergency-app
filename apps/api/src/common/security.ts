import { IncidentStatus } from '@prisma/client';

const allowedTransitions: Record<IncidentStatus, IncidentStatus[]> = {
  RECEIVED: ['FORWARDED', 'REJECTED', 'CANCELLED'],
  FORWARDED: ['INSPECTING', 'CANCELLED'],
  INSPECTING: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

export function canTransition(from: IncidentStatus, to: IncidentStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

export function maskPhone(phone: string) {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 7) return '***';
  return `${normalized.slice(0, 3)}-***-${normalized.slice(-4)}`;
}
