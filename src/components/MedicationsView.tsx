import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Edit3,
  MinusCircle,
  Plus,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import type {
  DoseStatus,
  FoodInstruction,
  Medication,
  MedicationFrequency,
  MedicationLog,
  UserProfile,
} from '../types';

interface MedicationsViewProps {
  user: UserProfile;
  profileId: string;
  todayDate: string;
  medications: Medication[];
  todayLogs: MedicationLog[];
  logs: MedicationLog[];
  onRefresh: () => Promise<void>;
  onLogDose: (
    medicationId: string,
    scheduledTime: string,
    status: DoseStatus,
    notes?: string,
  ) => Promise<void>;
}

const FOOD_LABELS: Record<FoodInstruction, string> = {
  before_food: 'Before food',
  after_food: 'After food',
  with_food: 'With food',
  anytime: 'Anytime',
};

const FREQ_LABELS: Record<MedicationFrequency, string> = {
  daily: 'Once daily',
  twice_daily: 'Twice daily',
  three_times_daily: 'Three times daily',
  weekly: 'Weekly',
  as_needed: 'As needed',
};

function getPeriodBucket(timeHHmm: string): 'Morning' | 'Afternoon' | 'Evening' | 'Bedtime' {
  const hour = Number(timeHHmm.split(':')[0] || 8);
  if (hour < 12) return 'Morning';
  if (hour < 17) return 'Afternoon';
  if (hour < 21) return 'Evening';
  return 'Bedtime';
}

export function MedicationsView({
  user,
  profileId,
  todayDate,
  medications,
  todayLogs,
  logs,
  onRefresh,
  onLogDose,
}: MedicationsViewProps) {
  const isCaretaker = user.role === 'caretaker';
  const canLog = user.role === 'elderly' || user.role === 'caretaker';

  const [subView, setSubView] = useState<'timeline' | 'schedules' | 'history'>('timeline');
  const [historyFilter, setHistoryFilter] = useState<'all' | DoseStatus>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingMed, setEditingMed] = useState<Medication | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [instructions, setInstructions] = useState('');
  const [foodInstruction, setFoodInstruction] = useState<FoodInstruction>('after_food');
  const [frequency, setFrequency] = useState<MedicationFrequency>('daily');
  const [timingsText, setTimingsText] = useState('08:00');
  const [startDate, setStartDate] = useState(todayDate);
  const [endDate, setEndDate] = useState('');
  const [prescribedBy, setPrescribedBy] = useState('');

  function openAddModal() {
    setEditingMed(null);
    setName('');
    setDosage('');
    setInstructions('');
    setFoodInstruction('after_food');
    setFrequency('daily');
    setTimingsText('08:00');
    setStartDate(todayDate);
    setEndDate('');
    setPrescribedBy('');
    setError(null);
    setShowModal(true);
  }

  function openEditModal(med: Medication) {
    setEditingMed(med);
    setName(med.name);
    setDosage(med.dosage);
    setInstructions(med.instructions);
    setFoodInstruction(med.foodInstruction);
    setFrequency(med.frequency);
    setTimingsText(med.timings.join(', '));
    setStartDate(med.startDate);
    setEndDate(med.endDate);
    setPrescribedBy(med.prescribedBy);
    setError(null);
    setShowModal(true);
  }

  async function handleSaveMedication(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsedTimings = timingsText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => /^\d{2}:\d{2}$/.test(s));

    if (parsedTimings.length === 0) {
      setError('Enter one or more 24-hour timings separated by commas (e.g. 08:00, 20:00).');
      return;
    }

    setSaving(true);
    try {
      if (editingMed) {
        await api.updateMedication(profileId, editingMed.id, {
          name,
          dosage,
          instructions,
          foodInstruction,
          frequency,
          timings: parsedTimings,
          startDate,
          endDate,
          prescribedBy,
        });
      } else {
        await api.addMedication(profileId, {
          name,
          dosage,
          instructions,
          foodInstruction,
          frequency,
          timings: parsedTimings,
          startDate,
          endDate,
          prescribedBy,
        });
      }
      setShowModal(false);
      await onRefresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save medication.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteMedication(medId: string) {
    setSaving(true);
    try {
      await api.deleteMedication(profileId, medId);
      await onRefresh();
    } finally {
      setSaving(false);
    }
  }

  const timelineItems = medications
    .filter((m) => m.isActive)
    .flatMap((m) =>
      m.timings.map((time) => {
        const log = todayLogs.find(
          (l) => l.medicationId === m.id && l.scheduledTime === time,
        );
        return {
          med: m,
          time,
          bucket: getPeriodBucket(time),
          status: log?.status ?? ('pending' as const),
          log,
        };
      }),
    )
    .sort((a, b) => a.time.localeCompare(b.time));

  const buckets: Array<'Morning' | 'Afternoon' | 'Evening' | 'Bedtime'> = [
    'Morning',
    'Afternoon',
    'Evening',
    'Bedtime',
  ];

  const filteredLogs =
    historyFilter === 'all' ? logs : logs.filter((l) => l.status === historyFilter);

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Medication Management
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Daily schedule timeline, food guidance, and adherence history.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl bg-slate-200/70 p-1">
            {(
              [
                { id: 'timeline', label: 'Daily Timeline' },
                { id: 'schedules', label: 'All Prescriptions' },
                { id: 'history', label: 'Dose History' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubView(t.id)}
                className={`px-3.5 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
                  subView === t.id
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
              Add Medication
            </button>
          )}
        </div>
      </div>

      {/* Mandatory Non-Diagnostic Safety Banner */}
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3 text-sm text-amber-900">
        <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
        <p>
          <strong>Safety Guidance:</strong> If a dose is missed, never automatically take an extra
          or double dose. Always check the pharmacy label or call the prescribing doctor before
          adjusting timing.
        </p>
      </div>

      {/* Daily Timeline View */}
      {subView === 'timeline' && (
        <div className="space-y-6">
          {buckets.map((bucket) => {
            const items = timelineItems.filter((i) => i.bucket === bucket);
            if (items.length === 0) return null;
            return (
              <section
                key={bucket}
                className="rounded-2xl border border-slate-200 bg-white p-6"
              >
                <h2 className="font-display text-lg font-bold text-slate-900 mb-4">
                  {bucket} Routine
                </h2>
                <div className="divide-y divide-slate-200">
                  {items.map((item) => (
                    <div
                      key={`${item.med.id}_${item.time}`}
                      className="py-4 first:pt-0 last:pb-0 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                    >
                      <div className="flex items-start gap-4">
                        <div className="rounded-xl bg-sky-50 border border-sky-200 px-3 py-2 font-mono text-base font-semibold text-sky-900 tabular-nums shrink-0">
                          {item.time}
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="font-display text-lg font-bold text-slate-900">
                              {item.med.name}
                            </h3>
                            <span className="text-sm font-semibold text-slate-600">
                              · {item.med.dosage}
                            </span>
                            <span className="text-xs text-teal-800 font-medium">
                              · {FOOD_LABELS[item.med.foodInstruction]}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mt-1">
                            {item.med.instructions || 'Take with a glass of water.'}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Prescribed by {item.med.prescribedBy} ·{' '}
                            {FREQ_LABELS[item.med.frequency]}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        {item.status === 'taken' && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
                            <CheckCircle2 className="w-4 h-4" />
                            Taken
                          </span>
                        )}
                        {item.status === 'skipped' && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800">
                            <MinusCircle className="w-4 h-4" />
                            Skipped
                          </span>
                        )}
                        {item.status === 'missed' && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
                            <AlertTriangle className="w-4 h-4" />
                            Missed
                          </span>
                        )}
                        {item.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800">
                            <Clock className="w-4 h-4" />
                            Pending
                          </span>
                        )}

                        {canLog && (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => onLogDose(item.med.id, item.time, 'taken')}
                              className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 transition-colors cursor-pointer"
                            >
                              Taken
                            </button>
                            <button
                              type="button"
                              onClick={() => onLogDose(item.med.id, item.time, 'skipped')}
                              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-700 hover:bg-amber-50 transition-colors cursor-pointer"
                            >
                              Skipped
                            </button>
                            <button
                              type="button"
                              onClick={() => onLogDose(item.med.id, item.time, 'missed')}
                              className="rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-medium text-rose-700 hover:bg-rose-50 transition-colors cursor-pointer"
                            >
                              Missed
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* All Prescriptions Table/Grid */}
      {subView === 'schedules' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {medications.map((med) => (
            <div
              key={med.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between gap-4"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl font-bold text-slate-900">
                      {med.name}
                    </h3>
                    <p className="text-sm font-medium text-sky-800 mt-0.5">
                      {med.dosage} · {FREQ_LABELS[med.frequency]}
                    </p>
                  </div>
                  {isCaretaker && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(med)}
                        aria-label={`Edit ${med.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteMedication(med.id)}
                        aria-label={`Delete ${med.name}`}
                        className="rounded-lg border border-slate-200 p-2 text-rose-600 hover:bg-rose-50 cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>

                <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                  {med.instructions || 'No additional instructions recorded.'}
                </p>

                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-2 gap-3 text-xs text-slate-600">
                  <div>
                    <span className="text-slate-400 block">Daily Timings</span>
                    <span className="font-mono font-semibold text-slate-900 tabular-nums">
                      {med.timings.join(', ')}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Meal Guidance</span>
                    <span className="font-semibold text-slate-900">
                      {FOOD_LABELS[med.foodInstruction]}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Date Range</span>
                    <span className="tabular-nums">
                      {med.startDate} to {med.endDate || 'Ongoing'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block">Prescriber</span>
                    <span>{med.prescribedBy}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* History Log Table */}
      {subView === 'history' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="font-display text-lg font-bold text-slate-900">
              Medication Adherence History
            </h2>
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {(['all', 'taken', 'skipped', 'missed'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setHistoryFilter(status)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md capitalize cursor-pointer ${
                    historyFilter === status
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500">
                  <th className="py-3 pr-4">Date &amp; Time</th>
                  <th className="py-3 pr-4">Medication</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 pr-4">Recorded By</th>
                  <th className="py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredLogs.slice(0, 60).map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50">
                    <td className="py-3 pr-4 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                      {log.scheduledDate} · {log.scheduledTime}
                    </td>
                    <td className="py-3 pr-4 font-medium text-slate-900">
                      {log.medicationName}{' '}
                      <span className="text-slate-500 font-normal">({log.dosage})</span>
                    </td>
                    <td className="py-3 pr-4">
                      {log.status === 'taken' && (
                        <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                          <CheckCircle2 className="w-4 h-4" /> Taken
                        </span>
                      )}
                      {log.status === 'skipped' && (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-semibold">
                          <MinusCircle className="w-4 h-4" /> Skipped
                        </span>
                      )}
                      {log.status === 'missed' && (
                        <span className="inline-flex items-center gap-1 text-rose-700 font-semibold">
                          <AlertTriangle className="w-4 h-4" /> Missed
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4 text-slate-600">{log.recordedByName}</td>
                    <td className="py-3 text-slate-500">{log.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Caretaker Add / Edit Medication Modal */}
      {showModal && isCaretaker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-xl font-bold text-slate-900">
                {editingMed ? `Edit ${editingMed.name}` : 'Add New Medication'}
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

            <form onSubmit={handleSaveMedication} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Medicine Name
                  </label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Lisinopril"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Dosage
                  </label>
                  <input
                    type="text"
                    required
                    value={dosage}
                    onChange={(e) => setDosage(e.target.value)}
                    placeholder="e.g. 10 mg Tablet"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Meal Instruction
                  </label>
                  <select
                    value={foodInstruction}
                    onChange={(e) => setFoodInstruction(e.target.value as FoodInstruction)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  >
                    <option value="before_food">Before food</option>
                    <option value="after_food">After food</option>
                    <option value="with_food">With food</option>
                    <option value="anytime">Anytime</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Frequency
                  </label>
                  <select
                    value={frequency}
                    onChange={(e) => setFrequency(e.target.value as MedicationFrequency)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  >
                    <option value="daily">Once daily</option>
                    <option value="twice_daily">Twice daily</option>
                    <option value="three_times_daily">Three times daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="as_needed">As needed</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Daily Timings (24h comma-separated, e.g. 08:00, 20:00)
                </label>
                <input
                  type="text"
                  required
                  value={timingsText}
                  onChange={(e) => setTimingsText(e.target.value)}
                  placeholder="08:00, 20:00"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-mono focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date
                  </label>
                  <input
                    type="date"
                    required
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    End Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Prescribing Doctor
                </label>
                <input
                  type="text"
                  value={prescribedBy}
                  onChange={(e) => setPrescribedBy(e.target.value)}
                  placeholder="Dr. Marcus Holloway, MD"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Instructions
                </label>
                <textarea
                  rows={3}
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  placeholder="Swallow whole with water..."
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
                  {saving ? 'Saving...' : editingMed ? 'Save Changes' : 'Create Schedule'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
