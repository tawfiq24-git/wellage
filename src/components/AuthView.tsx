import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import {
  ArrowLeft,
  HeartHandshake,
  KeyRound,
  Lock,
  Stethoscope,
  UserCheck,
} from 'lucide-react';
import { api, setStoredToken, type AuthResponse } from '../api';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { UserRole } from '../types';

interface AuthViewProps {
  initialMode?: 'login' | 'register' | 'connect';
  inviteQrToken?: string | null;
  onAuthenticated: (auth: AuthResponse) => void;
  onBackToLanding: () => void;
}

export function AuthView({
  initialMode = 'login',
  inviteQrToken,
  onAuthenticated,
  onBackToLanding,
}: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'register'>(
    initialMode === 'register' || inviteQrToken ? 'register' : 'login',
  );
  const [role, setRole] = useState<UserRole>(inviteQrToken ? 'family' : 'elderly');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState('72');
  const [bloodGroup, setBloodGroup] = useState('O+');
  const [physicianName, setPhysicianName] = useState('');
  const [passcode, setPasscode] = useState('');
  const [relationship, setRelationship] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDemoSignIn(demoRole: UserRole) {
    setError(null);
    setLoading(true);
    try {
      const authRes = await api.demoLogin(demoRole);
      setStoredToken(authRes.token);
      if (inviteQrToken && demoRole !== 'elderly') {
        try {
          const connected = await api.connectProfile({ qrToken: inviteQrToken });
          authRes.profiles = [
            connected.profile,
            ...authRes.profiles.filter((p) => p.id !== connected.profile.id),
          ];
        } catch {
          // Ignore if already connected or invalid token
        }
      }
      onAuthenticated(authRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo login failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setStoredToken(idToken);
      const authRes = await api.firebaseLogin(idToken, {
        role,
        passcode: role !== 'elderly' && passcode ? passcode : undefined,
        relationship: role === 'family' ? relationship : undefined,
        specialization: role === 'caretaker' ? specialization : undefined,
      });
      if (inviteQrToken && authRes.user.role !== 'elderly') {
        try {
          const connected = await api.connectProfile({ qrToken: inviteQrToken });
          authRes.profiles = [
            connected.profile,
            ...authRes.profiles.filter((p) => p.id !== connected.profile.id),
          ];
        } catch {
          // Ignore invalid/duplicate QR invite
        }
      }
      onAuthenticated(authRes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (mode === 'login') {
        const auth = await api.login(email, password);
        setStoredToken(auth.token);
        if (inviteQrToken && auth.user.role !== 'elderly') {
          const connected = await api.connectProfile({ qrToken: inviteQrToken });
          auth.profiles = [
            connected.profile,
            ...auth.profiles.filter((p) => p.id !== connected.profile.id),
          ];
        }
        onAuthenticated(auth);
      } else {
        const auth = await api.register({
          name,
          email,
          password,
          phone,
          role,
          age: role === 'elderly' ? Number(age) : undefined,
          bloodGroup: role === 'elderly' ? bloodGroup : undefined,
          physicianName: role === 'elderly' ? physicianName : undefined,
          passcode: role !== 'elderly' && passcode ? passcode : undefined,
          relationship: role === 'family' ? relationship : undefined,
          specialization: role === 'caretaker' ? specialization : undefined,
        });
        setStoredToken(auth.token);
        if (inviteQrToken && role !== 'elderly') {
          const connected = await api.connectProfile({ qrToken: inviteQrToken });
          auth.profiles = [
            connected.profile,
            ...auth.profiles.filter((p) => p.id !== connected.profile.id),
          ];
        }
        onAuthenticated(auth);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <button
          type="button"
          onClick={onBackToLanding}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to WellAge Overview
        </button>

        {inviteQrToken && (
          <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 px-5 py-4 text-sm text-teal-900">
            <p className="font-semibold">Care Circle QR Invitation Detected</p>
            <p className="mt-0.5 text-teal-800">
              Sign in or register as a Family Member or Caretaker to automatically link to the
              invited senior care profile.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Real Auth Form */}
          <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">
                  {mode === 'login' ? 'Sign in to WellAge' : 'Create WellAge Account'}
                </h1>
                <p className="text-sm text-slate-600 mt-1">
                  Smarter Care. Healthier Aging. — Role-based access for seniors, family, and caretakers.
                </p>
              </div>
              <div className="inline-flex rounded-lg bg-slate-100 p-1 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'login'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                  }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer ${
                    mode === 'register'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Register
                </button>
              </div>
            </div>

            {error && (
              <div
                role="alert"
                className="mb-5 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
              >
                {error}
              </div>
            )}

            <div className="mb-5">
              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                  />
                </svg>
                Continue with Google
              </button>

              <div className="relative my-4 flex items-center">
                <div className="flex-grow border-t border-slate-200" />
                <span className="mx-3 text-xs font-medium uppercase tracking-wider text-slate-400">
                  or with email
                </span>
                <div className="flex-grow border-t border-slate-200" />
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'register' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-slate-800 mb-2">
                      Select Your Role
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {(
                        [
                          { id: 'elderly', label: 'Elderly User', desc: 'My personal routine' },
                          { id: 'family', label: 'Family Member', desc: 'Monitor & alerts' },
                          { id: 'caretaker', label: 'Caretaker', desc: 'Manage schedules' },
                        ] as const
                      ).map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setRole(r.id)}
                          className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                            role === r.id
                              ? 'border-sky-700 bg-sky-50 text-sky-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <p className="text-sm font-semibold">{r.label}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{r.desc}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Full Name
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g. Martha Jenkins"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 (555) 010-2000"
                        className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Password
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 6 characters"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                />
              </div>

              {mode === 'register' && role === 'elderly' && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Age</label>
                    <input
                      type="number"
                      min={50}
                      max={120}
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Blood Group
                    </label>
                    <input
                      type="text"
                      value={bloodGroup}
                      onChange={(e) => setBloodGroup(e.target.value)}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Primary Physician
                    </label>
                    <input
                      type="text"
                      value={physicianName}
                      onChange={(e) => setPhysicianName(e.target.value)}
                      placeholder="Dr. Smith"
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-base text-slate-900 focus:border-sky-700 focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {mode === 'register' && (role === 'family' || role === 'caretaker') && (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <KeyRound className="w-4 h-4 text-sky-700" />
                    <span>Connect to an Elderly Profile (Optional now)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-600 mb-1">
                        6-Digit Care Passcode (Demo: 749210)
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        value={passcode}
                        onChange={(e) => setPasscode(e.target.value)}
                        placeholder="e.g. 749210"
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums focus:border-sky-700 focus:outline-none"
                      />
                    </div>
                    {role === 'family' ? (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Relationship
                        </label>
                        <input
                          type="text"
                          value={relationship}
                          onChange={(e) => setRelationship(e.target.value)}
                          placeholder="e.g. Son, Daughter, Spouse"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-700 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          Care Specialization
                        </label>
                        <input
                          type="text"
                          value={specialization}
                          onChange={(e) => setSpecialization(e.target.value)}
                          placeholder="e.g. Home Care RN"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-700 focus:outline-none"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl bg-sky-700 px-5 py-3.5 text-base font-semibold text-white hover:bg-sky-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {loading
                  ? 'Please wait...'
                  : mode === 'login'
                    ? 'Sign In'
                    : 'Create Account & Continue'}
              </button>
            </form>
          </div>

          {/* Right Column: Instant Demo Access */}
          <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-6 sm:p-8">
            <div className="flex items-center gap-2 text-sm font-semibold text-teal-700 mb-2">
              <Lock className="w-4 h-4" />
              <span>Instant Hackathon Demo Access</span>
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 mb-2">
              Test any role in one click
            </h2>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              Sign directly into Arthur Pendelton&apos;s pre-populated care circle (passcode{' '}
              <span className="font-mono font-semibold text-slate-900">749210</span>) to verify
              role-specific permissions, schedules, alerts, and analytics.
            </p>

            <div className="space-y-3">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoSignIn('elderly')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-sky-300 p-4 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-sky-700 text-white flex items-center justify-center shrink-0">
                      <UserCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Arthur Pendelton</p>
                      <p className="text-xs text-slate-600">
                        Elderly User · Confirm doses, view visits, ask AI
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-sky-700 shrink-0">Enter</span>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoSignIn('family')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-teal-50 hover:border-teal-300 p-4 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
                      <HeartHandshake className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Clara Pendelton</p>
                      <p className="text-xs text-slate-600">
                        Family Member · Adherence reports &amp; missed alerts
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-teal-700 shrink-0">Enter</span>
                </div>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleDemoSignIn('caretaker')}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 hover:bg-violet-50 hover:border-violet-300 p-4 text-left transition-colors cursor-pointer"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-violet-700 text-white flex items-center justify-center shrink-0">
                      <Stethoscope className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">Elena Vance, RN</p>
                      <p className="text-xs text-slate-600">
                        Caretaker · Add/edit medications &amp; appointments
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-violet-700 shrink-0">Enter</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
