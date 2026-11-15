import React, { useMemo, useState } from 'react';
import {
  BellRing,
  Calendar as CalendarIcon,
  CheckCircle2,
  Edit3,
  Mail,
  MapPin,
  Phone,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { Appointment, UserProfile } from '../types';

interface AppointmentsViewProps {
  user: UserProfile;
  profileId: string;
  appointments: Appointment[];
  onRefresh: () => Promise<void>;
}

export function AppointmentsView({
  user,
  profileId,
  appointments,
  onRefresh,
}: AppointmentsViewProps) {
  const isCaretaker = user.role === 'caretaker';
  const canRemind = user.role === 'elderly' || user.role === 'caretaker';

  const [tab, setTab] = useState<'upcoming' | 'calendar' | 'history'>('upcoming');
  const [showModal, setShowModal] = useState(false);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [doctorName, setDoctorName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('10:00');
  const [purpose, setPurpose] = useState('');
  const [doctorPhone, setDoctorPhone] = useState('');
  const [doctorEmail, setDoctorEmail] = useState('');
  const [notes, setNotes] = useState('');

  const upcoming = appointments.filter((a) => a.status === 'upcoming');
  const history = appointments.filter((a) => a.status !== 'upcoming');

  // Simple monthly calendar grid for current month
  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number | null; dateStr: string | null }> = [];
    for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: null });
    for (let d = 1; d <= daysInMonth; d++) {
      const mStr = String(month + 1).padStart(2, '0');
      const dStr = String(d).padStart(2, '0');
      cells.push({ day: d, dateStr: `${year}-${mStr}-${dStr}` });
    }
    return {
      monthLabel: now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      cells,
    };
  }, []);

  function openAddModal() {
    setEditingAppt(null);
    setDoctorName('');
    setSpecialty('');
    setClinicName('');
    setDate(new Date().toISOString().slice(0, 10));
    setTime('10:00');
    setPurpose('');
    setDoctorPhone('');
    setDoctorEmail('');
    setNotes('');
    setError(null);
    setShowModal(true);
  }

  function openEditModal(appt: Appointment) {
    setEditingAppt(appt);
    setDoctorName(appt.doctorName);
    setSpecialty(appt.specialty);
    setClinicName(appt.clinicName);
    setDate(appt.date);
    setTime(appt.time);
    setPurpose(appt.purpose);
    setDoctorPhone(appt.doctorPhone);
    setDoctorEmail(appt.doctorEmail);
    setNotes(appt.notes);
    setError(null);
    setShowModal(true);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (editingAppt) {
        await api.updateAppointment(profileId, editingAppt.id, {
          doctorName,
          specialty,
          clinicName,
          date,
          time,
          purpose,
          doctorPhone,
          doctorEmail,
          notes,
        });
      } else {
        await api.addAppointment(profileId, {
          doctorName,
          specialty,
          clinicName,
          date,
          time,
          purpose,
          doctorPhone,
          doctorEmail,
          notes,
        });
      }
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save appointment.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(apptId: string) {
    await api.deleteAppointment(profileId, apptId);
    await onRefresh();
  }

  async function handleMarkCompleted(appt: Appointment) {
    await api.updateAppointment(profileId, appt.id, { status: 'completed' });
    await onRefresh();
  }

  async function handleSendReminder(apptId: string) {
    const res = await api.remindAppointment(profileId, apptId);
    setFeedback(
      `Care circle reminder sent to ${res.notifiedCount} member(s)${
        res.smtpConfigured ? ' via SMTP email & in-app alert.' : ' (in-app alert; configure SMTP_* for external email).'
      }`,
    );
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Doctor Appointments
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Track upcoming specialist visits, clinic contact details, and automated reminders.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
            {(
              [
                { id: 'upcoming', label: 'Upcoming' },
                { id: 'calendar', label: 'Calendar' },
                { id: 'history', label: 'History' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  tab === t.id
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {isCaretaker && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Appointment
            </button>
          )}
        </div>
      </div>

      {feedback && (
        <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-900 flex items-center justify-between gap-4">
          <span>{feedback}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-teal-700 hover:text-teal-900 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {tab === 'upcoming' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {upcoming.length === 0 ? (
            <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-white p-10 text-center">
              <CalendarIcon className="w-9 h-9 text-slate-400 mx-auto mb-2" />
              <p className="font-semibold text-slate-800">No upcoming appointments scheduled</p>
              <p className="text-sm text-slate-500 mt-1">
                Caretakers can schedule doctor visits using the Add Appointment button.
              </p>
            </div>
          ) : (
            upcoming.map((appt) => (
              <div
                key={appt.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4"
              >
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-sm font-semibold text-sky-800 tabular-nums">
                        {appt.date} · {appt.time}
                      </p>
                      <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                        {appt.doctorName}
                      </h3>
                      <p className="text-sm text-slate-600">{appt.specialty}</p>
                    </div>
                    {isCaretaker && (
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditModal(appt)}
                          aria-label={`Edit ${appt.doctorName}`}
                          className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(appt.id)}
                          aria-label={`Delete ${appt.doctorName}`}
                          className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 space-y-2 text-sm text-slate-700">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
                      <span>{appt.clinicName}</span>
                    </div>
                    {appt.doctorPhone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-slate-400 shrink-0" />
                        <a
                          href={`tel:${appt.doctorPhone.replace(/[^\d+]/g, '')}`}
                          className="text-sky-700 hover:underline tabular-nums"
                        >
                          {appt.doctorPhone}
                        </a>
                      </div>
                    )}
                    {appt.doctorEmail && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>{appt.doctorEmail}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-3.5 text-sm">
                    <p className="font-semibold text-slate-900">Purpose: {appt.purpose}</p>
                    {appt.notes && <p className="text-slate-600 mt-1 text-xs">{appt.notes}</p>}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200">
                  {canRemind && (
                    <button
                      type="button"
                      onClick={() => handleSendReminder(appt.id)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                    >
                      <BellRing className="w-4 h-4 text-sky-700" />
                      Send Reminder
                    </button>
                  )}
                  {isCaretaker && (
                    <button
                      type="button"
                      onClick={() => handleMarkCompleted(appt)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      Mark Completed
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === 'calendar' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            {calendarDays.monthLabel}
          </h2>
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-semibold text-slate-500 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {calendarDays.cells.map((cell, idx) => {
              if (!cell.day || !cell.dateStr) {
                return <div key={`empty_${idx}`} className="h-24 rounded-xl bg-slate-50/60" />;
              }
              const dayAppts = appointments.filter((a) => a.date === cell.dateStr);
              return (
                <div
                  key={cell.dateStr}
                  className="h-24 rounded-xl border border-slate-200 bg-white p-2 overflow-y-auto"
                >
                  <p className="text-xs font-semibold text-slate-700 tabular-nums">{cell.day}</p>
                  <div className="mt-1 space-y-1">
                    {dayAppts.map((a) => (
                      <div
                        key={a.id}
                        className="rounded bg-sky-50 border border-sky-200 px-1.5 py-0.5 text-[11px] font-medium text-sky-900 truncate"
                        title={`${a.time} ${a.doctorName} (${a.purpose})`}
                      >
                        {a.time} {a.doctorName}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
            Appointment History
          </h2>
          {history.length === 0 ? (
            <p className="text-sm text-slate-500">No past appointments recorded yet.</p>
          ) : (
            <div className="divide-y divide-slate-200">
              {history.map((appt) => (
                <div
                  key={appt.id}
                  className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {appt.doctorName} · <span className="font-normal">{appt.specialty}</span>
                    </p>
                    <p className="text-sm text-slate-600">
                      {appt.clinicName} · {appt.purpose}
                    </p>
                    {appt.notes && <p className="text-xs text-slate-500 mt-1">{appt.notes}</p>}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-xs text-slate-700 tabular-nums">
                      {appt.date} · {appt.time}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700 capitalize mt-0.5">
                      {appt.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Caretaker Add / Edit Appointment Modal */}
      {showModal && isCaretaker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editingAppt ? 'Edit Appointment' : 'Schedule Doctor Appointment'}
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
                {error}
              </div>
            )}

            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Doctor Name
                  </label>
                  <input
                    type="text"
                    required
                    value={doctorName}
                    onChange={(e) => setDoctorName(e.target.value)}
                    placeholder="Dr. Marcus Holloway, MD"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Specialty
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    placeholder="Cardiology"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Hospital or Clinic Name
                </label>
                <input
                  type="text"
                  required
                  value={clinicName}
                  onChange={(e) => setClinicName(e.target.value)}
                  placeholder="Oakridge Senior Medical Pavilion"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Time
                  </label>
                  <input
                    type="time"
                    required
                    value={time}
                    onChange={(e) => setTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Appointment Purpose
                </label>
                <input
                  type="text"
                  required
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="Quarterly blood pressure & lab review"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Doctor Phone
                  </label>
                  <input
                    type="tel"
                    value={doctorPhone}
                    onChange={(e) => setDoctorPhone(e.target.value)}
                    placeholder="+1 (555) 619-3300"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Clinic Email
                  </label>
                  <input
                    type="email"
                    value={doctorEmail}
                    onChange={(e) => setDoctorEmail(e.target.value)}
                    placeholder="scheduling@clinic.org"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Preparation Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Bring blood pressure log..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : editingAppt ? 'Save Changes' : 'Schedule Visit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
