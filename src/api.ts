import { auth } from './lib/firebase';
import type {
  AnalyticsSummary,
  Appointment,
  CareActivity,
  CareCircleMember,
  DoseStatus,
  ElderlyProfile,
  EmergencyContact,
  FoodInstruction,
  Medication,
  MedicationFrequency,
  MedicationLog,
  NotificationItem,
  UserProfile,
  UserRole,
} from './types';

// Store auth tokens strictly in memory (never in localStorage)
let inMemoryAuthToken: string | null = null;

export function getStoredToken(): string | null {
  return inMemoryAuthToken;
}

export function setStoredToken(token: string | null) {
  inMemoryAuthToken = token;
}

async function resolveActiveToken(): Promise<string | null> {
  if (auth.currentUser) {
    try {
      const freshToken = await auth.currentUser.getIdToken();
      inMemoryAuthToken = freshToken;
      return freshToken;
    } catch {
      return inMemoryAuthToken;
    }
  }
  return inMemoryAuthToken;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await resolveActiveToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };
  if (token && !headers.Authorization) {
    headers.Authorization = `Bearer ${token}`;
  }

  const targetUrl = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const res = await fetch(targetUrl, { ...init, headers });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json?.error || `Request failed with status ${res.status}`);
  }
  return json as T;
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  profiles: ElderlyProfile[];
}

export const api = {
  health: () =>
    apiFetch<{
      ok: boolean;
      smtpConfigured: boolean;
      geminiConfigured: boolean;
    }>('/api/health'),

  firebaseLogin: (
    idToken: string,
    payload: {
      role?: UserRole;
      passcode?: string;
      relationship?: string;
      specialization?: string;
    } = {},
  ) =>
    apiFetch<AuthResponse>('/api/auth/firebase', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    }),

  register: (payload: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: UserRole;
    age?: number;
    bloodGroup?: string;
    physicianName?: string;
    physicianPhone?: string;
    passcode?: string;
    relationship?: string;
    specialization?: string;
  }) =>
    apiFetch<AuthResponse>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  login: (email: string, password: string) =>
    apiFetch<AuthResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  demoLogin: (role: UserRole) =>
    apiFetch<AuthResponse>('/api/auth/demo', {
      method: 'POST',
      body: JSON.stringify({ role }),
    }),

  me: () =>
    apiFetch<{ user: UserProfile; profiles: ElderlyProfile[] }>('/api/auth/me'),

  connectProfile: (payload: {
    passcode?: string;
    qrToken?: string;
    relationship?: string;
    specialization?: string;
  }) =>
    apiFetch<{ profile: ElderlyProfile; message: string }>('/api/profiles/connect', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  rotatePasscode: (profileId: string) =>
    apiFetch<{ passcode: string; qrInviteToken: string }>(
      `/api/profiles/${profileId}/passcode/rotate`,
      { method: 'POST' },
    ),

  getQrInvite: (profileId: string) =>
    apiFetch<{
      qrDataUrl: string;
      inviteUrl: string;
      qrInviteToken: string;
      note: string;
    }>(`/api/profiles/${profileId}/qr`),

  getCareCircle: (profileId: string) =>
    apiFetch<{
      elderlyOwner: UserProfile | null;
      family: CareCircleMember[];
      caretakers: CareCircleMember[];
      activities: CareActivity[];
    }>(`/api/profiles/${profileId}/care-circle`),

  getMedications: (profileId: string) =>
    apiFetch<{
      todayDate: string;
      medications: Medication[];
      todayLogs: MedicationLog[];
      logs: MedicationLog[];
    }>(`/api/profiles/${profileId}/medications`),

  addMedication: (
    profileId: string,
    payload: {
      name: string;
      dosage: string;
      instructions: string;
      foodInstruction: FoodInstruction;
      frequency: MedicationFrequency;
      timings: string[];
      startDate: string;
      endDate: string;
      prescribedBy: string;
    },
  ) =>
    apiFetch<{ medication: Medication }>(`/api/profiles/${profileId}/medications`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  updateMedication: (
    profileId: string,
    medId: string,
    payload: Partial<Medication>,
  ) =>
    apiFetch<{ medication: Medication }>(
      `/api/profiles/${profileId}/medications/${medId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

  deleteMedication: (profileId: string, medId: string) =>
    apiFetch<{ deletedId: string }>(
      `/api/profiles/${profileId}/medications/${medId}`,
      { method: 'DELETE' },
    ),

  logDoseStatus: (
    profileId: string,
    payload: {
      medicationId: string;
      scheduledDate: string;
      scheduledTime: string;
      status: DoseStatus;
      notes?: string;
    },
  ) =>
    apiFetch<{ log: MedicationLog }>(
      `/api/profiles/${profileId}/medication-logs`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  getAppointments: (profileId: string) =>
    apiFetch<{ appointments: Appointment[] }>(
      `/api/profiles/${profileId}/appointments`,
    ),

  addAppointment: (
    profileId: string,
    payload: {
      doctorName: string;
      specialty: string;
      clinicName: string;
      date: string;
      time: string;
      purpose: string;
      doctorPhone: string;
      doctorEmail: string;
      notes: string;
    },
  ) =>
    apiFetch<{ appointment: Appointment }>(
      `/api/profiles/${profileId}/appointments`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  updateAppointment: (
    profileId: string,
    apptId: string,
    payload: Partial<Appointment>,
  ) =>
    apiFetch<{ appointment: Appointment }>(
      `/api/profiles/${profileId}/appointments/${apptId}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      },
    ),

  deleteAppointment: (profileId: string, apptId: string) =>
    apiFetch<{ deletedId: string }>(
      `/api/profiles/${profileId}/appointments/${apptId}`,
      { method: 'DELETE' },
    ),

  remindAppointment: (profileId: string, apptId: string) =>
    apiFetch<{
      notifiedCount: number;
      smtpConfigured: boolean;
      appointment: Appointment;
    }>(`/api/profiles/${profileId}/appointments/${apptId}/remind`, {
      method: 'POST',
    }),

  getEmergencyContacts: (profileId: string) =>
    apiFetch<{ contacts: EmergencyContact[] }>(
      `/api/profiles/${profileId}/emergency-contacts`,
    ),

  addEmergencyContact: (
    profileId: string,
    payload: {
      name: string;
      relationship: string;
      phone: string;
      email: string;
      isPrimary: boolean;
    },
  ) =>
    apiFetch<{ contact: EmergencyContact }>(
      `/api/profiles/${profileId}/emergency-contacts`,
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
    ),

  deleteEmergencyContact: (profileId: string, contactId: string) =>
    apiFetch<{ deletedId: string }>(
      `/api/profiles/${profileId}/emergency-contacts/${contactId}`,
      { method: 'DELETE' },
    ),

  getAnalytics: (profileId: string) =>
    apiFetch<AnalyticsSummary>(`/api/profiles/${profileId}/analytics`),

  getNotifications: () =>
    apiFetch<{
      notifications: NotificationItem[];
      unreadCount: number;
      smtpConfigured: boolean;
    }>('/api/notifications'),

  markNotificationRead: (notifId: string) =>
    apiFetch<{ notification: NotificationItem }>(
      `/api/notifications/${notifId}/read`,
      { method: 'PATCH' },
    ),

  markAllNotificationsRead: () =>
    apiFetch<{ updated: number }>('/api/notifications/read-all', {
      method: 'POST',
    }),

  runReminderScan: () =>
    apiFetch<{
      summary: {
        upcomingDosesAlerted: number;
        missedDosesMarked: number;
        smartCareAlertsCreated: number;
        appointmentRemindersSent: number;
      };
      smtpConfigured: boolean;
    }>('/api/notifications/run-check', { method: 'POST' }),

  sendTestEmail: () =>
    apiFetch<{
      sent: boolean;
      mode: string;
      recipient: string;
      error?: string;
    }>('/api/notifications/test-email', { method: 'POST' }),

  getAiHistory: (profileId: string) =>
    apiFetch<{
      messages: Array<{
        id: string;
        role: 'user' | 'assistant';
        text: string;
        createdAt?: string;
      }>;
    }>(`/api/profiles/${profileId}/ai/history`),

  clearAiHistory: (profileId: string) =>
    apiFetch<{
      cleared: boolean;
      welcomeMessage: {
        id: string;
        role: 'user' | 'assistant';
        text: string;
        createdAt?: string;
      };
    }>(`/api/profiles/${profileId}/ai/history`, { method: 'DELETE' }),

  chatWithAi: (
    profileId: string,
    message: string,
    history: Array<{ role: 'user' | 'assistant'; text: string }>,
  ) =>
    apiFetch<{
      reply: string;
      model: string;
      configured: boolean;
      userMessage?: { id: string; role: 'user'; text: string; createdAt: string };
      assistantMessage?: { id: string; role: 'assistant'; text: string; createdAt: string };
    }>(`/api/profiles/${profileId}/ai/chat`, {
      method: 'POST',
      body: JSON.stringify({ message, history }),
    }),
};
