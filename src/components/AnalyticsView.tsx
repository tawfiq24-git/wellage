import { useMemo, useState } from 'react';
import { Check, Download, FileSpreadsheet, FileText, ShieldAlert } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type {
  AnalyticsSummary,
  CareActivity,
  ElderlyProfile,
  Medication,
  MedicationLog,
  UserProfile,
} from '../types';
import {
  exportMonthlyAdherencePdf,
  getAvailableReportPeriods,
} from '../utils/pdfReport';

interface AnalyticsViewProps {
  profile: ElderlyProfile;
  analytics: AnalyticsSummary | null;
  logs: MedicationLog[];
  activities: CareActivity[];
  medications?: Medication[];
  user?: UserProfile | null;
}

export function AnalyticsView({
  profile,
  analytics,
  logs,
  activities,
  medications = [],
  user = null,
}: AnalyticsViewProps) {
  const periodOptions = useMemo(() => getAvailableReportPeriods(logs), [logs]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>(
    () => periodOptions[0]?.value || 'last_30_days',
  );
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfNotice, setPdfNotice] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const pieData = analytics
    ? [
        { name: 'Taken', value: analytics.thirtyDay.taken, color: '#059669' },
        { name: 'Missed', value: analytics.thirtyDay.missed, color: '#DC2626' },
        { name: 'Skipped', value: analytics.thirtyDay.skipped, color: '#D97706' },
      ].filter((d) => d.value > 0)
    : [];

  function handleExportCsv() {
    const headers = [
      'Date',
      'Scheduled Time',
      'Medication',
      'Dosage',
      'Status',
      'Recorded By',
      'Notes',
    ];
    const rows = logs.map((l) =>
      [
        l.scheduledDate,
        l.scheduledTime,
        `"${l.medicationName.replace(/"/g, '""')}"`,
        `"${l.dosage.replace(/"/g, '""')}"`,
        l.status,
        `"${l.recordedByName.replace(/"/g, '""')}"`,
        `"${(l.notes || '').replace(/"/g, '""')}"`,
      ].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.fullName.toLowerCase().replace(/\s+/g, '_')}_adherence_report.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleExportMonthlyPdf() {
    setPdfError(null);
    setExportingPdf(true);
    try {
      const { fileName } = exportMonthlyAdherencePdf({
        profile,
        logs,
        medications,
        analytics,
        preparedBy: user,
        periodValue: selectedPeriod,
      });
      setPdfNotice(`Saved ${fileName}`);
      window.setTimeout(() => {
        setPdfNotice((prev) => (prev === `Saved ${fileName}` ? null : prev));
      }, 4500);
    } catch (err) {
      setPdfError(
        err instanceof Error ? err.message : 'Unable to generate PDF report right now.',
      );
    } finally {
      setExportingPdf(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Medication Adherence Analytics
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Daily, weekly, and monthly adherence reports for {profile.fullName} — export a
            physician-ready PDF or CSV summary.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="pdf-report-period">
            Report period
          </label>
          <select
            id="pdf-report-period"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-medium text-slate-800 focus:border-sky-700 focus:outline-none"
          >
            {periodOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleExportMonthlyPdf}
            disabled={exportingPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 disabled:opacity-60 transition-colors whitespace-nowrap cursor-pointer"
          >
            {pdfNotice ? (
              <Check className="w-4 h-4" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {exportingPdf ? 'Generating PDF...' : pdfNotice ? 'PDF Exported' : 'Export Monthly PDF'}
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Download className="w-4 h-4" />
            Download CSV
          </button>
        </div>
      </div>

      {pdfNotice && (
        <div
          role="status"
          className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-900 flex items-center justify-between gap-3"
        >
          <span>
            <strong>Physician PDF ready:</strong> {pdfNotice} (includes patient summary,
            medication breakdown, missed-dose notes, and full dose log).
          </span>
        </div>
      )}

      {pdfError && (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-900"
        >
          {pdfError}
        </div>
      )}

      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">Daily Adherence</p>
          <p className="mt-1 font-display text-3xl font-bold text-sky-700 tabular-nums">
            {analytics?.today.adherencePct ?? 0}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {analytics?.today.taken ?? 0} of {analytics?.today.totalScheduled ?? 0} today
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">30-Day Adherence Rate</p>
          <p className="mt-1 font-display text-3xl font-bold text-teal-700 tabular-nums">
            {analytics?.thirtyDay.adherencePct ?? 0}%
          </p>
          <p className="mt-1 text-xs text-slate-500 tabular-nums">
            {analytics?.thirtyDay.taken ?? 0} doses confirmed taken
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">30-Day Missed Doses</p>
          <p className="mt-1 font-display text-3xl font-bold text-rose-700 tabular-nums">
            {analytics?.thirtyDay.missed ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Flagged for caregiver review</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-medium text-slate-500">30-Day Skipped Doses</p>
          <p className="mt-1 font-display text-3xl font-bold text-amber-700 tabular-nums">
            {analytics?.thirtyDay.skipped ?? 0}
          </p>
          <p className="mt-1 text-xs text-slate-500">Recorded with reason</p>
        </div>
      </div>

      {/* Smart Care Alerts */}
      {analytics && analytics.smartCareAlerts.length > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-900">
            <p className="font-bold">Repeated Missed Medication Attention Required</p>
            <ul className="mt-1 list-disc list-inside space-y-0.5">
              {analytics.smartCareAlerts.map((a) => (
                <li key={a.medicationId}>{a.message}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-1">
            Weekly Medication Tracking (Taken vs Missed vs Skipped)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Daily dose outcomes over the past 7 days
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics?.weeklySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip
                  contentStyle={{
                    borderRadius: '10px',
                    border: '1px solid #E2E8F0',
                    fontSize: '13px',
                  }}
                />
                <Legend />
                <Bar dataKey="taken" name="Taken" stackId="a" fill="#059669" radius={[0, 0, 0, 0]} />
                <Bar dataKey="skipped" name="Skipped" stackId="a" fill="#D97706" />
                <Bar dataKey="missed" name="Missed" stackId="a" fill="#DC2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-1">
            30-Day Outcome Breakdown
          </h2>
          <p className="text-xs text-slate-500 mb-4">Distribution of logged doses</p>
          <div className="h-72 w-full">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                No logged doses in the last 30 days.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="48%"
                    innerRadius={56}
                    outerRadius={88}
                    paddingAngle={3}
                  >
                    {pieData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Adherence Trend Line + Caregiver Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="font-display text-lg font-bold text-slate-900 mb-1">
            Daily Adherence Percentage
          </h2>
          <p className="text-xs text-slate-500 mb-4">7-day percentage trajectory</p>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={analytics?.weeklySeries ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#64748B' }} />
                <YAxis domain={[0, 100]} unit="%" tick={{ fontSize: 12, fill: '#64748B' }} />
                <Tooltip formatter={(value) => [`${String(value ?? 0)}%`, 'Adherence']} />
                <Line
                  type="monotone"
                  dataKey="adherencePct"
                  stroke="#0284C7"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#0284C7' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div className="flex items-center gap-2 mb-4">
            <FileSpreadsheet className="w-5 h-5 text-sky-700" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Caregiver &amp; Routine Activity Log
            </h2>
          </div>
          <div className="max-h-60 overflow-y-auto divide-y divide-slate-200 pr-1">
            {activities.map((a) => (
              <div key={a.id} className="py-2.5 first:pt-0 last:pb-0 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900">{a.action}</span>
                  <span className="text-xs text-slate-400 tabular-nums shrink-0">
                    {new Date(a.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  {a.actorName} ({a.actorRole}) · {a.details}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
