export type UserRole = 'elderly' | 'family' | 'caretaker';

export type FoodInstruction = 'before_food' | 'after_food' | 'with_food' | 'anytime';

export type MedicationFrequency = 'daily' | 'twice_daily' | 'three_times_daily' | 'weekly' | 'as_needed';

export type DoseStatus = 'taken' | 'skipped' | 'missed';

export type NotificationType =
  | 'upcoming_dose'
  | 'missed_dose'
  | 'smart_care_alert'
  | 'appointment_reminder'
  | 'schedule_update'
  | 'caregiver_activity';

export interface UserRecord {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  passwordHash: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface ElderlyProfileRecord {
  id: string;
  ownerUserId: string;
  fullName: string;
  age: number;
  bloodGroup: string;
  allergies: string[];
  primaryConditions: string[];
  physicianName: string;
  physicianPhone: string;
  passcodePlain: string; // Stored hashed for verification; rotated by elderly/caretaker; masked unless authorized owner/caretaker views Share modal
  passcodeHash: string;
  qrInviteToken: string;
  avatarUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FamilyConnectionRecord {
  id: string;
  elderlyProfileId: string;
  userId: string;
  relationship: string;
  receiveEmailAlerts: boolean;
  connectedAt: string;
}

export interface CaretakerConnectionRecord {
  id: string;
  elderlyProfileId: string;
  userId: string;
  specialization: string;
  shiftNotes: string;
  receiveEmailAlerts: boolean;
  connectedAt: string;
}

export interface MedicationRecord {
  id: string;
  elderlyProfileId: string;
  name: string;
  dosage: string;
  instructions: string;
  foodInstruction: FoodInstruction;
  frequency: MedicationFrequency;
  timings: string[]; // HH:mm 24-hour format e.g. ["08:00", "20:00"]
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD or ""
  prescribedBy: string;
  isActive: boolean;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MedicationLogRecord {
  id: string;
  elderlyProfileId: string;
  medicationId: string;
  medicationName: string;
  dosage: string;
  scheduledDate: string; // YYYY-MM-DD
  scheduledTime: string; // HH:mm
  status: DoseStatus;
  notes: string;
  recordedByUserId: string;
  recordedByName: string;
  recordedAt: string;
}

export interface AppointmentRecord {
  id: string;
  elderlyProfileId: string;
  doctorName: string;
  specialty: string;
  clinicName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
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

export interface NotificationRecord {
  id: string;
  elderlyProfileId: string;
  recipientUserId: string;
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  read: boolean;
  emailSent: boolean;
  emailRecipient?: string;
  dedupeKey?: string;
  createdAt: string;
}

export interface EmergencyContactRecord {
  id: string;
  elderlyProfileId: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  isPrimary: boolean;
  createdAt: string;
}

export interface CareActivityRecord {
  id: string;
  elderlyProfileId: string;
  actorUserId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  details: string;
  createdAt: string;
}

export interface AiChatMessageRecord {
  id: string;
  elderlyProfileId: string;
  userId: string;
  role: 'user' | 'assistant';
  text: string;
  createdAt: string;
}

export interface DatabaseSchema {
  users: UserRecord[];
  elderly_profiles: ElderlyProfileRecord[];
  family_connections: FamilyConnectionRecord[];
  caretaker_connections: CaretakerConnectionRecord[];
  medications: MedicationRecord[];
  medication_logs: MedicationLogRecord[];
  appointments: AppointmentRecord[];
  notifications: NotificationRecord[];
  emergency_contacts: EmergencyContactRecord[];
  care_activities: CareActivityRecord[];
  ai_chat_messages?: AiChatMessageRecord[];
}
