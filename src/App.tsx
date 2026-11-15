import React, { useCallback, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import {
  BarChart3,
  Bell,
  Bot,
  CalendarClock,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Pill,
  Type,
  Users,
  X,
} from 'lucide-react';
import { api, setStoredToken, type AuthResponse } from './api';
import { auth } from './lib/firebase';
import { AiAssistantView } from './components/AiAssistantView';
import { AnalyticsView } from './components/AnalyticsView';
import { AppointmentsView } from './components/AppointmentsView';
import { AuthView } from './components/AuthView';
import { CareCircleView } from './components/CareCircleView';
import { DashboardHome } from './components/DashboardHome';
import { LandingPage } from './components/LandingPage';
import { MedicationsView } from './components/MedicationsView';
import { NotificationsView } from './components/NotificationsView';
import { WellAgeAiChat } from './components/WellAgeAiChat';
import type {
  AiChatMessage,
  AnalyticsSummary,
  Appointment,
  CareActivity,
  CareCircleMember,
  DoseStatus,
  ElderlyProfile,
  EmergencyContact,
  Medication,
  MedicationLog,
  NotificationItem,
  UserProfile,
} from './types';

type AppTab =
  | 'dashboard'
  | 'medications'
  | 'appointments'
  | 'analytics'
  | 'ai'
  | 'care-circle'
  | 'notifications';

export default function App() {
  const [inviteQrToken] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return new URLSearchParams(window.location.search).get('connect');
  });

  const [booting, setBooting] = useState(true);
  const [screen, setScreen] = useState<'landing' | 'auth' | 'workspace'>(() =>
    inviteQrToken ? 'auth' : 'landing',
  );
  const [authMode, setAuthMode] = useState<'login' | 'register' | 'connect'>('login');

  const [user, setUser] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<ElderlyProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AppTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(false);

  // Active profile workspace data
  const [todayDate, setTodayDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [medications, setMedications] = useState<Medication[]>([]);
  const [todayLogs, setTodayLogs] = useState<MedicationLog[]>([]);
  const [logs, setLogs] = useState<MedicationLog[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [elderlyOwner, setElderlyOwner] = useState<UserProfile | null>(null);
  const [familyMembers, setFamilyMembers] = useState<CareCircleMember[]>([]);
  const [caretakers, setCaretakers] = useState<CareCircleMember[]>([]);
  const [activities, setActivities] = useState<CareActivity[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [smtpConfigured, setSmtpConfigured] = useState(false);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<AiChatMessage[]>([]);
  const [loadingAiHistory, setLoadingAiHistory] = useState(false);
  const [floatingChatOpen, setFloatingChatOpen] = useState(false);

  // Unlinked Family/Caretaker Passcode input
  const [linkPasscode, setLinkPasscode] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.toggle('large-text-mode', largeText);
  }, [largeText]);

  const loadWorkspaceData = useCallback(async (profileId: string) => {
    setLoadingWorkspace(true);
    setLoadingAiHistory(true);
    setWorkspaceError(null);
    try {
      const [medRes, apptRes, analyticsRes, ecRes, circleRes, notifRes, aiHistRes] =
        await Promise.all([
          api.getMedications(profileId),
          api.getAppointments(profileId),
          api.getAnalytics(profileId),
          api.getEmergencyContacts(profileId),
          api.getCareCircle(profileId),
          api.getNotifications(),
          api.getAiHistory(profileId),
        ]);

      setTodayDate(medRes.todayDate);
      setMedications(medRes.medications);
      setTodayLogs(medRes.todayLogs);
      setLogs(medRes.logs);
      setAppointments(apptRes.appointments);
      setAnalytics(analyticsRes);
      setEmergencyContacts(ecRes.contacts);
      setElderlyOwner(circleRes.elderlyOwner);
      setFamilyMembers(circleRes.family);
      setCaretakers(circleRes.caretakers);
      setActivities(circleRes.activities);
      setNotifications(notifRes.notifications);
      setUnreadCount(notifRes.unreadCount);
      setSmtpConfigured(notifRes.smtpConfigured);
      setAiMessages(aiHistRes.messages);
    } catch (err) {
      setWorkspaceError(
        err instanceof Error ? err.message : 'Failed to load care workspace data.',
      );
    } finally {
      setLoadingWorkspace(false);
      setLoadingAiHistory(false);
    }
  }, []);

  // Restore Firebase Auth session on mount (tokens kept strictly in memory)
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        setBooting(false);
        return;
      }
      try {
        const idToken = await firebaseUser.getIdToken();
        setStoredToken(idToken);
        const res = await api.firebaseLogin(idToken);
        if (!active) return;
        setUser(res.user);
        let nextProfiles = res.profiles;
        if (inviteQrToken && res.user.role !== 'elderly') {
          try {
            const linked = await api.connectProfile({ qrToken: inviteQrToken });
            nextProfiles = [
              linked.profile,
              ...nextProfiles.filter((p) => p.id !== linked.profile.id),
            ];
          } catch {
            // Ignore invalid/duplicate token
          }
        }
        setProfiles(nextProfiles);
        setActiveProfileId(nextProfiles[0]?.id ?? null);
        setScreen('workspace');
      } catch {
        setStoredToken(null);
      } finally {
        if (active) setBooting(false);
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [inviteQrToken]);

  useEffect(() => {
    if (screen === 'workspace' && activeProfileId) {
      loadWorkspaceData(activeProfileId);
    }
  }, [screen, activeProfileId, loadWorkspaceData]);

  // Poll notifications every 30s while in workspace
  useEffect(() => {
    if (screen !== 'workspace' || !user) return;
    const id = setInterval(() => {
      api
        .getNotifications()
        .then((res) => {
          setNotifications(res.notifications);
          setUnreadCount(res.unreadCount);
          setSmtpConfigured(res.smtpConfigured);
        })
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(id);
  }, [screen, user]);

  function handleAuthenticated(auth: AuthResponse) {
    setUser(auth.user);
    setProfiles(auth.profiles);
    setActiveProfileId(auth.profiles[0]?.id ?? null);
    setActiveTab('dashboard');
    setScreen('workspace');
    if (inviteQrToken && typeof window !== 'undefined') {
      const cleanUrl = window.location.pathname;
      window.history.replaceState({}, '', cleanUrl);
    }
  }

  function handleSignOut() {
    setStoredToken(null);
    signOut(auth).catch(() => {});
    setUser(null);
    setProfiles([]);
    setActiveProfileId(null);
    setScreen('landing');
  }

  async function refreshCurrentProfile() {
    const me = await api.me();
    setUser(me.user);
    setProfiles(me.profiles);
    const targetId = activeProfileId || me.profiles[0]?.id || null;
    if (targetId) {
      setActiveProfileId(targetId);
      await loadWorkspaceData(targetId);
    }
  }

  async function handleLogDose(
    medicationId: string,
    scheduledTime: string,
    status: DoseStatus,
    notes?: string,
  ) {
    if (!activeProfileId) return;
    await api.logDoseStatus(activeProfileId, {
      medicationId,
      scheduledDate: todayDate,
      scheduledTime,
      status,
      notes,
    });
    await loadWorkspaceData(activeProfileId);
  }

  async function handleConnectInitialProfile(e: React.FormEvent) {
    e.preventDefault();
    setLinkError(null);
    try {
      const res = await api.connectProfile({ passcode: linkPasscode });
      setProfiles((prev) => [res.profile, ...prev]);
      setActiveProfileId(res.profile.id);
      setLinkPasscode('');
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Invalid passcode.');
    }
  }

  if (booting) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="font-display text-xl font-bold text-slate-900">WellAge</p>
          <p className="text-sm text-slate-500 mt-1">Smarter Care. Healthier Aging.</p>
        </div>
      </div>
    );
  }

  if (screen === 'landing') {
    return (
      <LandingPage
        onOpenPortal={(mode = 'login') => {
          setAuthMode(mode);
          setScreen('auth');
        }}
      />
    );
  }

  if (screen === 'auth' || !user) {
    return (
      <AuthView
        initialMode={authMode}
        inviteQrToken={inviteQrToken}
        onAuthenticated={handleAuthenticated}
        onBackToLanding={() => setScreen('landing')}
      />
    );
  }

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  const navItems: Array<{
    id: AppTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
  }> = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'medications', label: 'Medications', icon: Pill },
    { id: 'appointments', label: 'Appointments', icon: CalendarClock },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'ai', label: 'WellAge AI', icon: Bot },
    { id: 'care-circle', label: 'Care Circle & QR', icon: Users },
    {
      id: 'notifications',
      label: 'Notifications',
      icon: Bell,
      badge: unreadCount > 0 ? unreadCount : undefined,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-slate-200 bg-white">
        <div className="px-6 py-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('dashboard')}
            className="font-display text-xl font-bold tracking-tight text-slate-900 cursor-pointer"
          >
            WellAge
          </button>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{user.role} Portal · Smarter Care. Healthier Aging.</p>
        </div>

        {profiles.length > 1 && (
          <div className="px-4 py-3 border-b border-slate-200">
            <label className="block text-xs font-medium text-slate-500 mb-1">
              Care Profile
            </label>
            <select
              value={activeProfileId || ''}
              onChange={(e) => setActiveProfileId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-900"
            >
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors cursor-pointer ${
                  active
                    ? 'bg-sky-50 text-sky-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-3 whitespace-nowrap">
                  <Icon className={`w-5 h-5 ${active ? 'text-sky-700' : 'text-slate-500'}`} />
                  {item.label}
                </span>
                {item.badge !== undefined && (
                  <span className="rounded-md bg-rose-700 px-1.5 py-0.5 text-xs font-semibold text-white tabular-nums">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button
            type="button"
            onClick={() => setLargeText((v) => !v)}
            className={`w-full flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${
              largeText
                ? 'border-sky-700 bg-sky-50 text-sky-900'
                : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <span className="flex items-center gap-2">
              <Type className="w-4 h-4" />
              Large Text Mode
            </span>
            <span>{largeText ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-full bg-white h-full flex flex-col border-r border-slate-200 z-10">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <span className="font-display text-lg font-bold text-slate-900">
                WellAge
              </span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-slate-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3.5 py-3 text-sm font-medium cursor-pointer ${
                      active ? 'bg-sky-50 text-sky-900 font-semibold' : 'text-slate-700'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Icon className="w-5 h-5" />
                      {item.label}
                    </span>
                    {item.badge !== undefined && (
                      <span className="rounded bg-rose-700 px-1.5 py-0.5 text-xs text-white tabular-nums">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200 space-y-2">
              <button
                type="button"
                onClick={() => setLargeText((v) => !v)}
                className="w-full flex items-center justify-between rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-semibold text-slate-700 cursor-pointer"
              >
                <span>Large Text Mode</span>
                <span>{largeText ? 'On' : 'Off'}</span>
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="w-full flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur px-4 sm:px-8 py-3.5 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <p className="text-xs text-slate-500 truncate">
                {activeProfile
                  ? `${activeProfile.fullName} · Age ${activeProfile.age} · Physician: ${activeProfile.physicianName}`
                  : `${user.name} · ${user.role}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setActiveTab('notifications')}
              aria-label="Notifications"
              className="relative rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              <Bell className="w-4 h-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 rounded-full bg-rose-700 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {unreadCount}
                </span>
              )}
            </button>
            <div className="hidden sm:block text-right">
              <p className="text-sm font-semibold text-slate-900 leading-tight">{user.name}</p>
              <p className="text-xs text-slate-500 capitalize">{user.role}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-6xl px-4 sm:px-8 py-6 sm:py-8">
          {!activeProfile ? (
            <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center">
              <KeyRound className="w-10 h-10 text-sky-700 mx-auto mb-3" />
              <h1 className="font-display text-2xl font-bold text-slate-900">
                Connect to an Elderly Care Profile
              </h1>
              <p className="text-sm text-slate-600 mt-2 mb-6">
                Enter the 6-digit care passcode provided by the senior or caretaker (try demo
                passcode <span className="font-mono font-semibold text-slate-900">749210</span>).
              </p>
              <form onSubmit={handleConnectInitialProfile} className="space-y-3 text-left">
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={linkPasscode}
                  onChange={(e) => setLinkPasscode(e.target.value)}
                  placeholder="Enter 6-digit passcode (e.g. 749210)"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono text-base tabular-nums focus:border-sky-700 focus:outline-none"
                />
                {linkError && <p className="text-sm text-rose-700">{linkError}</p>}
                <button
                  type="submit"
                  className="w-full rounded-xl bg-sky-700 px-5 py-3 text-base font-semibold text-white hover:bg-sky-800 cursor-pointer"
                >
                  Link Care Profile
                </button>
              </form>
            </div>
          ) : workspaceError ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-900">
              <p className="font-semibold">Unable to load care data</p>
              <p className="text-sm mt-1">{workspaceError}</p>
              <button
                type="button"
                onClick={() => loadWorkspaceData(activeProfile.id)}
                className="mt-4 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white cursor-pointer"
              >
                Retry
              </button>
            </div>
          ) : loadingWorkspace && medications.length === 0 ? (
            <div className="space-y-4">
              <div className="h-28 rounded-2xl bg-slate-200/70 animate-pulse" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="h-24 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="h-24 rounded-xl bg-slate-200/70 animate-pulse" />
                <div className="h-24 rounded-xl bg-slate-200/70 animate-pulse" />
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <DashboardHome
                  user={user}
                  profile={activeProfile}
                  medications={medications}
                  todayLogs={todayLogs}
                  appointments={appointments}
                  analytics={analytics}
                  notifications={notifications}
                  emergencyContacts={emergencyContacts}
                  activities={activities}
                  todayDate={todayDate}
                  onLogDose={handleLogDose}
                  onNavigate={setActiveTab}
                />
              )}

              {activeTab === 'medications' && (
                <MedicationsView
                  user={user}
                  profileId={activeProfile.id}
                  todayDate={todayDate}
                  medications={medications}
                  todayLogs={todayLogs}
                  logs={logs}
                  onRefresh={refreshCurrentProfile}
                  onLogDose={handleLogDose}
                />
              )}

              {activeTab === 'appointments' && (
                <AppointmentsView
                  user={user}
                  profileId={activeProfile.id}
                  appointments={appointments}
                  onRefresh={refreshCurrentProfile}
                />
              )}

              {activeTab === 'analytics' && (
                <AnalyticsView
                  profile={activeProfile}
                  analytics={analytics}
                  logs={logs}
                  activities={activities}
                  medications={medications}
                  user={user}
                />
              )}

              {activeTab === 'ai' && (
                <AiAssistantView
                  profile={activeProfile}
                  messages={aiMessages}
                  loadingHistory={loadingAiHistory}
                  onMessagesChange={setAiMessages}
                />
              )}

              {activeTab === 'care-circle' && (
                <CareCircleView
                  user={user}
                  profile={activeProfile}
                  elderlyOwner={elderlyOwner}
                  family={familyMembers}
                  caretakers={caretakers}
                  emergencyContacts={emergencyContacts}
                  onRefresh={refreshCurrentProfile}
                />
              )}

              {activeTab === 'notifications' && (
                <NotificationsView
                  notifications={notifications}
                  smtpConfigured={smtpConfigured}
                  onRefresh={refreshCurrentProfile}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Floating WellAge AI Chat Button & Panel (visible on Dashboard and non-AI tabs) */}
      {activeProfile && activeTab !== 'ai' && (
        <div className="fixed bottom-5 right-5 z-40">
          {floatingChatOpen ? (
            <div className="w-[calc(100vw-2rem)] sm:w-[410px]">
              <WellAgeAiChat
                profile={activeProfile}
                messages={aiMessages}
                loadingHistory={loadingAiHistory}
                onMessagesChange={setAiMessages}
                variant="floating"
                onExpandToFullScreen={() => {
                  setFloatingChatOpen(false);
                  setActiveTab('ai');
                }}
                onCloseFloating={() => setFloatingChatOpen(false)}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setFloatingChatOpen(true)}
              aria-label="Open WellAge AI Assistant"
              className="inline-flex items-center gap-2.5 rounded-2xl bg-sky-700 px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 transition-colors cursor-pointer"
            >
              <Bot className="w-5 h-5" />
              <span>WellAge AI</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
