import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { hashSecret } from './auth.ts';
import type {
  AppointmentRecord,
  CareActivityRecord,
  CaretakerConnectionRecord,
  DatabaseSchema,
  ElderlyProfileRecord,
  EmergencyContactRecord,
  FamilyConnectionRecord,
  MedicationLogRecord,
  MedicationRecord,
  NotificationRecord,
  UserRecord,
  UserRole,
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

function formatDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isoOffset(hoursOffset: number): string {
  return new Date(Date.now() + hoursOffset * 3600 * 1000).toISOString();
}

function buildSeedDatabase(): DatabaseSchema {
  const demoPassHash = hashSecret('ElderCare2026!');
  const arthurPasscode = '749210';

  const users: UserRecord[] = [
    {
      id: 'user_arthur',
      name: 'Arthur Pendelton',
      email: 'arthur.pendelton@eldercare360.demo',
      phone: '+1 (555) 234-8810',
      role: 'elderly',
      passwordHash: demoPassHash,
      avatarUrl: '/src/assets/images/avatar_senior_arthur_1794717649477.jpg',
      createdAt: isoOffset(-720),
    },
    {
      id: 'user_clara',
      name: 'Clara Pendelton',
      email: 'clara.family@eldercare360.demo',
      phone: '+1 (555) 391-4420',
      role: 'family',
      passwordHash: demoPassHash,
      createdAt: isoOffset(-700),
    },
    {
      id: 'user_elena',
      name: 'Elena Vance, RN',
      email: 'elena.caretaker@eldercare360.demo',
      phone: '+1 (555) 802-1194',
      role: 'caretaker',
      passwordHash: demoPassHash,
      avatarUrl: '/src/assets/images/avatar_caretaker_elena_1794717651025.jpg',
      createdAt: isoOffset(-690),
    },
  ];

  const elderly_profiles: ElderlyProfileRecord[] = [
    {
      id: 'profile_arthur',
      ownerUserId: 'user_arthur',
      fullName: 'Arthur Pendelton',
      age: 76,
      bloodGroup: 'O+',
      allergies: ['Penicillin', 'Sulfa drugs'],
      primaryConditions: ['Hypertension', 'Type 2 Diabetes', 'Mild Osteoarthritis'],
      physicianName: 'Dr. Marcus Holloway, MD',
      physicianPhone: '+1 (555) 619-3300',
      passcodePlain: arthurPasscode,
      passcodeHash: hashSecret(arthurPasscode),
      qrInviteToken: 'ec360_arthur_invite_94f82a',
      avatarUrl: '/src/assets/images/avatar_senior_arthur_1794717649477.jpg',
      createdAt: isoOffset(-720),
      updatedAt: isoOffset(-12),
    },
  ];

  const family_connections: FamilyConnectionRecord[] = [
    {
      id: 'fam_clara_arthur',
      elderlyProfileId: 'profile_arthur',
      userId: 'user_clara',
      relationship: 'Daughter',
      receiveEmailAlerts: true,
      connectedAt: isoOffset(-680),
    },
  ];

  const caretaker_connections: CaretakerConnectionRecord[] = [
    {
      id: 'care_elena_arthur',
      elderlyProfileId: 'profile_arthur',
      userId: 'user_elena',
      specialization: 'Geriatric Home Care RN',
      shiftNotes: 'Morning & evening medication review; blood pressure check Mon/Thu.',
      receiveEmailAlerts: true,
      connectedAt: isoOffset(-680),
    },
  ];

  const start30 = formatDateOffset(-45);
  const end90 = formatDateOffset(90);

  const medications: MedicationRecord[] = [
    {
      id: 'med_lisinopril',
      elderlyProfileId: 'profile_arthur',
      name: 'Lisinopril',
      dosage: '10 mg Tablet',
      instructions: 'Take 1 tablet by mouth each morning for blood pressure support. Rise slowly from sitting.',
      foodInstruction: 'anytime',
      frequency: 'daily',
      timings: ['08:00'],
      startDate: start30,
      endDate: end90,
      prescribedBy: 'Dr. Marcus Holloway, MD',
      isActive: true,
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-700),
      updatedAt: isoOffset(-200),
    },
    {
      id: 'med_metformin',
      elderlyProfileId: 'profile_arthur',
      name: 'Metformin XR',
      dosage: '500 mg Tablet',
      instructions: 'Swallow whole with a full glass of water after breakfast and dinner. Do not crush.',
      foodInstruction: 'after_food',
      frequency: 'twice_daily',
      timings: ['08:30', '19:30'],
      startDate: start30,
      endDate: end90,
      prescribedBy: 'Dr. Priya Nair, Endocrinology',
      isActive: true,
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-650),
      updatedAt: isoOffset(-150),
    },
    {
      id: 'med_levothyroxine',
      elderlyProfileId: 'profile_arthur',
      name: 'Levothyroxine',
      dosage: '50 mcg Tablet',
      instructions: 'Take on an empty stomach 30–60 minutes before breakfast with plain water.',
      foodInstruction: 'before_food',
      frequency: 'daily',
      timings: ['07:00'],
      startDate: start30,
      endDate: end90,
      prescribedBy: 'Dr. Priya Nair, Endocrinology',
      isActive: true,
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-600),
      updatedAt: isoOffset(-120),
    },
    {
      id: 'med_vitamind',
      elderlyProfileId: 'profile_arthur',
      name: 'Vitamin D3 + Calcium',
      dosage: '1000 IU / 500 mg',
      instructions: 'Take with lunch to support bone strength and absorption.',
      foodInstruction: 'with_food',
      frequency: 'daily',
      timings: ['13:00'],
      startDate: start30,
      endDate: end90,
      prescribedBy: 'Dr. Marcus Holloway, MD',
      isActive: true,
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-500),
      updatedAt: isoOffset(-90),
    },
    {
      id: 'med_atorvastatin',
      elderlyProfileId: 'profile_arthur',
      name: 'Atorvastatin',
      dosage: '20 mg Tablet',
      instructions: 'Take once nightly before bedtime for cholesterol management.',
      foodInstruction: 'anytime',
      frequency: 'daily',
      timings: ['21:30'],
      startDate: start30,
      endDate: end90,
      prescribedBy: 'Dr. Marcus Holloway, MD',
      isActive: true,
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-480),
      updatedAt: isoOffset(-48),
    },
  ];

  // Generate 14 days of realistic adherence logs (plus today's morning logs)
  const medication_logs: MedicationLogRecord[] = [];
  for (let offset = -13; offset <= -1; offset++) {
    const dateStr = formatDateOffset(offset);
    medications.forEach((med, mIdx) => {
      med.timings.forEach((timeStr, tIdx) => {
        // Make Atorvastatin missed twice in the last 3 days so Smart Care Alert triggers realistically
        let status: 'taken' | 'skipped' | 'missed' = 'taken';
        if (med.id === 'med_atorvastatin' && (offset === -1 || offset === -2)) {
          status = 'missed';
        } else if (offset === -4 && mIdx === 3) {
          status = 'skipped';
        } else if (offset === -7 && mIdx === 1 && tIdx === 1) {
          status = 'missed';
        } else if (offset === -10 && mIdx === 0) {
          status = 'taken';
        }

        medication_logs.push({
          id: `log_${med.id}_${dateStr}_${timeStr.replace(':', '')}`,
          elderlyProfileId: 'profile_arthur',
          medicationId: med.id,
          medicationName: med.name,
          dosage: med.dosage,
          scheduledDate: dateStr,
          scheduledTime: timeStr,
          status,
          notes:
            status === 'missed'
              ? 'Dose window elapsed without confirmation.'
              : status === 'skipped'
                ? 'Skipped per patient note (mild upset stomach).'
                : 'Confirmed on schedule.',
          recordedByUserId: status === 'missed' ? 'system' : 'user_arthur',
          recordedByName: status === 'missed' ? 'Automated Monitor' : 'Arthur Pendelton',
          recordedAt: `${dateStr}T${timeStr}:00.000Z`,
        });
      });
    });
  }

  // Today's initial morning logs so dashboard shows Taken + Pending right away
  const todayStr = formatDateOffset(0);
  medication_logs.push(
    {
      id: `log_med_levothyroxine_${todayStr}_0700`,
      elderlyProfileId: 'profile_arthur',
      medicationId: 'med_levothyroxine',
      medicationName: 'Levothyroxine',
      dosage: '50 mcg Tablet',
      scheduledDate: todayStr,
      scheduledTime: '07:00',
      status: 'taken',
      notes: 'Taken with full glass of water before breakfast.',
      recordedByUserId: 'user_arthur',
      recordedByName: 'Arthur Pendelton',
      recordedAt: isoOffset(-3),
    },
    {
      id: `log_med_lisinopril_${todayStr}_0800`,
      elderlyProfileId: 'profile_arthur',
      medicationId: 'med_lisinopril',
      medicationName: 'Lisinopril',
      dosage: '10 mg Tablet',
      scheduledDate: todayStr,
      scheduledTime: '08:00',
      status: 'taken',
      notes: 'Blood pressure 126/78 mmHg recorded by nurse.',
      recordedByUserId: 'user_elena',
      recordedByName: 'Elena Vance, RN',
      recordedAt: isoOffset(-2),
    },
  );

  const appointments: AppointmentRecord[] = [
    {
      id: 'appt_cardio_upcoming',
      elderlyProfileId: 'profile_arthur',
      doctorName: 'Dr. Marcus Holloway, MD',
      specialty: 'Cardiology & Primary Care',
      clinicName: 'Oakridge Senior Medical Pavilion',
      date: formatDateOffset(1),
      time: '10:30',
      purpose: 'Quarterly blood pressure & lipid panel review',
      doctorPhone: '+1 (555) 619-3300',
      doctorEmail: 'scheduling@oakridgemedical.example.com',
      status: 'upcoming',
      reminderSent: true,
      notes: 'Bring 14-day blood pressure log and current medication list.',
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-240),
      updatedAt: isoOffset(-24),
    },
    {
      id: 'appt_endo_upcoming',
      elderlyProfileId: 'profile_arthur',
      doctorName: 'Dr. Priya Nair, MD',
      specialty: 'Endocrinology',
      clinicName: 'Mercy Endocrine & Diabetes Center',
      date: formatDateOffset(5),
      time: '14:15',
      purpose: 'HbA1c follow-up & Metformin XR tolerance check',
      doctorPhone: '+1 (555) 482-9012',
      doctorEmail: 'careteam@mercyendocrine.example.com',
      status: 'upcoming',
      reminderSent: false,
      notes: 'Fasting morning blood draw completed two days prior.',
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-180),
      updatedAt: isoOffset(-180),
    },
    {
      id: 'appt_ortho_upcoming',
      elderlyProfileId: 'profile_arthur',
      doctorName: 'Dr. Alan Chen, PT, DPT',
      specialty: 'Physical Therapy',
      clinicName: 'Harbor Mobility & Rehab Clinic',
      date: formatDateOffset(11),
      time: '09:45',
      purpose: 'Knee osteoarthritis mobility & balance session',
      doctorPhone: '+1 (555) 741-5530',
      doctorEmail: 'frontdesk@harborrehab.example.com',
      status: 'upcoming',
      reminderSent: false,
      notes: 'Wear comfortable walking shoes.',
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-96),
      updatedAt: isoOffset(-96),
    },
    {
      id: 'appt_past_lab',
      elderlyProfileId: 'profile_arthur',
      doctorName: 'Dr. Marcus Holloway, MD',
      specialty: 'Internal Medicine',
      clinicName: 'Oakridge Senior Medical Pavilion',
      date: formatDateOffset(-14),
      time: '11:00',
      purpose: 'Comprehensive metabolic panel & routine checkup',
      doctorPhone: '+1 (555) 619-3300',
      doctorEmail: 'scheduling@oakridgemedical.example.com',
      status: 'completed',
      reminderSent: true,
      notes: 'Vitals stable; Vitamin D3 supplementation continued.',
      createdByUserId: 'user_elena',
      createdAt: isoOffset(-500),
      updatedAt: isoOffset(-336),
    },
  ];

  const emergency_contacts: EmergencyContactRecord[] = [
    {
      id: 'ec_clara',
      elderlyProfileId: 'profile_arthur',
      name: 'Clara Pendelton',
      relationship: 'Daughter (Primary Family Contact)',
      phone: '+1 (555) 391-4420',
      email: 'clara.family@eldercare360.demo',
      isPrimary: true,
      createdAt: isoOffset(-680),
    },
    {
      id: 'ec_elena',
      elderlyProfileId: 'profile_arthur',
      name: 'Elena Vance, RN',
      relationship: 'Assigned Home Care Nurse',
      phone: '+1 (555) 802-1194',
      email: 'elena.caretaker@eldercare360.demo',
      isPrimary: false,
      createdAt: isoOffset(-680),
    },
    {
      id: 'ec_physician',
      elderlyProfileId: 'profile_arthur',
      name: 'Oakridge 24/7 Nurse Triage',
      relationship: 'Primary Physician On-Call',
      phone: '+1 (555) 619-3399',
      email: 'triage@oakridgemedical.example.com',
      isPrimary: false,
      createdAt: isoOffset(-680),
    },
  ];

  const notifications: NotificationRecord[] = [
    {
      id: 'notif_smart_alert_atorvastatin',
      elderlyProfileId: 'profile_arthur',
      recipientUserId: 'user_clara',
      type: 'smart_care_alert',
      title: 'Smart Care Alert: Repeated Evening Dose Missed',
      message:
        'Atorvastatin (20 mg, 21:30) was missed 2 times over the last 48 hours for Arthur Pendelton. Please check evening bedtime routine.',
      severity: 'critical',
      read: false,
      emailSent: true,
      emailRecipient: 'clara.family@eldercare360.demo',
      dedupeKey: `smart_alert_med_atorvastatin_${todayStr}`,
      createdAt: isoOffset(-5),
    },
    {
      id: 'notif_smart_alert_elena',
      elderlyProfileId: 'profile_arthur',
      recipientUserId: 'user_elena',
      type: 'smart_care_alert',
      title: 'Smart Care Alert: Repeated Evening Dose Missed',
      message:
        'Atorvastatin (20 mg, 21:30) was missed 2 times over the last 48 hours for Arthur Pendelton. Caretaker follow-up recommended.',
      severity: 'critical',
      read: false,
      emailSent: true,
      emailRecipient: 'elena.caretaker@eldercare360.demo',
      dedupeKey: `smart_alert_elena_med_atorvastatin_${todayStr}`,
      createdAt: isoOffset(-5),
    },
    {
      id: 'notif_appt_tomorrow',
      elderlyProfileId: 'profile_arthur',
      recipientUserId: 'user_arthur',
      type: 'appointment_reminder',
      title: 'Upcoming Appointment Tomorrow at 10:30',
      message:
        'Cardiology checkup with Dr. Marcus Holloway, MD at Oakridge Senior Medical Pavilion tomorrow at 10:30.',
      severity: 'info',
      read: false,
      emailSent: false,
      dedupeKey: `appt_reminder_appt_cardio_upcoming_${todayStr}`,
      createdAt: isoOffset(-3),
    },
    {
      id: 'notif_dose_taken_morning',
      elderlyProfileId: 'profile_arthur',
      recipientUserId: 'user_clara',
      type: 'caregiver_activity',
      title: 'Morning Medications Confirmed',
      message:
        'Elena Vance, RN confirmed Lisinopril (10 mg) at 08:00 and Arthur confirmed Levothyroxine (50 mcg) at 07:00.',
      severity: 'info',
      read: true,
      emailSent: false,
      createdAt: isoOffset(-2),
    },
  ];

  const care_activities: CareActivityRecord[] = [
    {
      id: 'act_1',
      elderlyProfileId: 'profile_arthur',
      actorUserId: 'user_elena',
      actorName: 'Elena Vance, RN',
      actorRole: 'caretaker',
      action: 'Confirmed Lisinopril 10 mg',
      details: 'Morning blood pressure check 126/78 mmHg recorded.',
      createdAt: isoOffset(-2),
    },
    {
      id: 'act_2',
      elderlyProfileId: 'profile_arthur',
      actorUserId: 'user_arthur',
      actorName: 'Arthur Pendelton',
      actorRole: 'elderly',
      action: 'Marked Levothyroxine 50 mcg Taken',
      details: 'Taken before breakfast with water.',
      createdAt: isoOffset(-3),
    },
    {
      id: 'act_3',
      elderlyProfileId: 'profile_arthur',
      actorUserId: 'user_elena',
      actorName: 'Elena Vance, RN',
      actorRole: 'caretaker',
      action: 'Updated Cardiology Appointment Notes',
      details: 'Added reminder to bring 14-day blood pressure log.',
      createdAt: isoOffset(-24),
    },
  ];

  return {
    users,
    elderly_profiles,
    family_connections,
    caretaker_connections,
    medications,
    medication_logs,
    appointments,
    notifications,
    emergency_contacts,
    care_activities,
    ai_chat_messages: [],
  };
}

class ElderCareStore {
  private data: DatabaseSchema;

  constructor() {
    this.data = this.loadOrInitialize();
  }

  private loadOrInitialize(): DatabaseSchema {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf8');
        const parsed = JSON.parse(raw) as DatabaseSchema;
        if (parsed && Array.isArray(parsed.users) && Array.isArray(parsed.elderly_profiles)) {
          if (!Array.isArray(parsed.ai_chat_messages)) {
            parsed.ai_chat_messages = [];
          }
          return parsed;
        }
      }
    } catch (err) {
      console.error('[ElderCareStore] Failed to load db.json, recreating seed:', err);
    }

    const seeded = buildSeedDatabase();
    this.writeAtomic(seeded);
    return seeded;
  }

  private writeAtomic(data: DatabaseSchema) {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpFile, DB_FILE);
  }

  public save() {
    this.writeAtomic(this.data);
  }

  public get db(): DatabaseSchema {
    return this.data;
  }

  public getUserById(id: string): UserRecord | undefined {
    return this.data.users.find((u) => u.id === id);
  }

  public getUserByEmail(email: string): UserRecord | undefined {
    const normalized = email.trim().toLowerCase();
    return this.data.users.find((u) => u.email.toLowerCase() === normalized);
  }

  public getAccessibleProfilesForUser(user: UserRecord): ElderlyProfileRecord[] {
    if (user.role === 'elderly') {
      return this.data.elderly_profiles.filter((p) => p.ownerUserId === user.id);
    }
    if (user.role === 'family') {
      const ids = new Set(
        this.data.family_connections
          .filter((c) => c.userId === user.id)
          .map((c) => c.elderlyProfileId),
      );
      return this.data.elderly_profiles.filter((p) => ids.has(p.id));
    }
    if (user.role === 'caretaker') {
      const ids = new Set(
        this.data.caretaker_connections
          .filter((c) => c.userId === user.id)
          .map((c) => c.elderlyProfileId),
      );
      return this.data.elderly_profiles.filter((p) => ids.has(p.id));
    }
    return [];
  }

  public userHasProfileAccess(user: UserRecord, profileId: string): boolean {
    return this.getAccessibleProfilesForUser(user).some((p) => p.id === profileId);
  }

  public getAuthorizedCareCircleRecipients(profileId: string): UserRecord[] {
    const profile = this.data.elderly_profiles.find((p) => p.id === profileId);
    if (!profile) return [];

    const userIds = new Set<string>([profile.ownerUserId]);
    for (const fc of this.data.family_connections) {
      if (fc.elderlyProfileId === profileId) userIds.add(fc.userId);
    }
    for (const cc of this.data.caretaker_connections) {
      if (cc.elderlyProfileId === profileId) userIds.add(cc.userId);
    }

    return this.data.users.filter((u) => userIds.has(u.id));
  }

  public recordActivity(params: {
    elderlyProfileId: string;
    actorUserId: string;
    actorName: string;
    actorRole: UserRole;
    action: string;
    details: string;
  }) {
    this.data.care_activities.unshift({
      id: `act_${crypto.randomUUID().slice(0, 8)}`,
      elderlyProfileId: params.elderlyProfileId,
      actorUserId: params.actorUserId,
      actorName: params.actorName,
      actorRole: params.actorRole,
      action: params.action,
      details: params.details,
      createdAt: new Date().toISOString(),
    });
    if (this.data.care_activities.length > 200) {
      this.data.care_activities = this.data.care_activities.slice(0, 200);
    }
  }
}

export const store = new ElderCareStore();
export { formatDateOffset };
