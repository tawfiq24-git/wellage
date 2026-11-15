import { GoogleGenAI, type GenerateContentResponse } from '@google/genai';
import type {
  AppointmentRecord,
  ElderlyProfileRecord,
  EmergencyContactRecord,
  MedicationLogRecord,
  MedicationRecord,
  UserRole,
} from './types.ts';

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ChatTurnInput {
  role: 'user' | 'assistant';
  text: string;
}

export interface AiChatContext {
  userName: string;
  userRole: UserRole;
  profile: ElderlyProfileRecord;
  medications: MedicationRecord[];
  todayLogs: MedicationLogRecord[];
  recentLogs: MedicationLogRecord[];
  appointments: AppointmentRecord[];
  emergencyContacts: EmergencyContactRecord[];
  todayDate: string;
}

export async function generateElderCareAiReply(
  userMessage: string,
  history: ChatTurnInput[],
  context: AiChatContext,
): Promise<{ reply: string; model: string; configured: boolean }> {
  const ai = getGeminiClient();

  if (!ai) {
    return {
      configured: false,
      model: 'gemini-4-hydrogen',
      reply:
        'WellAge AI is waiting for a Gemini API key to be configured in the server environment (GEMINI_API_KEY). Meanwhile, you can review your saved medication timings in the Medications tab or check upcoming visits in Appointments. Note: WellAge AI provides general information only, not professional medical advice.',
    };
  }

  const activeMeds = context.medications.filter((m) => m.isActive);
  const medSummary = activeMeds.length
    ? activeMeds
        .map((m) => {
          const timingStatuses = m.timings
            .map((t) => {
              const log = context.todayLogs.find(
                (l) => l.medicationId === m.id && l.scheduledTime === t,
              );
              return `${t}: ${log ? log.status : 'pending'}`;
            })
            .join(', ');
          return `- ${m.name} (${m.dosage}) | Frequency: ${m.frequency.replace(/_/g, ' ')} | Food: ${m.foodInstruction.replace(/_/g, ' ')} | Today: [${timingStatuses}] | Instructions: ${m.instructions || 'Take as prescribed'} | Prescribed by: ${m.prescribedBy}`;
        })
        .join('\n')
    : 'No active medications saved yet.';

  // 7-day adherence stats
  const weekCutoff = new Date();
  weekCutoff.setDate(weekCutoff.getDate() - 6);
  const weekCutoffStr = weekCutoff.toISOString().slice(0, 10);
  const weekLogs = context.recentLogs.filter((l) => l.scheduledDate >= weekCutoffStr);
  const weekTaken = weekLogs.filter((l) => l.status === 'taken').length;
  const weekMissed = weekLogs.filter((l) => l.status === 'missed').length;
  const weekSkipped = weekLogs.filter((l) => l.status === 'skipped').length;
  const weekTotal = weekTaken + weekMissed + weekSkipped;
  const weekAdherencePct = weekTotal > 0 ? Math.round((weekTaken / weekTotal) * 100) : 100;

  const recentMissedDetails = weekLogs
    .filter((l) => l.status === 'missed' || l.status === 'skipped')
    .slice(0, 8)
    .map(
      (l) =>
        `- ${l.scheduledDate} at ${l.scheduledTime}: ${l.medicationName} (${l.dosage}) — ${l.status}${l.notes ? ` (${l.notes})` : ''}`,
    )
    .join('\n');

  const upcomingAppts = context.appointments
    .filter((a) => a.status === 'upcoming')
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))
    .slice(0, 6)
    .map(
      (a, idx) =>
        `${idx === 0 ? '[NEXT APPOINTMENT] ' : '- '}${a.date} at ${a.time}: ${a.doctorName} (${a.specialty}) at ${a.clinicName} | Purpose: ${a.purpose}${a.doctorPhone ? ` | Phone: ${a.doctorPhone}` : ''}${a.notes ? ` | Notes: ${a.notes}` : ''}`,
    )
    .join('\n');

  const emergencySummary = context.emergencyContacts.length
    ? context.emergencyContacts
        .map(
          (c) =>
            `- ${c.name} (${c.relationship}): ${c.phone}${c.isPrimary ? ' [Primary]' : ''}`,
        )
        .join('\n')
    : 'No emergency contacts saved yet.';

  const systemInstruction = `You are "WellAge AI" ("Your Caring Healthcare Companion."), a calm, warm, and clear healthcare routine assistant inside the WellAge platform ("Smarter Care. Healthier Aging.").
You are speaking with ${context.userName} (signed-in role: ${context.userRole}) regarding care profile "${context.profile.fullName}" (age ${context.profile.age}, blood group ${context.profile.bloodGroup}).
Today's date is ${context.todayDate}.

STRICT MEDICAL SAFETY RULES (NEVER VIOLATE):
1. NEVER diagnose diseases or medical conditions, and NEVER interpret symptoms as a diagnosis.
2. NEVER prescribe medications, suggest starting or stopping a drug, or recommend changing any dosage.
3. NEVER advise taking a missed dose or taking an extra/double dose—if asked about a missed dose, tell the user not to double up and to check with their prescribing doctor, pharmacist, or pharmacy label.
4. NEVER replace a doctor's professional medical advice.
5. EMERGENCY PROTOCOL: If the user describes serious or urgent symptoms (such as chest pain, trouble breathing, sudden weakness, confusion, fainting, severe bleeding, or an allergic reaction), immediately urge them to call emergency services (e.g., 911) or seek urgent medical help right away, and share their saved primary emergency contact below.
6. Communicate clearly that WellAge AI provides general routine and schedule information only, not professional medical advice.
7. Use simple, warm, easy-to-read sentences suitable for elderly readers. Format lists cleanly and avoid medical jargon.

TODAY'S & SAVED MEDICATION SCHEDULE FOR ${context.profile.fullName}:
${medSummary}

WEEKLY MEDICATION REPORT (LAST 7 DAYS):
- Weekly Adherence Rate: ${weekAdherencePct}% (${weekTaken} taken, ${weekMissed} missed, ${weekSkipped} skipped out of ${weekTotal} logged doses)
- Recent Missed or Skipped Doses:
${recentMissedDetails || 'No missed or skipped doses in the past 7 days.'}

UPCOMING DOCTOR APPOINTMENTS:
${upcomingAppts || 'No upcoming appointments scheduled.'}

KNOWN ALLERGIES: ${context.profile.allergies.length ? context.profile.allergies.join(', ') : 'None listed'}
PHYSICIAN ON FILE: ${context.profile.physicianName} (${context.profile.physicianPhone || 'No phone listed'})
SAVED EMERGENCY CONTACTS:
${emergencySummary}

HOW TO USE WELLAGE (FOR FAMILY, CARETAKERS, AND ELDERLY USERS):
- Medications tab: View the Morning/Afternoon/Evening/Bedtime timeline and tap Taken, Skipped, or Missed. Caretakers can click "Add Medication" (top-right of Medications tab) to add, edit, or delete schedules. Elderly users and family members cannot add/edit clinical prescriptions directly—elderly users can ask their Caretaker to add a new medicine.
- Appointments tab: View upcoming visits, monthly calendar, clinic contacts, and appointment history. Caretakers can schedule or update doctor visits.
- Analytics tab: View daily, weekly, and 30-day adherence charts, caregiver activity logs, and download CSV reports.
- Care Circle & QR tab: Share the 6-digit passcode or QR invite link with authorized family members and caretakers, and tap "Call Now" on Emergency Contacts.
- Notifications tab: Review dose reminders, missed-dose alerts, Smart Care Alerts, and email dispatch status.`;

  const chatHistory = history.slice(-10).map((turn) => ({
    role: turn.role === 'assistant' ? ('model' as const) : ('user' as const),
    parts: [{ text: turn.text }],
  }));

  const chat = ai.chats.create({
    model: 'gemini-4-hydrogen',
    config: {
      systemInstruction,
    },
    history: chatHistory,
  });

  const response: GenerateContentResponse = await chat.sendMessage({
    message: userMessage,
  });

  return {
    configured: true,
    model: 'gemini-4-hydrogen',
    reply:
      response.text?.trim() ||
      'I could not generate a response right now. Please try rephrasing your question or consult your care team.',
  };
}
