import { IncidentStatus } from '@prisma/client';

export function canAcceptIncident(status: IncidentStatus) {
  const acceptableStatuses: IncidentStatus[] = [
    IncidentStatus.RECEIVED,
    IncidentStatus.FORWARDED,
    IncidentStatus.INSPECTING,
  ];
  return acceptableStatuses.includes(status);
}

export function canCompleteIncident(status: IncidentStatus) {
  return status === IncidentStatus.IN_PROGRESS;
}

export function maskPhone(phone: string) {
  const normalized = phone.replace(/\D/g, '');
  if (normalized.length < 7) return '***';
  return `${normalized.slice(0, 3)}-***-${normalized.slice(-4)}`;
}
