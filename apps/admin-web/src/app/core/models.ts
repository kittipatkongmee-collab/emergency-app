export interface ApiEnvelope<T> {
  success: true;
  data: T;
  meta: Record<string, unknown>;
}

export interface ApiErrorEnvelope {
  success: false;
  error: { code: string; message: string; details: unknown[] };
  requestId: string;
}

export interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

export type AdminRole = 'SUPER_ADMIN' | 'SUPERVISOR' | 'OFFICER' | 'VIEWER';

export interface AdminUser {
  id: string;
  username: string;
  fullName: string;
  email?: string;
  phone?: string;
  role: AdminRole;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface Page<T> {
  items: T[];
  pagination: Pagination;
}

export interface Summary {
  total: number;
  waiting: number;
  inProgress: number;
  completed: number;
  cancelled: number;
  today: number;
  thisWeek: number;
  percentageChange: number;
}

export interface IncidentImage {
  id: string;
  imageUrl: string;
  originalName: string;
}

export interface StatusHistory {
  id: string;
  toStatus: string;
  note?: string;
  changedAt: string;
  changedByAdminUser?: { fullName: string };
}

export interface IncidentNote {
  id: string;
  note: string;
  isVisibleToCitizen: boolean;
  createdAt: string;
  adminUser?: { id: string; fullName: string };
}

export interface Incident {
  id: string;
  caseCode: string;
  reporterName: string;
  reporterPhone: string;
  type: string;
  description: string;
  latitude: string;
  longitude: string;
  address: string;
  province?: string;
  status: string;
  priority: string;
  reportedAt: string;
  images: IncidentImage[];
  statusHistory?: StatusHistory[];
  notes?: IncidentNote[];
  assignedAdminUser?: { id: string; fullName: string };
}

export type IncidentPage = Page<Incident>;

export interface NotificationItem {
  id: string;
  incidentId?: string;
  title: string;
  message: string;
  createdAt: string;
  isRead: boolean;
}
