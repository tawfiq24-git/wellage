import { count } from 'drizzle-orm';
import { hashSecret } from '../../server/auth.ts';
import { db } from './index.ts';
import {
  appointments,
  careActivities,
  caretakerConnections,
  elderlyProfiles,
  emergencyContacts,
  familyConnections,
  medicationLogs,
  medications,
  notifications,
  users,
} from './schema.ts';

function formatDateOffset(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function dateOffset(hoursOffset: number): Date {
  return new Date(Date.now() + hoursOffset * 3600 * 1000);
}

let seedPromise: Promise<void> | null = null;

export async function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = runSeedIfEmpty().catch((err) => {
      seedPromise = null;
      throw err;
    });
  }
  return seedPromise;
}

async function runSeedIfEmpty(): Promise<void> {
  try {
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    if (Number(userCount) > 0) {
      return;
    }

    const demoPassHash = hashSecret('ElderCare2026!');
    const arthurPasscode = '749210';
    const todayStr = formatDateOffset(0);
    const start30 = formatDateOffset(-45);
    const end90 = formatDateOffset(90);

    await db.transaction(async (tx) => {
      await tx
        .insert(users)
        .values([
          {
            userId: 'user_arthur',
            firebaseUid: null,
            fullName: 'Arthur Pendelton',
            email: 'arthur.pendelton@eldercare360.demo',
            phone: '+1 (555) 234-8810',
            role: 'elderly',
            passwordHash: demoPassHash,
            avatarUrl: '/src/assets/images/avatar_senior_arthur_1794717649477.jpg',
            createdAt: dateOffset(-720),
          },
          {
            userId: 'user_clara',
            firebaseUid: null,
            fullName: 'Clara Pendelton',
            email: 'clara.family@eldercare360.demo',
            phone: '+1 (555) 391-4420',
            role: 'family',
            passwordHash: demoPassHash,
            avatarUrl: null,
            createdAt: dateOffset(-700),
          },
          {
            userId: 'user_elena',
            firebaseUid: null,
            fullName: 'Elena Vance, RN',
            email: 'elena.caretaker@eldercare360.demo',
            phone: '+1 (555) 802-1194',
            role: 'caretaker',
            passwordHash: demoPassHash,
            avatarUrl: '/src/assets/images/avatar_caretaker_elena_1794717651025.jpg',
            createdAt: dateOffset(-690),
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(elderlyProfiles)
        .values({
          profileId: 'profile_arthur',
          userId: 'user_arthur',
          fullName: 'Arthur Pendelton',
          age: 76,
          dateOfBirth: '1950-04-12',
          bloodGroup: 'O+',
          emergencyContact: 'Clara Pendelton (+1 (555) 391-4420)',
          address: '418 Maplewood Terrace, Oakridge',
          medicalNotes: 'Hypertension, Type 2 Diabetes, Mild Osteoarthritis. Rise slowly from seated positions.',
          allergies: ['Penicillin', 'Sulfa drugs'],
          primaryConditions: ['Hypertension', 'Type 2 Diabetes', 'Mild Osteoarthritis'],
          physicianName: 'Dr. Marcus Holloway, MD',
          physicianPhone: '+1 (555) 619-3300',
          passcodePlain: arthurPasscode,
          passcodeHash: hashSecret(arthurPasscode),
          qrInviteToken: 'ec360_arthur_invite_94f82a',
          avatarUrl: '/src/assets/images/avatar_senior_arthur_1794717649477.jpg',
          createdAt: dateOffset(-720),
          updatedAt: dateOffset(-12),
        })
        .onConflictDoNothing();

      await tx
        .insert(familyConnections)
        .values({
          connectionId: 'fam_clara_arthur',
          elderlyProfileId: 'profile_arthur',
          familyUserId: 'user_clara',
          relationship: 'Daughter',
          accessStatus: 'active',
          receiveEmailAlerts: true,
          connectedAt: dateOffset(-680),
        })
        .onConflictDoNothing();

      await tx
        .insert(caretakerConnections)
        .values({
          connectionId: 'care_elena_arthur',
          elderlyProfileId: 'profile_arthur',
          caretakerUserId: 'user_elena',
          specialization: 'Geriatric Home Care RN',
          shiftNotes: 'Morning & evening medication review; blood pressure check Mon/Thu.',
          accessStatus: 'active',
          receiveEmailAlerts: true,
          connectedAt: dateOffset(-680),
        })
        .onConflictDoNothing();

      const medSeed = [
        {
          medicationId: 'med_lisinopril',
          elderlyProfileId: 'profile_arthur',
          medicineName: 'Lisinopril',
          dosage: '10 mg Tablet',
          instructions:
            'Take 1 tablet by mouth each morning for blood pressure support. Rise slowly from sitting.',
          foodInstruction: 'anytime',
          frequency: 'daily',
          timings: ['08:00'],
          startDate: start30,
          endDate: end90,
          prescribedBy: 'Dr. Marcus Holloway, MD',
          isActive: true,
          createdByUserId: 'user_elena',
          createdAt: dateOffset(-700),
          updatedAt: dateOffset(-200),
        },
        {
          medicationId: 'med_metformin',
          elderlyProfileId: 'profile_arthur',
          medicineName: 'Metformin XR',
          dosage: '500 mg Tablet',
          instructions:
            'Swallow whole with a full glass of water after breakfast and dinner. Do not crush.',
          foodInstruction: 'after_food',
          frequency: 'twice_daily',
          timings: ['08:30', '19:30'],
          startDate: start30,
          endDate: end90,
          prescribedBy: 'Dr. Priya Nair, Endocrinology',
          isActive: true,
          createdByUserId: 'user_elena',
          createdAt: dateOffset(-650),
          updatedAt: dateOffset(-150),
        },
        {
          medicationId: 'med_levothyroxine',
          elderlyProfileId: 'profile_arthur',
          medicineName: 'Levothyroxine',
          dosage: '50 mcg Tablet',
          instructions:
            'Take on an empty stomach 30–60 minutes before breakfast with plain water.',
          foodInstruction: 'before_food',
          frequency: 'daily',
          timings: ['07:00'],
          startDate: start30,
          endDate: end90,
          prescribedBy: 'Dr. Priya Nair, Endocrinology',
          isActive: true,
          createdByUserId: 'user_elena',
          createdAt: dateOffset(-600),
          updatedAt: dateOffset(-120),
        },
        {
          medicationId: 'med_vitamind',
          elderlyProfileId: 'profile_arthur',
          medicineName: 'Vitamin D3 + Calcium',
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
          createdAt: dateOffset(-500),
          updatedAt: dateOffset(-90),
        },
        {
          medicationId: 'med_atorvastatin',
          elderlyProfileId: 'profile_arthur',
          medicineName: 'Atorvastatin',
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
          createdAt: dateOffset(-480),
          updatedAt: dateOffset(-48),
        },
      ];

      await tx.insert(medications).values(medSeed).onConflictDoNothing();

      const logRows: Array<typeof medicationLogs.$inferInsert> = [];
      for (let offset = -13; offset <= -1; offset++) {
        const dateStr = formatDateOffset(offset);
        medSeed.forEach((med, mIdx) => {
          med.timings.forEach((timeStr, tIdx) => {
            let status: 'taken' | 'skipped' | 'missed' = 'taken';
            if (med.medicationId === 'med_atorvastatin' && (offset === -1 || offset === -2)) {
              status = 'missed';
            } else if (offset === -4 && mIdx === 3) {
              status = 'skipped';
            } else if (offset === -7 && mIdx === 1 && tIdx === 1) {
              status = 'missed';
            }

            logRows.push({
              logId: `log_${med.medicationId}_${dateStr}_${timeStr.replace(':', '')}`,
              elderlyProfileId: 'profile_arthur',
              medicationId: med.medicationId,
              medicationName: med.medicineName,
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
              recordedAt: new Date(`${dateStr}T${timeStr}:00.000Z`),
            });
          });
        });
      }

      logRows.push(
        {
          logId: `log_med_levothyroxine_${todayStr}_0700`,
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
          recordedAt: dateOffset(-3),
        },
        {
          logId: `log_med_lisinopril_${todayStr}_0800`,
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
          recordedAt: dateOffset(-2),
        },
      );

      await tx.insert(medicationLogs).values(logRows).onConflictDoNothing();

      await tx
        .insert(appointments)
        .values([
          {
            appointmentId: 'appt_cardio_upcoming',
            elderlyProfileId: 'profile_arthur',
            doctorName: 'Dr. Marcus Holloway, MD',
            specialty: 'Cardiology & Primary Care',
            hospitalName: 'Oakridge Senior Medical Pavilion',
            appointmentDate: formatDateOffset(1),
            appointmentTime: '10:30',
            purpose: 'Quarterly blood pressure & lipid panel review',
            doctorPhone: '+1 (555) 619-3300',
            doctorEmail: 'scheduling@oakridgemedical.example.com',
            status: 'upcoming',
            reminderSent: true,
            notes: 'Bring 14-day blood pressure log and current medication list.',
            createdByUserId: 'user_elena',
            createdAt: dateOffset(-240),
            updatedAt: dateOffset(-24),
          },
          {
            appointmentId: 'appt_endo_upcoming',
            elderlyProfileId: 'profile_arthur',
            doctorName: 'Dr. Priya Nair, MD',
            specialty: 'Endocrinology',
            hospitalName: 'Mercy Endocrine & Diabetes Center',
            appointmentDate: formatDateOffset(5),
            appointmentTime: '14:15',
            purpose: 'HbA1c follow-up & Metformin XR tolerance check',
            doctorPhone: '+1 (555) 482-9012',
            doctorEmail: 'careteam@mercyendocrine.example.com',
            status: 'upcoming',
            reminderSent: false,
            notes: 'Fasting morning blood draw completed two days prior.',
            createdByUserId: 'user_elena',
            createdAt: dateOffset(-180),
            updatedAt: dateOffset(-180),
          },
          {
            appointmentId: 'appt_ortho_upcoming',
            elderlyProfileId: 'profile_arthur',
            doctorName: 'Dr. Alan Chen, PT, DPT',
            specialty: 'Physical Therapy',
            hospitalName: 'Harbor Mobility & Rehab Clinic',
            appointmentDate: formatDateOffset(11),
            appointmentTime: '09:45',
            purpose: 'Knee osteoarthritis mobility & balance session',
            doctorPhone: '+1 (555) 741-5530',
            doctorEmail: 'frontdesk@harborrehab.example.com',
            status: 'upcoming',
            reminderSent: false,
            notes: 'Wear comfortable walking shoes.',
            createdByUserId: 'user_elena',
            createdAt: dateOffset(-96),
            updatedAt: dateOffset(-96),
          },
          {
            appointmentId: 'appt_past_lab',
            elderlyProfileId: 'profile_arthur',
            doctorName: 'Dr. Marcus Holloway, MD',
            specialty: 'Internal Medicine',
            hospitalName: 'Oakridge Senior Medical Pavilion',
            appointmentDate: formatDateOffset(-14),
            appointmentTime: '11:00',
            purpose: 'Comprehensive metabolic panel & routine checkup',
            doctorPhone: '+1 (555) 619-3300',
            doctorEmail: 'scheduling@oakridgemedical.example.com',
            status: 'completed',
            reminderSent: true,
            notes: 'Vitals stable; Vitamin D3 supplementation continued.',
            createdByUserId: 'user_elena',
            createdAt: dateOffset(-500),
            updatedAt: dateOffset(-336),
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(emergencyContacts)
        .values([
          {
            contactId: 'ec_clara',
            elderlyProfileId: 'profile_arthur',
            contactName: 'Clara Pendelton',
            relationship: 'Daughter (Primary Family Contact)',
            phoneNumber: '+1 (555) 391-4420',
            email: 'clara.family@eldercare360.demo',
            isPrimary: true,
            createdAt: dateOffset(-680),
          },
          {
            contactId: 'ec_elena',
            elderlyProfileId: 'profile_arthur',
            contactName: 'Elena Vance, RN',
            relationship: 'Assigned Home Care Nurse',
            phoneNumber: '+1 (555) 802-1194',
            email: 'elena.caretaker@eldercare360.demo',
            isPrimary: false,
            createdAt: dateOffset(-680),
          },
          {
            contactId: 'ec_physician',
            elderlyProfileId: 'profile_arthur',
            contactName: 'Oakridge 24/7 Nurse Triage',
            relationship: 'Primary Physician On-Call',
            phoneNumber: '+1 (555) 619-3399',
            email: 'triage@oakridgemedical.example.com',
            isPrimary: false,
            createdAt: dateOffset(-680),
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(notifications)
        .values([
          {
            notificationId: 'notif_smart_alert_atorvastatin',
            elderlyProfileId: 'profile_arthur',
            userId: 'user_clara',
            notificationType: 'smart_care_alert',
            title: 'Smart Care Alert: Repeated Evening Dose Missed',
            message:
              'Atorvastatin (20 mg, 21:30) was missed 2 times over the last 48 hours for Arthur Pendelton. Please check evening bedtime routine.',
            severity: 'critical',
            readStatus: false,
            emailSent: true,
            emailRecipient: 'clara.family@eldercare360.demo',
            dedupeKey: `smart_alert_med_atorvastatin_${todayStr}`,
            createdAt: dateOffset(-5),
          },
          {
            notificationId: 'notif_smart_alert_elena',
            elderlyProfileId: 'profile_arthur',
            userId: 'user_elena',
            notificationType: 'smart_care_alert',
            title: 'Smart Care Alert: Repeated Evening Dose Missed',
            message:
              'Atorvastatin (20 mg, 21:30) was missed 2 times over the last 48 hours for Arthur Pendelton. Caretaker follow-up recommended.',
            severity: 'critical',
            readStatus: false,
            emailSent: true,
            emailRecipient: 'elena.caretaker@eldercare360.demo',
            dedupeKey: `smart_alert_elena_med_atorvastatin_${todayStr}`,
            createdAt: dateOffset(-5),
          },
          {
            notificationId: 'notif_appt_tomorrow',
            elderlyProfileId: 'profile_arthur',
            userId: 'user_arthur',
            notificationType: 'appointment_reminder',
            title: 'Upcoming Appointment Tomorrow at 10:30',
            message:
              'Cardiology checkup with Dr. Marcus Holloway, MD at Oakridge Senior Medical Pavilion tomorrow at 10:30.',
            severity: 'info',
            readStatus: false,
            emailSent: false,
            dedupeKey: `appt_reminder_appt_cardio_upcoming_${todayStr}`,
            createdAt: dateOffset(-3),
          },
          {
            notificationId: 'notif_dose_taken_morning',
            elderlyProfileId: 'profile_arthur',
            userId: 'user_clara',
            notificationType: 'caregiver_activity',
            title: 'Morning Medications Confirmed',
            message:
              'Elena Vance, RN confirmed Lisinopril (10 mg) at 08:00 and Arthur confirmed Levothyroxine (50 mcg) at 07:00.',
            severity: 'info',
            readStatus: true,
            emailSent: false,
            dedupeKey: null,
            createdAt: dateOffset(-2),
          },
        ])
        .onConflictDoNothing();

      await tx
        .insert(careActivities)
        .values([
          {
            activityId: 'act_1',
            elderlyProfileId: 'profile_arthur',
            actorUserId: 'user_elena',
            actorName: 'Elena Vance, RN',
            actorRole: 'caretaker',
            action: 'Confirmed Lisinopril 10 mg',
            details: 'Morning blood pressure check 126/78 mmHg recorded.',
            createdAt: dateOffset(-2),
          },
          {
            activityId: 'act_2',
            elderlyProfileId: 'profile_arthur',
            actorUserId: 'user_arthur',
            actorName: 'Arthur Pendelton',
            actorRole: 'elderly',
            action: 'Marked Levothyroxine 50 mcg Taken',
            details: 'Taken before breakfast with water.',
            createdAt: dateOffset(-3),
          },
          {
            activityId: 'act_3',
            elderlyProfileId: 'profile_arthur',
            actorUserId: 'user_elena',
            actorName: 'Elena Vance, RN',
            actorRole: 'caretaker',
            action: 'Updated Cardiology Appointment Notes',
            details: 'Added reminder to bring 14-day blood pressure log.',
            createdAt: dateOffset(-24),
          },
        ])
        .onConflictDoNothing();
    });
  } catch (error) {
    console.error('[WellAge Seed Error]', error);
    throw new Error('Failed to initialize default care records.', { cause: error });
  }
}
