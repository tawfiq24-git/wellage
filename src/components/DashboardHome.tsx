import { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  MinusCircle,
  PhoneCall,
  Pill,
  TrendingUp,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnalyticsSummary,
  Appointment,
  CareActivity,
  DoseStatus,
  ElderlyProfile,
  EmergencyContact,
  Medication,
  MedicationLog,
  NotificationItem,
  UserProfile,
} from '../types';

interface DashboardHomeProps {
  user: UserProfile;
  profile: ElderlyProfile;
  medications: Medication[];
  todayLogs: MedicationLog[];
  appointments: Appointment[];
  analytics: AnalyticsSummary | null;
  notifications: NotificationItem[];
  emergencyContacts: EmergencyContact[];
  activities: CareActivity[];
  todayDate: string;
  onLogDose: (
    medicationId: string,
    scheduledTime: string,
    status: DoseStatus,
  ) => Promise<void>;
  onNavigate: (
    tab:
      | 'dashboard'
      | 'medications'
      | 'appointments'
      | 'analytics'
      | 'ai'
      | 'care-circle'
      | 'notifications',
  ) => void;
}

const FOOD_LABELS: Record<string, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  anytime: 'Anytime',
};

export function DashboardHome({
  user,
  profile,
  medications,
  todayLogs,
  appointments,
  analytics,
  notifications,
  emergencyContacts,
  activities,
  todayDate,
  onLogDose,
  onNavigate,
}: DashboardHomeProps) {
  const [now, setNow] = useState(() => new Date());
  const [busyDoseKey, setBusyDoseKey] = useState<string | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const canLogDoses = user.role === 'elderly' || user.role === 'caretaker';
  const upcomingAppointments = appointments.filter((a) => a.status === 'upcoming');
  const primaryEmergency =
    emergencyContacts.find((c) => c.isPrimary) || emergencyContacts[0] || null;

  // Build flat sorted list of today's doses
  const todayDoses = medications
    .filter((m) => m.isActive)
    .flatMap((m) =>
      m.timings.map((time) => {
        const log = todayLogs.find(
          (l) => l.medicationId === m.id && l.scheduledTime === time,
        );
        return {
          key: `${m.id}_${time}`,
          medication: m,
          time,
          status: log?.status ?? ('pending' as const),
          recordedBy: log?.recordedByName,
        };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const totalScheduled = analytics?.today.totalScheduled ?? todayDoses.length;
  const takenToday =
    analytics?.today.taken ?? todayDoses.filter((d) => d.status === 'taken').length;
  const pendingToday =
    analytics?.today.pending ?? todayDoses.filter((d) => d.status === 'pending').length;
  const missedToday =
    analytics?.today.missed ?? todayDoses.filter((d) => d.status === 'missed').length;
  const adherencePct = analytics?.today.adherencePct ?? 0;

  async function handleQuickLog(medId: string, time: string, status: DoseStatus) {
    const key = `${medId}_${time}`;
    setBusyDoseKey(key);
    try {
      await onLogDose(medId, time, status);
    } finally {
      setBusyDoseKey(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Welcome & Daily Care Summary */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <p className="text-sm font-medium text-slate-500 tabular-nums">
            {now.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}{' '}
            ·{' '}
            {now.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
          <h1 className="mt-1 font-display text-2xl sm:text-3xl font-bold text-slate-900">
            Welcome back, {user.name}
          </h1>
          <p className="mt-1.5 text-slate-600">
            Daily Care Summary for{' '}
            <span className="font-semibold text-slate-900">{profile.fullName}</span> (Age{' '}
            <span className="tabular-nums">{profile.age}</span> · Blood Group{' '}
            {profile.bloodGroup}):{' '}
            <span className="font-medium text-slate-800">
              {takenToday} of {totalScheduled} doses taken today
            </span>
            {upcomingAppointments[0]
              ? `, next doctor visit on ${upcomingAppointments[0].date} at ${upcomingAppointments[0].time}.`
              : ', no upcoming appointments pending.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {primaryEmergency && (
            <a
              href={`tel:${primaryEmergency.phone.replace(/[^\d+]/g, '')}`}
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800 hover:bg-rose-100 transition-colors whitespace-nowrap"
            >
              <PhoneCall className="w-4 h-4" />
              Quick Call: {primaryEmergency.name}
            </a>
          )}
          <button
            type="button"
            onClick={() => onNavigate('ai')}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-5 py-3 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap cursor-pointer"
          >
            Ask WellAge AI
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Smart Care Alerts Banner (if repeated missed doses exist) */}
      {analytics && analytics.smartCareAlerts.length > 0 && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-200 bg-rose-50 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-rose-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="font-display text-base font-bold text-rose-900">
                Smart Care Alert: Repeated Missed Medication Pattern
              </h2>
              <p className="text-sm text-rose-800 mt-0.5">
                {analytics.smartCareAlerts.map((a) => a.message).join(' ')} Never recommend
                taking an extra dose without physician guidance.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('medications')}
            className="rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Review Schedule
          </button>
        </div>
      )}

      {/* 6 KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Scheduled Today</p>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {totalScheduled}
          </p>
          <p className="mt-1 text-xs text-slate-500">Active doses</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-emerald-700">Taken Today</p>
          <p className="mt-2 font-display text-3xl font-bold text-emerald-700 tabular-nums">
            {takenToday}
          </p>
          <p className="mt-1 text-xs text-slate-500">Confirmed</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-sky-700">Pending</p>
          <p className="mt-2 font-display text-3xl font-bold text-sky-700 tabular-nums">
            {pendingToday}
          </p>
          <p className="mt-1 text-xs text-slate-500">Remaining today</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-rose-700">Missed</p>
          <p className="mt-2 font-display text-3xl font-bold text-rose-700 tabular-nums">
            {missedToday}
          </p>
          <p className="mt-1 text-xs text-slate-500">Needs attention</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Upcoming Visits</p>
          <p className="mt-2 font-display text-3xl font-bold text-slate-900 tabular-nums">
            {upcomingAppointments.length}
          </p>
          <p className="mt-1 text-xs text-slate-500">Doctor appointments</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-teal-700">30-Day Adherence</p>
          <p className="mt-2 font-display text-3xl font-bold text-teal-700 tabular-nums">
            {analytics?.thirtyDay.adherencePct ?? adherencePct}%
          </p>
          <p className="mt-1 text-xs text-slate-500">Overall routine</p>
        </div>
      </div>

      {/* Main Split: Today's Medication Timeline + 7-Day Adherence Chart */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Today&apos;s Medication Schedule
              </h2>
              <p className="text-sm text-slate-500 tabular-nums">{todayDate}</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('medications')}
              className="text-sm font-semibold text-sky-700 hover:underline whitespace-nowrap cursor-pointer"
            >
              Full Timeline
            </button>
          </div>

          {todayDoses.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center">
              <Pill className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-700">No active medications scheduled</p>
              <p className="text-sm text-slate-500 mt-1">
                Caretakers can add medication schedules from the Medications section.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {todayDoses.map((dose) => {
                const isBusy = busyDoseKey === dose.key;
                return (
                  <div
                    key={dose.key}
                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex items-start gap-4">
                      <div className="font-mono text-sm font-semibold text-slate-900 bg-slate-100 rounded-lg px-2.5 py-1.5 tabular-nums shrink-0">
                        {dose.time}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 text-base">
                          {dose.medication.name}{' '}
                          <span className="font-normal text-slate-600">
                            · {dose.medication.dosage}
                          </span>
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {FOOD_LABELS[dose.medication.foodInstruction]} ·{' '}
                          {dose.medication.instructions || 'Take as prescribed'}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {dose.status === 'taken' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
                          <CheckCircle2 className="w-4 h-4" />
                          Taken
                        </span>
                      )}
                      {dose.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">
                          <MinusCircle className="w-4 h-4" />
                          Skipped
                        </span>
                      )}
                      {dose.status === 'missed' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800">
                          <AlertTriangle className="w-4 h-4" />
                          Missed
                        </span>
                      )}
                      {dose.status === 'pending' && (
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-800">
                          <Clock className="w-4 h-4" />
                          Pending
                        </span>
                      )}

                      {canLogDoses && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleQuickLog(dose.medication.id, dose.time, 'taken')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                              dose.status === 'taken'
                                ? 'bg-emerald-700 text-white'
                                : 'border border-slate-300 bg-white text-slate-700 hover:bg-emerald-50 hover:text-emerald-800'
                            }`}
                          >
                            Mark Taken
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() =>
                              handleQuickLog(dose.medication.id, dose.time, 'skipped')
                            }
                            className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-amber-50 transition-colors cursor-pointer"
                          >
                            Skip
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 7-Day Adherence Chart + Next Appointment */}
        <div className="xl:col-span-5 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-teal-700" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  7-Day Adherence Trend
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('analytics')}
                className="text-sm font-semibold text-sky-700 hover:underline cursor-pointer"
              >
                Full Report
              </button>
            </div>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics?.weeklySeries ?? []}>
                  <defs>
                    <linearGradient id="adherenceFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0D9488" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#0D9488" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#64748B' }} unit="%" />
                  <Tooltip
                    formatter={(value) => [`${String(value ?? 0)}%`, 'Adherence']}
                    contentStyle={{
                      borderRadius: '10px',
                      border: '1px solid #E2E8F0',
                      fontSize: '13px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="adherencePct"
                    stroke="#0D9488"
                    strokeWidth={2.5}
                    fill="url(#adherenceFill)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-sky-700" />
                <h2 className="font-display text-lg font-bold text-slate-900">
                  Upcoming Doctor Visits
                </h2>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('appointments')}
                className="text-sm font-semibold text-sky-700 hover:underline cursor-pointer"
              >
                View All
              </button>
            </div>

            {upcomingAppointments.length === 0 ? (
              <p className="text-sm text-slate-500">No upcoming appointments scheduled.</p>
            ) : (
              <div className="space-y-3">
                {upcomingAppointments.slice(0, 2).map((appt) => (
                  <div
                    key={appt.id}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-500 tabular-nums">
                      <span className="font-semibold text-sky-800">
                        {appt.date} · {appt.time}
                      </span>
                      <span>{appt.specialty}</span>
                    </div>
                    <p className="mt-1 font-semibold text-slate-900">{appt.doctorName}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {appt.clinicName} · {appt.purpose}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Notifications Panel & Recent Care Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-sky-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Recent Notifications
              </h2>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('notifications')}
              className="text-sm font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              Notification Centre
            </button>
          </div>
          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500">No notifications yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {notifications.slice(0, 4).map((n) => (
                <div key={n.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        n.severity === 'critical'
                          ? 'text-rose-800'
                          : n.severity === 'warning'
                            ? 'text-amber-800'
                            : 'text-slate-900'
                      }`}
                    >
                      {n.title}
                    </p>
                    <span className="text-xs text-slate-400 shrink-0 tabular-nums">
                      {new Date(n.createdAt).toLocaleTimeString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1">{n.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Recent Care Circle Activity
            </h2>
            <button
              type="button"
              onClick={() => onNavigate('care-circle')}
              className="text-sm font-semibold text-sky-700 hover:underline cursor-pointer"
            >
              Care Circle
            </button>
          </div>
          {activities.length === 0 ? (
            <p className="text-sm text-slate-500">No recent caregiver activity logged.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {activities.slice(0, 4).map((act) => (
                <div key={act.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{act.action}</p>
                    <span className="text-xs text-slate-500 capitalize shrink-0">
                      {act.actorRole}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {act.actorName} · {act.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
