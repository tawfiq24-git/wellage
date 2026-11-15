import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import QRCode from 'qrcode';
import {
  createAuthMiddleware,
  sanitizeUser,
  signSessionToken,
  verifySecret,
  type AuthenticatedRequest,
} from './server/auth.ts';
import { generateElderCareAiReply, type ChatTurnInput } from './server/gemini.ts';
import { buildCareAlertEmailHtml, isSmtpConfigured, sendCareEmail } from './server/mailer.ts';
import {
  dispatchNotification,
  runAutomatedReminderScan,
  startReminderScheduler,
} from './server/scheduler.ts';
import type {
  DoseStatus,
  ElderlyProfileRecord,
  FoodInstruction,
  MedicationFrequency,
  UserRecord,
  UserRole,
} from './server/types.ts';
import { dbRepo } from './src/db/repository.ts';
import { ensureDatabaseSeeded } from './src/db/seed.ts';
import { adminAuth } from './src/lib/firebase-admin.ts';

const PORT = Number(process.env.PORT || 3000);
const app = express();
app.use(express.json({ limit: '1mb' }));

const asyncRoute =
  (fn: (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void) =>
  (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };

const requireAuth = createAuthMiddleware({
  getUserById: (id) => dbRepo.getUserById(id),
  getUserByFirebaseUid: (uid) => dbRepo.getUserByFirebaseUid(uid),
  ensureSeeded: () => ensureDatabaseSeeded(),
});

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatProfileForUser(profile: ElderlyProfileRecord, user: UserRecord) {
  const canSeePasscode = user.role === 'elderly' || user.role === 'caretaker';
  return {
    id: profile.id,
    ownerUserId: profile.ownerUserId,
    fullName: profile.fullName,
    age: profile.age,
    bloodGroup: profile.bloodGroup,
    allergies: profile.allergies,
    primaryConditions: profile.primaryConditions,
    physicianName: profile.physicianName,
    physicianPhone: profile.physicianPhone,
    passcode: canSeePasscode ? profile.passcodePlain : '••••••',
    qrInviteToken: canSeePasscode ? profile.qrInviteToken : null,
    avatarUrl: profile.avatarUrl || null,
    createdAt: profile.createdAt,
    updatedAt: profile.updatedAt,
  };
}

async function assertProfileAccess(
  req: AuthenticatedRequest,
  res: Response,
  profileId: string,
  allowedRoles?: UserRole[],
): Promise<ElderlyProfileRecord | null> {
  const user = req.authUser;
  if (!user) {
    res.status(401).json({ error: 'Authentication required.' });
    return null;
  }
  const profile = await dbRepo.getProfileById(profileId);
  if (!profile) {
    res.status(404).json({ error: 'Elderly profile not found.' });
    return null;
  }
  const hasAccess = await dbRepo.userHasProfileAccess(user, profileId);
  if (!hasAccess) {
    res.status(403).json({ error: 'You are not authorized to access this care profile.' });
    return null;
  }
  if (allowedRoles && !allowedRoles.includes(user.role)) {
    res.status(403).json({
      error: `Role "${user.role}" does not have permission for this action.`,
    });
    return null;
  }
  return profile;
}

// Health check
app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'WellAge API',
    smtpConfigured: isSmtpConfigured(),
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    ),
    timestamp: new Date().toISOString(),
  });
});

// ---------------- AUTHENTICATION ----------------

app.post(
  '/api/auth/firebase',
  asyncRoute(async (req, res) => {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
      res.status(401).json({ error: 'Firebase ID token is required.' });
      return;
    }

    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      res.status(401).json({ error: 'Invalid or expired Firebase authentication token.' });
      return;
    }

    await ensureDatabaseSeeded();

    const { role, passcode, relationship, specialization } = req.body || {};
    const validRoles: UserRole[] = ['elderly', 'family', 'caretaker'];
    const requestedRole: UserRole = validRoles.includes(role) ? role : 'elderly';

    try {
      const user = await dbRepo.upsertFirebaseUser({
        firebaseUid: decoded.uid,
        email: decoded.email || `${decoded.uid}@users.wellage.app`,
        name: decoded.name || decoded.email?.split('@')[0] || 'WellAge Member',
        avatarUrl: decoded.picture || null,
        requestedRole,
        passcode: typeof passcode === 'string' ? passcode : undefined,
        relationship: typeof relationship === 'string' ? relationship : undefined,
        specialization: typeof specialization === 'string' ? specialization : undefined,
      });

      const accessible = await dbRepo.getAccessibleProfilesForUser(user);
      res.json({
        token,
        user: sanitizeUser(user),
        profiles: accessible.map((p) => formatProfileForUser(p, user)),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PASSCODE') {
        res.status(400).json({
          error:
            'Invalid care profile passcode. Double-check the 6-digit passcode or leave it blank to connect later.',
        });
        return;
      }
      throw error;
    }
  }),
);

app.post(
  '/api/auth/register',
  asyncRoute(async (req, res) => {
    await ensureDatabaseSeeded();
    const {
      name,
      email,
      password,
      phone,
      role,
      age,
      bloodGroup,
      physicianName,
      physicianPhone,
      passcode,
      relationship,
      specialization,
    } = req.body || {};

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      res.status(400).json({ error: 'Please provide your full name (at least 2 characters).' });
      return;
    }
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      res.status(400).json({ error: 'Please provide a valid email address.' });
      return;
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' });
      return;
    }
    const validRoles: UserRole[] = ['elderly', 'family', 'caretaker'];
    if (!validRoles.includes(role)) {
      res.status(400).json({ error: 'Role must be elderly, family, or caretaker.' });
      return;
    }

    const existing = await dbRepo.getUserByEmail(email);
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    try {
      const newUser = await dbRepo.registerPasswordUser({
        name,
        email,
        password,
        phone: typeof phone === 'string' ? phone : '',
        role,
        age: Number(age) > 0 ? Number(age) : 70,
        bloodGroup: typeof bloodGroup === 'string' ? bloodGroup : 'O+',
        physicianName: typeof physicianName === 'string' ? physicianName : '',
        physicianPhone: typeof physicianPhone === 'string' ? physicianPhone : '',
        passcode: typeof passcode === 'string' ? passcode : undefined,
        relationship: typeof relationship === 'string' ? relationship : undefined,
        specialization: typeof specialization === 'string' ? specialization : undefined,
      });

      const token = signSessionToken(newUser);
      const accessible = await dbRepo.getAccessibleProfilesForUser(newUser);

      res.status(201).json({
        token,
        user: sanitizeUser(newUser),
        profiles: accessible.map((p) => formatProfileForUser(p, newUser)),
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PASSCODE') {
        res.status(400).json({
          error:
            'Invalid care profile passcode. Double-check the 6-digit passcode or leave it blank to connect later.',
        });
        return;
      }
      throw error;
    }
  }),
);

app.post(
  '/api/auth/login',
  asyncRoute(async (req, res) => {
    await ensureDatabaseSeeded();
    const { email, password } = req.body || {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const user = await dbRepo.getUserByEmail(String(email));
    if (!user || !user.passwordHash || !verifySecret(String(password), user.passwordHash)) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const token = signSessionToken(user);
    const accessible = await dbRepo.getAccessibleProfilesForUser(user);

    res.json({
      token,
      user: sanitizeUser(user),
      profiles: accessible.map((p) => formatProfileForUser(p, user)),
    });
  }),
);

app.post(
  '/api/auth/demo',
  asyncRoute(async (req, res) => {
    await ensureDatabaseSeeded();
    const { role } = req.body || {};
    const roleMap: Record<string, string> = {
      elderly: 'user_arthur',
      family: 'user_clara',
      caretaker: 'user_elena',
    };
    const userId = roleMap[String(role)];
    if (!userId) {
      res.status(400).json({ error: 'Demo role must be elderly, family, or caretaker.' });
      return;
    }

    const user = await dbRepo.getUserById(userId);
    if (!user) {
      res.status(404).json({ error: 'Demo account not found.' });
      return;
    }

    const token = signSessionToken(user);
    const accessible = await dbRepo.getAccessibleProfilesForUser(user);

    res.json({
      token,
      user: sanitizeUser(user),
      profiles: accessible.map((p) => formatProfileForUser(p, user)),
    });
  }),
);

app.get(
  '/api/auth/me',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    const accessible = await dbRepo.getAccessibleProfilesForUser(user);
    res.json({
      user: sanitizeUser(user),
      profiles: accessible.map((p) => formatProfileForUser(p, user)),
    });
  }),
);

// ---------------- PROFILES & CARE CIRCLE CONNECTION ----------------

app.get(
  '/api/profiles',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    const accessible = await dbRepo.getAccessibleProfilesForUser(user);
    res.json({ profiles: accessible.map((p) => formatProfileForUser(p, user)) });
  }),
);

app.post(
  '/api/profiles/connect',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    if (user.role === 'elderly') {
      res.status(403).json({ error: 'Elderly accounts manage their own primary profile.' });
      return;
    }

    const { passcode, qrToken, relationship, specialization } = req.body || {};
    if (!qrToken && !passcode) {
      res.status(400).json({ error: 'Provide either a 6-digit passcode or QR invite token.' });
      return;
    }

    const matchedProfile = await dbRepo.connectUserToProfile({
      user,
      passcode: typeof passcode === 'string' ? passcode : undefined,
      qrToken: typeof qrToken === 'string' ? qrToken : undefined,
      relationship: typeof relationship === 'string' ? relationship : undefined,
      specialization: typeof specialization === 'string' ? specialization : undefined,
    });

    if (!matchedProfile) {
      res.status(404).json({ error: 'No elderly profile matched that passcode or QR token.' });
      return;
    }

    await dispatchNotification({
      elderlyProfileId: matchedProfile.id,
      recipientUserIds: [matchedProfile.ownerUserId],
      type: 'caregiver_activity',
      title: 'New Care Circle Member Connected',
      message: `${user.name} (${user.role}) connected to ${matchedProfile.fullName}'s care profile.`,
      severity: 'info',
      sendEmail: true,
    });

    res.json({
      profile: formatProfileForUser(matchedProfile, user),
      message: `Connected to ${matchedProfile.fullName}'s care profile.`,
    });
  }),
);

app.post(
  '/api/profiles/:profileId/passcode/rotate',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const rotated = await dbRepo.rotatePasscode({
      profileId: profile.id,
      actor: req.authUser!,
    });
    res.json(rotated);
  }),
);

app.get(
  '/api/profiles/:profileId/qr',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const baseUrl =
      process.env.APP_URL && process.env.APP_URL !== 'MY_APP_URL'
        ? process.env.APP_URL.replace(/\/$/, '')
        : `${req.protocol}://${req.get('host')}`;

    const inviteUrl = `${baseUrl}/?connect=${encodeURIComponent(profile.qrInviteToken)}`;
    const qrDataUrl = await QRCode.toDataURL(inviteUrl, {
      width: 280,
      margin: 2,
      color: {
        dark: '#0F172A',
        light: '#FFFFFF',
      },
    });

    res.json({
      qrDataUrl,
      inviteUrl,
      qrInviteToken: profile.qrInviteToken,
      note: 'QR payload contains only an opaque authorization token—zero medical records or PII.',
    });
  }),
);

app.get(
  '/api/profiles/:profileId/care-circle',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const details = await dbRepo.getCareCircleDetails(profile.id);
    if (!details) {
      res.status(404).json({ error: 'Care circle not found.' });
      return;
    }

    res.json({
      elderlyOwner: details.owner ? sanitizeUser(details.owner) : null,
      family: details.family,
      caretakers: details.caretakers,
      activities: details.activities,
    });
  }),
);

// ---------------- MEDICATIONS ----------------

app.get(
  '/api/profiles/:profileId/medications',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const todayStr = getTodayDateString();
    const [meds, logs] = await Promise.all([
      dbRepo.getMedications(profile.id),
      dbRepo.getMedicationLogs(profile.id, 150),
    ]);
    const todayLogs = logs.filter((l) => l.scheduledDate === todayStr);

    res.json({
      todayDate: todayStr,
      medications: meds,
      todayLogs,
      logs,
    });
  }),
);

app.post(
  '/api/profiles/:profileId/medications',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const {
      name,
      dosage,
      instructions,
      foodInstruction,
      frequency,
      timings,
      startDate,
      endDate,
      prescribedBy,
    } = req.body || {};

    if (!name || typeof name !== 'string' || !name.trim()) {
      res.status(400).json({ error: 'Medicine name is required.' });
      return;
    }
    if (!dosage || typeof dosage !== 'string' || !dosage.trim()) {
      res.status(400).json({ error: 'Dosage information is required.' });
      return;
    }
    const cleanTimings = Array.isArray(timings)
      ? timings.map((t) => String(t).trim()).filter((t) => /^\d{2}:\d{2}$/.test(t))
      : [];
    if (cleanTimings.length === 0) {
      res.status(400).json({ error: 'At least one valid daily timing (HH:mm) is required.' });
      return;
    }

    const validFood: FoodInstruction[] = ['before_food', 'after_food', 'with_food', 'anytime'];
    const validFreq: MedicationFrequency[] = [
      'daily',
      'twice_daily',
      'three_times_daily',
      'weekly',
      'as_needed',
    ];

    const med = await dbRepo.createMedication({
      profileId: profile.id,
      actor: req.authUser!,
      name: name.trim(),
      dosage: dosage.trim(),
      instructions: typeof instructions === 'string' ? instructions.trim() : '',
      foodInstruction: validFood.includes(foodInstruction) ? foodInstruction : 'anytime',
      frequency: validFreq.includes(frequency) ? frequency : 'daily',
      timings: cleanTimings.sort(),
      startDate: typeof startDate === 'string' && startDate ? startDate : getTodayDateString(),
      endDate: typeof endDate === 'string' ? endDate : '',
      prescribedBy:
        typeof prescribedBy === 'string' && prescribedBy.trim()
          ? prescribedBy.trim()
          : profile.physicianName,
    });

    const recipients = (await dbRepo.getAuthorizedCareCircleRecipients(profile.id))
      .filter((u) => u.id !== req.authUser!.id)
      .map((u) => u.id);

    await dispatchNotification({
      elderlyProfileId: profile.id,
      recipientUserIds: recipients,
      type: 'schedule_update',
      title: `New Medication Added: ${med.name}`,
      message: `${req.authUser!.name} added ${med.name} (${med.dosage}) at ${med.timings.join(', ')} for ${profile.fullName}.`,
      severity: 'info',
      sendEmail: true,
    });

    res.status(201).json({ medication: med });
  }),
);

app.put(
  '/api/profiles/:profileId/medications/:medId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const {
      name,
      dosage,
      instructions,
      foodInstruction,
      frequency,
      timings,
      startDate,
      endDate,
      prescribedBy,
      isActive,
    } = req.body || {};

    const cleanTimings = Array.isArray(timings)
      ? timings
          .map((t) => String(t).trim())
          .filter((t) => /^\d{2}:\d{2}$/.test(t))
          .sort()
      : undefined;

    const med = await dbRepo.updateMedication({
      profileId: profile.id,
      medId: req.params.medId,
      actor: req.authUser!,
      patch: {
        name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
        dosage: typeof dosage === 'string' && dosage.trim() ? dosage.trim() : undefined,
        instructions: typeof instructions === 'string' ? instructions.trim() : undefined,
        foodInstruction: ['before_food', 'after_food', 'with_food', 'anytime'].includes(
          foodInstruction,
        )
          ? foodInstruction
          : undefined,
        frequency: [
          'daily',
          'twice_daily',
          'three_times_daily',
          'weekly',
          'as_needed',
        ].includes(frequency)
          ? frequency
          : undefined,
        timings: cleanTimings && cleanTimings.length > 0 ? cleanTimings : undefined,
        startDate: typeof startDate === 'string' && startDate ? startDate : undefined,
        endDate: typeof endDate === 'string' ? endDate : undefined,
        prescribedBy: typeof prescribedBy === 'string' ? prescribedBy.trim() : undefined,
        isActive: typeof isActive === 'boolean' ? isActive : undefined,
      },
    });

    if (!med) {
      res.status(404).json({ error: 'Medication not found.' });
      return;
    }

    const recipients = (await dbRepo.getAuthorizedCareCircleRecipients(profile.id))
      .filter((u) => u.id !== req.authUser!.id)
      .map((u) => u.id);

    await dispatchNotification({
      elderlyProfileId: profile.id,
      recipientUserIds: recipients,
      type: 'schedule_update',
      title: `Medication Schedule Updated: ${med.name}`,
      message: `${req.authUser!.name} updated ${med.name} (${med.dosage}) timings to ${med.timings.join(', ')} for ${profile.fullName}.`,
      severity: 'info',
      sendEmail: false,
    });

    res.json({ medication: med });
  }),
);

app.delete(
  '/api/profiles/:profileId/medications/:medId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const deletedId = await dbRepo.deleteMedication({
      profileId: profile.id,
      medId: req.params.medId,
      actor: req.authUser!,
    });

    if (!deletedId) {
      res.status(404).json({ error: 'Medication not found.' });
      return;
    }

    res.json({ deletedId });
  }),
);

app.post(
  '/api/profiles/:profileId/medication-logs',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const { medicationId, scheduledDate, scheduledTime, status, notes } = req.body || {};
    const validStatuses: DoseStatus[] = ['taken', 'skipped', 'missed'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({ error: 'Status must be taken, skipped, or missed.' });
      return;
    }

    const med = await dbRepo.getMedicationById(profile.id, String(medicationId || ''));
    if (!med) {
      res.status(404).json({ error: 'Medication not found.' });
      return;
    }

    const dateStr =
      typeof scheduledDate === 'string' && scheduledDate ? scheduledDate : getTodayDateString();
    const timeStr =
      typeof scheduledTime === 'string' && /^\d{2}:\d{2}$/.test(scheduledTime)
        ? scheduledTime
        : med.timings[0] || '08:00';

    const savedLog = await dbRepo.upsertMedicationLog({
      profileId: profile.id,
      med,
      scheduledDate: dateStr,
      scheduledTime: timeStr,
      status,
      notes: typeof notes === 'string' ? notes : undefined,
      actorId: req.authUser!.id,
      actorName: req.authUser!.name,
      actorRole: req.authUser!.role,
      recordActivity: true,
    });

    if (status === 'missed' || status === 'skipped') {
      const familyAndCaretakers = (await dbRepo.getAuthorizedCareCircleRecipients(profile.id))
        .filter((u) => (u.role === 'family' || u.role === 'caretaker') && u.id !== req.authUser!.id)
        .map((u) => u.id);

      if (familyAndCaretakers.length > 0) {
        await dispatchNotification({
          elderlyProfileId: profile.id,
          recipientUserIds: familyAndCaretakers,
          type: status === 'missed' ? 'missed_dose' : 'caregiver_activity',
          title:
            status === 'missed'
              ? `Missed Dose Reported: ${med.name} (${timeStr})`
              : `Dose Skipped: ${med.name} (${timeStr})`,
          message: `${profile.fullName}'s ${med.name} (${med.dosage}) at ${timeStr} was marked ${status} by ${req.authUser!.name}. Never recommend taking a double dose without clinician advice.`,
          severity: status === 'missed' ? 'warning' : 'info',
          sendEmail: status === 'missed',
        });
      }
    }

    res.json({ log: savedLog });
  }),
);

// ---------------- APPOINTMENTS ----------------

app.get(
  '/api/profiles/:profileId/appointments',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const appts = await dbRepo.getAppointments(profile.id);
    res.json({ appointments: appts });
  }),
);

app.post(
  '/api/profiles/:profileId/appointments',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const {
      doctorName,
      specialty,
      clinicName,
      date,
      time,
      purpose,
      doctorPhone,
      doctorEmail,
      notes,
    } = req.body || {};

    if (!doctorName || !clinicName || !date || !time || !purpose) {
      res.status(400).json({
        error: 'Doctor name, clinic name, date, time, and purpose are required.',
      });
      return;
    }

    const appt = await dbRepo.createAppointment({
      profileId: profile.id,
      actor: req.authUser!,
      doctorName: String(doctorName).trim(),
      specialty:
        typeof specialty === 'string' && specialty.trim()
          ? specialty.trim()
          : 'General Practice',
      clinicName: String(clinicName).trim(),
      date: String(date).trim(),
      time: String(time).trim(),
      purpose: String(purpose).trim(),
      doctorPhone: typeof doctorPhone === 'string' ? doctorPhone.trim() : '',
      doctorEmail: typeof doctorEmail === 'string' ? doctorEmail.trim() : '',
      notes: typeof notes === 'string' ? notes.trim() : '',
    });

    const recipients = (await dbRepo.getAuthorizedCareCircleRecipients(profile.id))
      .filter((u) => u.id !== req.authUser!.id)
      .map((u) => u.id);

    await dispatchNotification({
      elderlyProfileId: profile.id,
      recipientUserIds: recipients,
      type: 'appointment_reminder',
      title: `New Appointment Scheduled: ${appt.doctorName}`,
      message: `${req.authUser!.name} scheduled ${appt.purpose} with ${appt.doctorName} at ${appt.clinicName} on ${appt.date} at ${appt.time}.`,
      severity: 'info',
      sendEmail: true,
    });

    res.status(201).json({ appointment: appt });
  }),
);

app.put(
  '/api/profiles/:profileId/appointments/:apptId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const {
      doctorName,
      specialty,
      clinicName,
      date,
      time,
      purpose,
      doctorPhone,
      doctorEmail,
      status,
      notes,
    } = req.body || {};

    const appt = await dbRepo.updateAppointment({
      profileId: profile.id,
      apptId: req.params.apptId,
      actor: req.authUser!,
      patch: {
        doctorName:
          typeof doctorName === 'string' && doctorName.trim() ? doctorName.trim() : undefined,
        specialty: typeof specialty === 'string' ? specialty.trim() : undefined,
        clinicName:
          typeof clinicName === 'string' && clinicName.trim() ? clinicName.trim() : undefined,
        date: typeof date === 'string' && date.trim() ? date.trim() : undefined,
        time: typeof time === 'string' && time.trim() ? time.trim() : undefined,
        purpose: typeof purpose === 'string' && purpose.trim() ? purpose.trim() : undefined,
        doctorPhone: typeof doctorPhone === 'string' ? doctorPhone.trim() : undefined,
        doctorEmail: typeof doctorEmail === 'string' ? doctorEmail.trim() : undefined,
        status: ['upcoming', 'completed', 'cancelled'].includes(status) ? status : undefined,
        notes: typeof notes === 'string' ? notes.trim() : undefined,
      },
    });

    if (!appt) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    res.json({ appointment: appt });
  }),
);

app.delete(
  '/api/profiles/:profileId/appointments/:apptId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, ['caretaker']);
    if (!profile) return;

    const deletedId = await dbRepo.deleteAppointment({
      profileId: profile.id,
      apptId: req.params.apptId,
      actor: req.authUser!,
    });

    if (!deletedId) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    res.json({ deletedId });
  }),
);

app.post(
  '/api/profiles/:profileId/appointments/:apptId/remind',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const appt = await dbRepo.getAppointmentById(profile.id, req.params.apptId);
    if (!appt) {
      res.status(404).json({ error: 'Appointment not found.' });
      return;
    }

    const recipients = await dbRepo.getAuthorizedCareCircleRecipients(profile.id);
    const created = await dispatchNotification({
      elderlyProfileId: profile.id,
      recipientUserIds: recipients.map((r) => r.id),
      type: 'appointment_reminder',
      title: `Appointment Reminder: ${appt.doctorName} (${appt.date})`,
      message: `Reminder for ${profile.fullName}: ${appt.purpose} with ${appt.doctorName} at ${appt.clinicName} on ${appt.date} at ${appt.time}.`,
      severity: 'info',
      sendEmail: true,
    });

    const updated = await dbRepo.updateAppointment({
      profileId: profile.id,
      apptId: appt.id,
      patch: { reminderSent: true },
    });

    res.json({
      notifiedCount: created.length,
      smtpConfigured: isSmtpConfigured(),
      appointment: updated || appt,
    });
  }),
);

// ---------------- EMERGENCY CONTACTS ----------------

app.get(
  '/api/profiles/:profileId/emergency-contacts',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const contacts = await dbRepo.getEmergencyContacts(profile.id);
    res.json({ contacts });
  }),
);

app.post(
  '/api/profiles/:profileId/emergency-contacts',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const { name, relationship, phone, email, isPrimary } = req.body || {};
    if (!name || !phone) {
      res.status(400).json({ error: 'Contact name and phone number are required.' });
      return;
    }

    const contact = await dbRepo.createEmergencyContact({
      profileId: profile.id,
      name: String(name).trim(),
      relationship:
        typeof relationship === 'string' && relationship.trim()
          ? relationship.trim()
          : 'Emergency Contact',
      phone: String(phone).trim(),
      email: typeof email === 'string' ? email.trim() : '',
      isPrimary: Boolean(isPrimary),
    });

    res.status(201).json({ contact });
  }),
);

app.delete(
  '/api/profiles/:profileId/emergency-contacts/:contactId',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId, [
      'elderly',
      'caretaker',
    ]);
    if (!profile) return;

    const deletedId = await dbRepo.deleteEmergencyContact(
      profile.id,
      req.params.contactId,
    );
    if (!deletedId) {
      res.status(404).json({ error: 'Emergency contact not found.' });
      return;
    }

    res.json({ deletedId });
  }),
);

// ---------------- ANALYTICS & REPORTS ----------------

app.get(
  '/api/profiles/:profileId/analytics',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const todayStr = getTodayDateString();
    const [allMeds, logs] = await Promise.all([
      dbRepo.getMedications(profile.id),
      dbRepo.getMedicationLogs(profile.id),
    ]);
    const meds = allMeds.filter((m) => m.isActive);
    const todayLogs = logs.filter((l) => l.scheduledDate === todayStr);

    let todayTotal = 0;
    let todayTaken = 0;
    let todayMissed = 0;
    let todaySkipped = 0;
    let todayPending = 0;

    for (const med of meds) {
      for (const timeStr of med.timings) {
        todayTotal++;
        const log = todayLogs.find(
          (l) => l.medicationId === med.id && l.scheduledTime === timeStr,
        );
        if (!log) {
          todayPending++;
        } else if (log.status === 'taken') {
          todayTaken++;
        } else if (log.status === 'missed') {
          todayMissed++;
        } else if (log.status === 'skipped') {
          todaySkipped++;
        }
      }
    }

    const resolvedToday = todayTaken + todayMissed + todaySkipped;
    const dailyAdherencePct =
      resolvedToday > 0
        ? Math.round((todayTaken / resolvedToday) * 100)
        : todayTotal > 0
          ? 100
          : 0;

    const cutoff30 = new Date();
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoffStr = cutoff30.toISOString().slice(0, 10);
    const last30Logs = logs.filter((l) => l.scheduledDate >= cutoffStr);

    const totalTaken30 = last30Logs.filter((l) => l.status === 'taken').length;
    const totalMissed30 = last30Logs.filter((l) => l.status === 'missed').length;
    const totalSkipped30 = last30Logs.filter((l) => l.status === 'skipped').length;
    const totalResolved30 = totalTaken30 + totalMissed30 + totalSkipped30;
    const overallAdherencePct =
      totalResolved30 > 0 ? Math.round((totalTaken30 / totalResolved30) * 100) : 100;

    const weeklySeries: Array<{
      date: string;
      label: string;
      taken: number;
      missed: number;
      skipped: number;
      adherencePct: number;
    }> = [];

    for (let offset = -6; offset <= 0; offset++) {
      const d = new Date();
      d.setDate(d.getDate() + offset);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const dStr = `${y}-${m}-${day}`;
      const dayLogs = logs.filter((l) => l.scheduledDate === dStr);
      const taken = dayLogs.filter((l) => l.status === 'taken').length;
      const missed = dayLogs.filter((l) => l.status === 'missed').length;
      const skipped = dayLogs.filter((l) => l.status === 'skipped').length;
      const denom = taken + missed + skipped;
      weeklySeries.push({
        date: dStr,
        label: d.toLocaleDateString('en-US', { weekday: 'short' }),
        taken,
        missed,
        skipped,
        adherencePct: denom > 0 ? Math.round((taken / denom) * 100) : 0,
      });
    }

    const missedByMedication = new Map<string, { name: string; count: number }>();
    const cutoff72h = Date.now() - 72 * 3600 * 1000;
    for (const l of logs) {
      if (l.status === 'missed' && new Date(l.recordedAt).getTime() >= cutoff72h) {
        const current = missedByMedication.get(l.medicationId) || {
          name: l.medicationName,
          count: 0,
        };
        current.count++;
        missedByMedication.set(l.medicationId, current);
      }
    }
    const smartCareAlerts = Array.from(missedByMedication.entries())
      .filter(([, val]) => val.count >= 2)
      .map(([medicationId, val]) => ({
        medicationId,
        medicationName: val.name,
        missedCount: val.count,
        message: `${val.name} was missed ${val.count} times in the last 72 hours. Caregiver review recommended.`,
      }));

    res.json({
      today: {
        totalScheduled: todayTotal,
        taken: todayTaken,
        pending: todayPending,
        missed: todayMissed,
        skipped: todaySkipped,
        adherencePct: dailyAdherencePct,
      },
      thirtyDay: {
        taken: totalTaken30,
        missed: totalMissed30,
        skipped: totalSkipped30,
        adherencePct: overallAdherencePct,
      },
      weeklySeries,
      smartCareAlerts,
    });
  }),
);

// ---------------- NOTIFICATIONS ----------------

app.get(
  '/api/notifications',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    const accessible = await dbRepo.getAccessibleProfilesForUser(user);
    const notifs = await dbRepo.getNotificationsForUser(
      user.id,
      accessible.map((p) => p.id),
    );

    res.json({
      notifications: notifs,
      unreadCount: notifs.filter((n) => !n.read).length,
      smtpConfigured: isSmtpConfigured(),
    });
  }),
);

app.patch(
  '/api/notifications/:notifId/read',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    const notif = await dbRepo.markNotificationRead(user.id, req.params.notifId);
    if (!notif) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ notification: notif });
  }),
);

app.post(
  '/api/notifications/read-all',
  requireAuth,
  asyncRoute(async (req, res) => {
    const updated = await dbRepo.markAllNotificationsRead(req.authUser!.id);
    res.json({ updated });
  }),
);

app.post(
  '/api/notifications/run-check',
  requireAuth,
  asyncRoute(async (_req, res) => {
    const summary = await runAutomatedReminderScan();
    res.json({
      summary,
      smtpConfigured: isSmtpConfigured(),
    });
  }),
);

app.post(
  '/api/notifications/test-email',
  requireAuth,
  asyncRoute(async (req, res) => {
    const user = req.authUser!;
    const result = await sendCareEmail({
      to: user.email,
      subject: '[WellAge] Email Alert Verification',
      text: `Hello ${user.name}, your WellAge automated alert channel is verified.`,
      html: buildCareAlertEmailHtml({
        recipientName: user.name,
        elderName: 'Care Circle Verification',
        title: 'Email Notification Test',
        message:
          'Your WellAge automated medication and appointment alert channel is configured and working.',
        severity: 'info',
      }),
    });
    res.json(result);
  }),
);

// ---------------- GEMINI AI HEALTHCARE ASSISTANT ----------------

function buildWelcomeMessage(profileName: string): string {
  return `Hello! I'm WellAge AI. How can I help you today? I can walk you through ${profileName}'s saved medications, missed doses, upcoming appointments, weekly adherence report, or healthy daily habits.`;
}

app.get(
  '/api/profiles/:profileId/ai/history',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const saved = await dbRepo.getAiChatHistory(profile.id, req.authUser!.id);
    if (saved.length === 0) {
      res.json({
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            text: buildWelcomeMessage(profile.fullName),
            createdAt: new Date().toISOString(),
          },
        ],
      });
      return;
    }

    res.json({
      messages: saved.map((m) => ({
        id: m.id,
        role: m.role,
        text: m.text,
        createdAt: m.createdAt,
      })),
    });
  }),
);

app.delete(
  '/api/profiles/:profileId/ai/history',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    await dbRepo.clearAiChatHistory(profile.id, req.authUser!.id);
    res.json({
      cleared: true,
      welcomeMessage: {
        id: 'welcome',
        role: 'assistant',
        text: buildWelcomeMessage(profile.fullName),
        createdAt: new Date().toISOString(),
      },
    });
  }),
);

app.post(
  '/api/profiles/:profileId/ai/chat',
  requireAuth,
  asyncRoute(async (req, res) => {
    const profile = await assertProfileAccess(req, res, req.params.profileId);
    if (!profile) return;

    const { message, history } = req.body || {};
    if (!message || typeof message !== 'string' || !message.trim()) {
      res.status(400).json({ error: 'Message text is required.' });
      return;
    }

    const trimmedMessage = message.trim();
    const userId = req.authUser!.id;
    const todayStr = getTodayDateString();

    const [meds, allLogs, appts, contacts, storedHistoryRows] = await Promise.all([
      dbRepo.getMedications(profile.id),
      dbRepo.getMedicationLogs(profile.id, 120),
      dbRepo.getAppointments(profile.id),
      dbRepo.getEmergencyContacts(profile.id),
      dbRepo.getAiChatHistory(profile.id, userId),
    ]);

    const todayLogs = allLogs.filter((l) => l.scheduledDate === todayStr);
    const storedHistory = storedHistoryRows
      .slice(-10)
      .map((m) => ({ role: m.role, text: m.text }));

    const safeHistory: ChatTurnInput[] =
      Array.isArray(history) && history.length > 0
        ? history
            .filter(
              (h): h is ChatTurnInput =>
                h &&
                (h.role === 'user' || h.role === 'assistant') &&
                typeof h.text === 'string' &&
                h.text.trim().length > 0,
            )
            .slice(-10)
        : storedHistory;

    try {
      const result = await generateElderCareAiReply(trimmedMessage, safeHistory, {
        userName: req.authUser!.name,
        userRole: req.authUser!.role,
        profile,
        medications: meds,
        todayLogs,
        recentLogs: allLogs,
        appointments: appts,
        emergencyContacts: contacts,
        todayDate: todayStr,
      });

      const saved = await dbRepo.saveAiChatExchange({
        profileId: profile.id,
        userId,
        userText: trimmedMessage,
        assistantText: result.reply,
      });

      res.json({
        ...result,
        userMessage: saved.userMessage,
        assistantMessage: saved.assistantMessage,
      });
    } catch (err) {
      console.error('[WellAge AI Error]', err);
      const rawMsg = err instanceof Error ? err.message : 'AI service error';
      const lower = rawMsg.toLowerCase();

      if (
        lower.includes('api_key_invalid') ||
        lower.includes('api key not valid') ||
        lower.includes('permission_denied')
      ) {
        res.status(502).json({
          error:
            'WellAge AI could not authenticate with the Gemini service. Please verify GEMINI_API_KEY in server configuration.',
        });
        return;
      }
      if (lower.includes('resource_exhausted') || lower.includes('429')) {
        res.status(429).json({
          error:
            'WellAge AI is temporarily busy due to rate limits. Please wait a moment and try again.',
        });
        return;
      }
      res.status(502).json({
        error: 'WellAge AI could not reach the assistant service right now. Please try again.',
      });
    }
  }),
);

// Centralized Express error handler (prevents leaking raw SQL errors)
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[WellAge API Error]', err);
  if (res.headersSent) return;
  const message =
    err instanceof Error && err.message
      ? err.message
      : 'An unexpected server error occurred.';
  res.status(500).json({ error: message });
});

// ---------------- VITE / STATIC SERVING ----------------

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    if (fs.existsSync(distDir)) {
      app.use(express.static(distDir));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distDir, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WellAge running on http://0.0.0.0:${PORT}`);
    startReminderScheduler();
  });
}

startServer().catch((err) => {
  console.error('Failed to start WellAge server:', err);
  process.exit(1);
});
