import { useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  CheckCheck,
  Mail,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import type { NotificationItem } from '../types';

interface NotificationsViewProps {
  notifications: NotificationItem[];
  smtpConfigured: boolean;
  onRefresh: () => Promise<void>;
}

export function NotificationsView({
  notifications,
  smtpConfigured,
  onRefresh,
}: NotificationsViewProps) {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [scanning, setScanning] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const visible =
    filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  async function handleMarkRead(id: string) {
    await api.markNotificationRead(id);
    await onRefresh();
  }

  async function handleMarkAllRead() {
    await api.markAllNotificationsRead();
    await onRefresh();
  }

  async function handleRunScan() {
    setScanning(true);
    setStatusBanner(null);
    try {
      const res = await api.runReminderScan();
      const s = res.summary;
      setStatusBanner(
        `Automated scan completed: ${s.upcomingDosesAlerted} upcoming alerts, ${s.missedDosesMarked} missed doses flagged, ${s.smartCareAlertsCreated} smart alerts, ${s.appointmentRemindersSent} appointment reminders.`,
      );
      await onRefresh();
    } finally {
      setScanning(false);
    }
  }

  async function handleSendTestEmail() {
    setTestingEmail(true);
    setStatusBanner(null);
    try {
      const res = await api.sendTestEmail();
      if (res.sent) {
        setStatusBanner(`Test email successfully sent to ${res.recipient} via SMTP.`);
      } else {
        setStatusBanner(
          `SMTP credentials are not configured in server .env (${res.error || 'simulated outbox mode'}). In-app notifications remain active.`,
        );
      }
    } finally {
      setTestingEmail(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-slate-900">
            Smart Notification Centre
          </h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Medication reminders, missed-dose alerts, appointment notices, and SMTP email status.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            disabled={scanning}
            onClick={handleRunScan}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            Run Reminder Scan
          </button>

          <button
            type="button"
            disabled={testingEmail}
            onClick={handleSendTestEmail}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <Mail className="w-4 h-4 text-sky-700" />
            Test Email Alert
          </button>

          <button
            type="button"
            onClick={handleMarkAllRead}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 cursor-pointer"
          >
            <CheckCheck className="w-4 h-4" />
            Mark All Read
          </button>
        </div>
      </div>

      {/* SMTP Configuration Status */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4 text-sky-700" />
          <span>
            Nodemailer SMTP Status:{' '}
            <strong className="text-slate-900">
              {smtpConfigured ? 'Configured & Live' : 'In-App Queue (Add SMTP_* env vars for external email)'}
            </strong>
          </span>
        </div>

        <div className="inline-flex rounded-lg bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              filter === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            All ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-3 py-1 text-xs font-medium rounded-md cursor-pointer ${
              filter === 'unread' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Unread ({notifications.filter((n) => !n.read).length})
          </button>
        </div>
      </div>

      {statusBanner && (
        <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          {statusBanner}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white divide-y divide-slate-200">
        {visible.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="font-semibold text-slate-800">No notifications in this view</p>
            <p className="text-sm text-slate-500 mt-1">
              Automated reminders appear here when doses approach, pass, or schedules change.
            </p>
          </div>
        ) : (
          visible.map((n) => (
            <div
              key={n.id}
              className={`p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                n.read ? 'bg-white' : 'bg-sky-50/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {n.severity === 'critical' ? (
                  <AlertTriangle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                ) : n.severity === 'warning' ? (
                  <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
                ) : (
                  <Bell className="w-5 h-5 text-sky-700 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{n.title}</h3>
                    {!n.read && (
                      <span className="text-xs font-semibold text-sky-700">· Unread</span>
                    )}
                    {n.emailSent && (
                      <span className="text-xs text-teal-700">· Email Dispatched</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{n.message}</p>
                  <p className="text-xs text-slate-400 mt-1 tabular-nums">
                    {new Date(n.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>

              {!n.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 shrink-0 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  Mark Read
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
