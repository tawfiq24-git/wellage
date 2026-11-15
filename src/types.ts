export type UserRole = 'elderly' | 'family' | 'caretaker';

export type FoodInstruction = 'before_food' | 'after_food' | 'with_food' | 'anytime';

export type MedicationFrequency =
  | 'daily'
  | 'twice_daily'
  | 'three_times_daily'
  | 'weekly'
  | 'as_needed';

export type DoseStatus = 'taken' | 'skipped' | 'missed';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface ElderlyProfile {
  id: string;
  ownerUserId: string;
  fullName: string;
  age: number;
  bloodGroup: string;
  allergies: string[];
  primaryConditions: string[];
  physicianName: string;
  physicianPhone: string;
  passcode: string;
  qrInviteToken: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Medication {
  id: string;
  elderlyProfileId: string;
  name: string;
  dosage: string;
  instructions: string;
  foodInstruction: FoodInstruction;
  frequency: MedicationFrequency;
  timings: string[];
  startDate: string;
  endDate: string;
  prescribedBy: string;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLog {
  id: string;
  elderlyProfileId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledDate: string;
  scheduledTime: string;
  status: DoseStatus;
  notes: string;
  recordedByUserId: string;
  recordedByName: string;
  recordedAt: string;
}

export interface Appointment {
  id: string;
  elderlyProfileId: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  date: string;
  time: string;
  purpose: string;
  doctorPhone: string;
  doctorEmail: string;
  status: 'upcoming' | 'completed' | 'cancelled';
  reminderSent: boolean;
  notes: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  elderlyProfileId: string;
  recipientUserId: string;
  type:
    | 'upcoming_dose'
    | 'missed_dose'
    | 'smart_care_alert'
    | 'appointment_reminder'
    | 'schedule_update'
    | 'caregiver_activity';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  emailSent: boolean;
  emailRecipient?: string;
  createdAt: string;
}

export interface EmergencyContact {
  id: string;
  elderlyProfileId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CareActivity {
  id: string;
  elderlyProfileId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  createdAt: string;
}

export interface CareCircleMember {
  connectionId: string;
  userId: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string | null;
  relationship?: string;
  specialization?: string;
  shiftNotes?: string;
  receiveEmailAlerts: boolean;
  connectedAt: string;
}

export interface AnalyticsSummary {
  today: {
    totalScheduled: number;
    taken: number;
    pending: number;
    missed: number;
    skipped: number;
    adherencePct: number;
  };
  thirtyDay: {
    taken: number;
    missed: number;
    skipped: number;
    adherencePct: number;
  };
  weeklySeries: Array<{
    date: string;
    label: string;
    taken: number;
    missed: number;
    skipped: number;
    adherencePct: number;
  }>;
  smartCareAlerts: Array<{
    medicationId: string;
    medicationName: string;
    missedCount: number;
    message: string;
  }>;
}

export interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt?: string;
}
