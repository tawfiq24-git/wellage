import { dbRepo } from '../src/db/repository.ts';
import { ensureDatabaseSeeded } from '../src/db/seed.ts';
import { buildCareAlertEmailHtml, sendCareEmail } from './mailer.ts';
import type { NotificationRecord, NotificationType } from './types.ts';

function getTodayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseMinutesSinceMidnight(timeHHmm: string): number {
  const [hStr, mStr] = timeHHmm.split(':');
  return Number(hStr) * 60 + Number(mStr);
}

export async function dispatchNotification(params: {
  elderlyProfileId: string;
  recipientUserIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  dedupeKey?: string;
  sendEmail?: boolean;
}): Promise<NotificationRecord[]> {
  const created: NotificationRecord[] = [];
  const profile = await dbRepo.getProfileById(params.elderlyProfileId);
  if (!profile) return created;

  for (const recipientId of params.recipientUserIds) {
    const user = await dbRepo.getUserById(recipientId);
    if (!user) continue;

    const perUserDedupe = params.dedupeKey
      ? `${params.dedupeKey}_${recipientId}`
      : undefined;

    if (perUserDedupe) {
      const exists = await dbRepo.notificationDedupeExists(perUserDedupe);
      if (exists) continue;
    }

    let emailSent = false;
    if (params.sendEmail && user.email) {
      const result = await sendCareEmail({
        to: user.email,
        subject: `[WellAge] ${params.title}`,
        text: `${params.title}\n\n${params.message}\n\nCare Profile: ${profile.fullName}`,
        html: buildCareAlertEmailHtml({
          recipientName: user.name,
          elderName: profile.fullName,
          title: params.title,
          message: params.message,
          severity: params.severity,
        }),
      });
      emailSent = result.sent;
    }

    const record = await dbRepo.insertNotification({
      elderlyProfileId: params.elderlyProfileId,
      recipientUserId: recipientId,
      type: params.type,
      title: params.title,
      message: params.message,
      severity: params.severity,
      emailSent,
      emailRecipient: user.email,
      dedupeKey: perUserDedupe,
    });

    if (record) {
      created.push(record);
    }
  }

  return created;
}

export async function runAutomatedReminderScan(): Promise<{
  upcomingDosesAlerted: number;
  missedDosesMarked: number;
  smartCareAlertsCreated: number;
  appointmentRemindersSent: number;
}> {
  await ensureDatabaseSeeded();

  const now = new Date();
  const todayStr = getTodayDateString();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  let upcomingDosesAlerted = 0;
  let missedDosesMarked = 0;
  let smartCareAlertsCreated = 0;
  let appointmentRemindersSent = 0;

  const profiles = await dbRepo.getAllProfiles();

  for (const profile of profiles) {
    const recipients = await dbRepo.getAuthorizedCareCircleRecipients(profile.id);
    const elderAndCareRecipients = recipients.map((r) => r.id);
    const familyAndCaretakers = recipients
      .filter((r) => r.role === 'family' || r.role === 'caretaker')
      .map((r) => r.id);

    const allMeds = await dbRepo.getMedications(profile.id);
    const activeMeds = allMeds.filter(
      (m) =>
        m.isActive &&
        m.startDate <= todayStr &&
        (!m.endDate || m.endDate >= todayStr),
    );

    const profileLogs = await dbRepo.getMedicationLogs(profile.id);

    for (const med of activeMeds) {
      for (const timeStr of med.timings) {
        const schedMinutes = parseMinutesSinceMidnight(timeStr);
        const existingLog = profileLogs.find(
          (l) =>
            l.medicationId === med.id &&
            l.scheduledDate === todayStr &&
            l.scheduledTime === timeStr,
        );

        if (existingLog) continue;

        const diffMinutes = schedMinutes - nowMinutes;

        if (diffMinutes >= 0 && diffMinutes <= 30) {
          const created = await dispatchNotification({
            elderlyProfileId: profile.id,
            recipientUserIds: elderAndCareRecipients,
            type: 'upcoming_dose',
            title: `Upcoming Dose: ${med.name} (${timeStr})`,
            message: `${profile.fullName} has ${med.name} (${med.dosage}) scheduled at ${timeStr} (${med.foodInstruction.replace('_', ' ')}).`,
            severity: 'info',
            dedupeKey: `upcoming_${med.id}_${todayStr}_${timeStr}`,
            sendEmail: false,
          });
          upcomingDosesAlerted += created.length;
        }

        if (nowMinutes - schedMinutes > 45) {
          const missedLog = await dbRepo.upsertMedicationLog({
            profileId: profile.id,
            med,
            scheduledDate: todayStr,
            scheduledTime: timeStr,
            status: 'missed',
            notes: 'Automatically flagged missed after 45-minute window elapsed.',
            actorId: 'system',
            actorName: 'Automated Monitor',
          });
          profileLogs.unshift(missedLog);
          missedDosesMarked++;

          await dispatchNotification({
            elderlyProfileId: profile.id,
            recipientUserIds: familyAndCaretakers.length
              ? familyAndCaretakers
              : elderAndCareRecipients,
            type: 'missed_dose',
            title: `Missed Dose Alert: ${med.name} (${timeStr})`,
            message: `${profile.fullName} missed ${med.name} (${med.dosage}) scheduled for ${timeStr} today. Do not recommend doubling the next dose without physician advice.`,
            severity: 'warning',
            dedupeKey: `missed_${med.id}_${todayStr}_${timeStr}`,
            sendEmail: true,
          });

          const recentMissedCount = profileLogs.filter(
            (l) =>
              l.medicationId === med.id &&
              l.status === 'missed' &&
              Date.now() - new Date(l.recordedAt).getTime() <= 72 * 3600 * 1000,
          ).length;

          if (recentMissedCount >= 2) {
            const smartCreated = await dispatchNotification({
              elderlyProfileId: profile.id,
              recipientUserIds: familyAndCaretakers,
              type: 'smart_care_alert',
              title: `Smart Care Alert: Repeated Missed Doses (${med.name})`,
              message: `${med.name} has been missed ${recentMissedCount} times in the last 72 hours for ${profile.fullName}. Caregiver follow-up is recommended.`,
              severity: 'critical',
              dedupeKey: `smart_repeat_${med.id}_${todayStr}`,
              sendEmail: true,
            });
            smartCareAlertsCreated += smartCreated.length;
          }
        }
      }
    }

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

    const profileAppts = await dbRepo.getAppointments(profile.id);
    const upcomingAppts = profileAppts.filter(
      (a) =>
        a.status === 'upcoming' &&
        (a.date === todayStr || a.date === tomorrowStr),
    );

    for (const appt of upcomingAppts) {
      const created = await dispatchNotification({
        elderlyProfileId: profile.id,
        recipientUserIds: elderAndCareRecipients,
        type: 'appointment_reminder',
        title: `Appointment Reminder: ${appt.doctorName} (${appt.date})`,
        message: `${profile.fullName} has a visit with ${appt.doctorName} (${appt.specialty}) at ${appt.clinicName} on ${appt.date} at ${appt.time}. Purpose: ${appt.purpose}`,
        severity: 'info',
        dedupeKey: `appt_${appt.id}_${todayStr}`,
        sendEmail: !appt.reminderSent,
      });
      if (created.length > 0) {
        await dbRepo.updateAppointment({
          profileId: profile.id,
          apptId: appt.id,
          patch: { reminderSent: true },
        });
        appointmentRemindersSent += created.length;
      }
    }
  }

  return {
    upcomingDosesAlerted,
    missedDosesMarked,
    smartCareAlertsCreated,
    appointmentRemindersSent,
  };
}

let schedulerHandle: ReturnType<typeof setInterval> | null = null;

export function startReminderScheduler() {
  if (schedulerHandle) return;
  schedulerHandle = setInterval(() => {
    runAutomatedReminderScan().catch((err) =>
      console.error('[Scheduler] Periodic scan failed:', err),
    );
  }, 5 * 60 * 1000);
}
