import React, { useEffect, useState } from 'react';
import {
  Copy,
  KeyRound,
  PhoneCall,
  Plus,
  QrCode,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../api';
import type {
  CareCircleMember,
  ElderlyProfile,
  EmergencyContact,
  UserProfile,
} from '../types';

interface CareCircleViewProps {
  user: UserProfile;
  profile: ElderlyProfile;
  elderlyOwner: UserProfile | null;
  family: CareCircleMember[];
  caretakers: CareCircleMember[];
  emergencyContacts: EmergencyContact[];
  onRefresh: () => Promise<void>;
}

export function CareCircleView({
  user,
  profile,
  elderlyOwner,
  family,
  caretakers,
  emergencyContacts,
  onRefresh,
}: CareCircleViewProps) {
  const canManageSecurity = user.role === 'elderly' || user.role === 'caretaker';
  const canConnectProfiles = user.role === 'family' || user.role === 'caretaker';

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string>('');
  const [rotating, setRotating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Connect profile state
  const [connectPasscode, setConnectPasscode] = useState('');
  const [connectRel, setConnectRel] = useState('');
  const [connectStatus, setConnectStatus] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  // Emergency Contact form state
  const [showAddContact, setShowAddContact] = useState(false);
  const [ecName, setEcName] = useState('');
  const [ecRel, setEcRel] = useState('');
  const [ecPhone, setEcPhone] = useState('');
  const [ecEmail, setEcEmail] = useState('');
  const [ecPrimary, setEcPrimary] = useState(false);

  useEffect(() => {
    if (!canManageSecurity) return;
    let active = true;
    api
      .getQrInvite(profile.id)
      .then((res) => {
        if (!active) return;
        setQrDataUrl(res.qrDataUrl);
        setInviteUrl(res.inviteUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [profile.id, profile.passcode, canManageSecurity]);

  async function handleRotatePasscode() {
    setRotating(true);
    try {
      await api.rotatePasscode(profile.id);
      await onRefresh();
    } finally {
      setRotating(false);
    }
  }

  async function handleCopyInvite() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleConnectByPasscode(e: React.FormEvent) {
    e.preventDefault();
    setConnectError(null);
    setConnectStatus(null);
    try {
      const res = await api.connectProfile({
        passcode: connectPasscode,
        relationship: user.role === 'family' ? connectRel : undefined,
        specialization: user.role === 'caretaker' ? connectRel : undefined,
      });
      setConnectStatus(res.message);
      setConnectPasscode('');
      setConnectRel('');
      await onRefresh();
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : 'Unable to connect.');
    }
  }

  async function handleAddEmergencyContact(e: React.FormEvent) {
    e.preventDefault();
    await api.addEmergencyContact(profile.id, {
      name: ecName,
      relationship: ecRel,
      phone: ecPhone,
      email: ecEmail,
      isPrimary: ecPrimary,
    });
    setEcName('');
    setEcRel('');
    setEcPhone('');
    setEcEmail('');
    setEcPrimary(false);
    setShowAddContact(false);
    await onRefresh();
  }

  async function handleDeleteContact(contactId: string) {
    await api.deleteEmergencyContact(profile.id, contactId);
    await onRefresh();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">
          Family Care Circle, QR Access &amp; Emergency Contacts
        </h1>
        <p className="text-sm text-slate-600 mt-0.5">
          Manage authorized care circle connections, passcode/QR sharing, and quick-dial
          emergency numbers.
        </p>
      </div>

      {/* Emergency Contacts Quick-Call Section */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-2.5">
            <PhoneCall className="w-5 h-5 text-rose-700" />
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">
                Emergency Contacts (Quick-Call)
              </h2>
              <p className="text-xs text-slate-500">
                Tap any contact card button to immediately initiate a phone call.
              </p>
            </div>
          </div>

          {canManageSecurity && (
            <button
              type="button"
              onClick={() => setShowAddContact((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Add Contact
            </button>
          )}
        </div>

        {showAddContact && canManageSecurity && (
          <form
            onSubmit={handleAddEmergencyContact}
            className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
          >
            <input
              type="text"
              required
              value={ecName}
              onChange={(e) => setEcName(e.target.value)}
              placeholder="Contact name"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="text"
              required
              value={ecRel}
              onChange={(e) => setEcRel(e.target.value)}
              placeholder="Relationship (e.g. Son)"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <input
              type="tel"
              required
              value={ecPhone}
              onChange={(e) => setEcPhone(e.target.value)}
              placeholder="Phone number"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            />
            <div className="flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 rounded-lg bg-sky-700 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-800 cursor-pointer"
              >
                Save
              </button>
              <button
                type="button"
                onClick={() => setShowAddContact(false)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {emergencyContacts.map((c) => (
            <div
              key={c.id}
              className="rounded-xl border border-slate-200 bg-slate-50 p-4 flex flex-col justify-between gap-3"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-600">
                      {c.relationship}
                      {c.isPrimary ? ' · Primary' : ''}
                    </p>
                  </div>
                  {canManageSecurity && (
                    <button
                      type="button"
                      onClick={() => handleDeleteContact(c.id)}
                      aria-label={`Remove ${c.name}`}
                      className="text-slate-400 hover:text-rose-700 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="mt-2 font-mono text-sm font-semibold text-slate-800 tabular-nums">
                  {c.phone}
                </p>
              </div>
              <a
                href={`tel:${c.phone.replace(/[^\d+]/g, '')}`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-800 transition-colors"
              >
                <PhoneCall className="w-4 h-4" />
                Call Now
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Passcode & QR-Based Profile Access */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {canManageSecurity && (
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 mb-2">
              <QrCode className="w-5 h-5 text-sky-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Passcode &amp; QR-Based Profile Access
              </h2>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              Share this 6-digit passcode or QR code with authorized family members or
              caretakers. The QR code holds only an opaque invite token—never private medical
              data.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shrink-0">
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Care Circle QR authorization code"
                    className="w-40 h-40"
                  />
                ) : (
                  <div className="w-40 h-40 flex items-center justify-center bg-slate-100 text-slate-400">
                    <QrCode className="w-10 h-10" />
                  </div>
                )}
              </div>

              <div className="flex-1 w-full space-y-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <p className="text-xs font-medium text-slate-500">6-Digit Access Passcode</p>
                  <p className="mt-1 font-mono text-2xl font-bold tracking-widest text-slate-900 tabular-nums">
                    {profile.passcode}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRotatePasscode}
                    disabled={rotating}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${rotating ? 'animate-spin' : ''}`} />
                    Rotate Passcode
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyInvite}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-sky-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-sky-800 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied ? 'Copied Invite Link' : 'Copy QR Link'}
                  </button>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-teal-800">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Zero PII or diagnoses stored inside QR payload</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {canConnectProfiles && (
          <section className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div className="flex items-center gap-2.5 mb-2">
              <UserPlus className="w-5 h-5 text-teal-700" />
              <h2 className="font-display text-lg font-bold text-slate-900">
                Link Another Elderly Care Profile
              </h2>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Enter a senior&apos;s 6-digit care passcode to join their Care Circle.
            </p>

            <form onSubmit={handleConnectByPasscode} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  6-Digit Passcode
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={connectPasscode}
                    onChange={(e) => setConnectPasscode(e.target.value)}
                    placeholder="749210"
                    className="w-full rounded-xl border border-slate-300 pl-9 pr-3.5 py-2.5 font-mono text-sm tabular-nums focus:border-sky-700 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  {user.role === 'family' ? 'Relationship' : 'Care Specialization'}
                </label>
                <input
                  type="text"
                  value={connectRel}
                  onChange={(e) => setConnectRel(e.target.value)}
                  placeholder={user.role === 'family' ? 'Daughter / Son' : 'Geriatric RN'}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-sky-700 focus:outline-none"
                />
              </div>
              {connectError && (
                <p className="text-xs text-rose-700 font-medium">{connectError}</p>
              )}
              {connectStatus && (
                <p className="text-xs text-emerald-700 font-medium">{connectStatus}</p>
              )}
              <button
                type="submit"
                className="rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 cursor-pointer"
              >
                Connect Profile
              </button>
            </form>
          </section>
        )}

        {/* Authorized Care Circle Members */}
        <section
          className={`${
            canManageSecurity || canConnectProfiles ? 'lg:col-span-6' : 'lg:col-span-12'
          } rounded-2xl border border-slate-200 bg-white p-6`}
        >
          <div className="flex items-center gap-2.5 mb-4">
            <Users className="w-5 h-5 text-sky-700" />
            <h2 className="font-display text-lg font-bold text-slate-900">
              Authorized Care Circle Members
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            {elderlyOwner && (
              <div className="py-3 first:pt-0 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {elderlyOwner.avatarUrl ? (
                    <img
                      src={elderlyOwner.avatarUrl}
                      alt={elderlyOwner.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 flex items-center justify-center font-bold">
                      {elderlyOwner.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{elderlyOwner.name}</p>
                    <p className="text-xs text-slate-500">
                      Primary Care Profile · {elderlyOwner.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-sky-700">Elderly</span>
              </div>
            )}

            {caretakers.map((ct) => (
              <div
                key={ct.connectionId}
                className="py-3 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  {ct.avatarUrl ? (
                    <img
                      src={ct.avatarUrl}
                      alt={ct.name}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-full object-cover border border-slate-200"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-violet-100 text-violet-800 flex items-center justify-center font-bold">
                      {ct.name.charAt(0)}
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-slate-900">{ct.name}</p>
                    <p className="text-xs text-slate-500">
                      {ct.specialization} · {ct.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-violet-700">Caretaker</span>
              </div>
            ))}

            {family.map((fm) => (
              <div
                key={fm.connectionId}
                className="py-3 last:pb-0 flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold">
                    {fm.name.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{fm.name}</p>
                    <p className="text-xs text-slate-500">
                      {fm.relationship} · {fm.email}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-semibold text-teal-700">Family</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
