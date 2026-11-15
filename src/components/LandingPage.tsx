import { useState } from 'react';
import {
  ArrowRight,
  BellRing,
  Bot,
  CalendarClock,
  HeartPulse,
  KeyRound,
  Pill,
  QrCode,
  ShieldCheck,
  Users,
} from 'lucide-react';
import heroFamilyImg from '../assets/images/hero_eldercare_family_1794717649952.jpg';
import medRoutineImg from '../assets/images/elder_care_medication_1794717649280.jpg';

interface LandingPageProps {
  onOpenPortal: (initialMode?: 'login' | 'register' | 'connect') => void;
}

export function LandingPage({ onOpenPortal }: LandingPageProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [medImgFailed, setMedImgFailed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-8 px-6 py-4">
          <a
            href="#top"
            className="font-display text-xl font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            WellAge
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#features"
              className="hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              How It Works
            </a>
            <a
              href="#roles"
              className="hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Care Roles
            </a>
            <a
              href="#benefits"
              className="hover:text-sky-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Benefits
            </a>
          </nav>

          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => onOpenPortal('login')}
              className="rounded-xl bg-sky-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Open Care Portal
            </button>
          </div>
        </div>
      </header>

      <main id="top">
        {/* Hero Section */}
        <section className="border-b border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-14 lg:py-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-sm font-semibold tracking-wide text-teal-700 mb-3">
                  Smarter Care. Healthier Aging. · Passcode &amp; QR Circle Access
                </p>
                <h1
                  className="font-display font-bold tracking-tight text-slate-900 leading-[1.12] mb-5"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                >
                  Coordinated medication routines and calm daily peace of mind.
                </h1>
                <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                  WellAge links elderly individuals, family members, and caretakers in one
                  accessible workspace. Track daily doses, coordinate doctor visits, receive
                  automated missed-dose email alerts, and ask WellAge AI routine questions with
                  voice support.
                </p>

                <div className="flex flex-wrap items-center gap-4">
                  <button
                    type="button"
                    onClick={() => onOpenPortal('login')}
                    className="inline-flex items-center gap-2 rounded-xl bg-sky-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Launch Care Portal
                    <ArrowRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenPortal('register')}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-6 py-3.5 text-base font-semibold text-slate-800 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Connect with Passcode
                  </button>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-600">
                  <span>3 Role Permissions</span>
                  <span aria-hidden="true">·</span>
                  <span>Automated Email Alerts</span>
                  <span aria-hidden="true">·</span>
                  <span>Voice-Ready Gemini Assistant</span>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="h-full min-h-[300px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                  {!heroImgFailed ? (
                    <img
                      src={heroFamilyImg}
                      alt="Senior father and adult daughter reviewing daily medication schedule together on a tablet"
                      referrerPolicy="no-referrer"
                      onError={() => setHeroImgFailed(true)}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full min-h-[320px] flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-white to-teal-50 p-8 text-center">
                      <HeartPulse className="w-12 h-12 text-sky-700 mb-3" />
                      <p className="font-display text-lg font-semibold text-slate-800">
                        WellAge Family Workspace
                      </p>
                      <p className="text-sm text-slate-600 max-w-xs mt-1">
                        Shared daily schedules, reminders, and clinical appointment tracking.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Full-width 4-column summary strip below hero */}
            <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-medium text-slate-500">Medication Safety</p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                  4 Daily Windows
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Morning, afternoon, evening, and bedtime timelines with food instructions.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-medium text-slate-500">Smart Care Alerts</p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                  45-Min Escalation
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Automated detection for missed doses and repeated 72-hour patterns.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-medium text-slate-500">Secure Collaboration</p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                  6-Digit &amp; QR Token
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Authorize relatives or nurses without exposing medical records in QR codes.
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                <p className="text-xs font-medium text-slate-500">AI Routine Guide</p>
                <p className="mt-1 font-display text-2xl font-bold text-slate-900 tabular-nums">
                  Voice + Text
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Non-diagnostic schedule explanations with speech input and read-aloud replies.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* About & Key Features (Asymmetric Bento Grid) */}
        <section id="features" className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-semibold text-sky-700 mb-2">About WellAge</p>
            <h2
              className="font-display text-3xl font-bold tracking-tight text-slate-900"
              style={{ textWrap: 'balance' }}
            >
              Built for older adults to read easily and for care teams to coordinate reliably.
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-6 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-3 text-sky-700 mb-3">
                  <Pill className="w-6 h-6" />
                  <span className="text-sm font-semibold">01. Daily Medication Timeline</span>
                </div>
                <h3 className="font-display text-xl font-bold text-slate-900 mb-2">
                  Clear dosage windows with one-tap confirmation
                </h3>
                <p className="text-slate-600 leading-relaxed mb-6">
                  Every prescription displays its exact dosage, start and end dates, multiple
                  daily timings, and before-food or after-food instructions. Seniors and caretakers
                  mark each dose Taken, Skipped, or Missed with complete history logging—and strict
                  guardrails against recommending double doses.
                </p>
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 h-60">
                {!medImgFailed ? (
                  <img
                    src={medRoutineImg}
                    alt="Organized weekly medication organizer next to fresh water on an oak table"
                    referrerPolicy="no-referrer"
                    onError={() => setMedImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-sky-50 text-sky-700">
                    <Pill className="w-10 h-10" />
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5 grid grid-cols-1 gap-6">
              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3 text-teal-700 mb-3">
                  <BellRing className="w-6 h-6" />
                  <span className="text-sm font-semibold">02. Automated Email &amp; Smart Alerts</span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  Proactive missed-dose &amp; appointment dispatch
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Background jobs scan upcoming doses within 30 minutes, flag missed windows after
                  45 minutes, escalate repeated misses within 72 hours, and deliver Nodemailer SMTP
                  email reminders to authorized family and caretakers.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3 text-violet-700 mb-3">
                  <Bot className="w-6 h-6" />
                  <span className="text-sm font-semibold">03. WellAge AI Assistant</span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  Plain-language routine guidance powered by Gemini
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Explains saved medication timings, app navigation, and healthy daily habits in
                  gentle, simple words. Includes voice dictation, read-aloud responses, and a clear
                  non-diagnostic safety notice.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3 text-sky-700 mb-3">
                  <CalendarClock className="w-6 h-6" />
                  <span className="text-sm font-semibold">04. Doctor Visits &amp; Emergency Quick-Call</span>
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  Appointments, adherence analytics &amp; one-tap calling
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Keep clinic details, visit purposes, 30-day adherence charts, CSV reports, and
                  primary emergency phone numbers always within one click.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-y border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="max-w-2xl mb-10">
              <p className="text-sm font-semibold text-teal-700 mb-2">How It Works</p>
              <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
                Three steps from profile setup to coordinated daily care.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-sky-700 text-white mb-4">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  1. Create Profile &amp; Share Passcode
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  An elderly user registers and receives a rotating 6-digit passcode and an opaque
                  QR invitation token—keeping medical records completely private from the QR payload.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-teal-700 text-white mb-4">
                  <QrCode className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  2. Authorize Family &amp; Caretakers
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Family members and registered caretakers connect using the passcode or QR link.
                  Role-based permissions keep clinical scheduling and read-only monitoring cleanly
                  separated.
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-violet-700 text-white mb-4">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <h3 className="font-display text-lg font-bold text-slate-900 mb-2">
                  3. Track Doses, Visits &amp; Alerts
                </h3>
                <p className="text-sm text-slate-600 leading-relaxed">
                  Caretakers maintain medication schedules and appointments while seniors confirm
                  doses in large high-contrast cards. Missed patterns immediately alert the care
                  circle.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Roles & Benefits */}
        <section id="roles" className="mx-auto max-w-7xl px-6 py-16">
          <div className="max-w-2xl mb-10">
            <p className="text-sm font-semibold text-sky-700 mb-2">Role-Based Ecosystem</p>
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
              Tailored tools and permissions for every member of the care circle.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-sky-700 mb-1">Elderly User</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                Simple daily independence
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li>Large-text accessibility mode and high-contrast buttons</li>
                <li>Mark today&apos;s medicines Taken, Skipped, or Missed</li>
                <li>View upcoming doctor appointments and clinic phone numbers</li>
                <li>Ask WellAge AI via voice or text and hear spoken replies</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-teal-700 mb-1">Family Member</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                Connected peace of mind
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li>Connect securely via 6-digit passcode or QR invitation</li>
                <li>Monitor real-time daily, weekly, and 30-day adherence rates</li>
                <li>Receive automated email alerts on missed or repeated missed doses</li>
                <li>Review appointment schedules and caregiver activity logs</li>
              </ul>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <p className="text-sm font-semibold text-violet-700 mb-1">Caretaker / Nurse</p>
              <h3 className="font-display text-xl font-bold text-slate-900 mb-3">
                Structured clinical coordination
              </h3>
              <ul className="space-y-2.5 text-sm text-slate-600">
                <li>Add, edit, and retire medication schedules and food instructions</li>
                <li>Manage doctor appointments and dispatch instant reminders</li>
                <li>Log medication confirmations and review Smart Care Alerts</li>
                <li>Export adherence CSV reports for physician visits</li>
              </ul>
            </div>
          </div>
        </section>

        {/* Benefits & Final CTA */}
        <section id="benefits" className="border-t border-slate-200 bg-white">
          <div className="mx-auto max-w-7xl px-6 py-16">
            <div className="rounded-2xl border border-slate-200 bg-sky-50/70 p-8 lg:p-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2 text-sky-800 text-sm font-semibold mb-2">
                  <Users className="w-4 h-4" />
                  <span>Ready to Explore Live</span>
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 mb-3">
                  Try all three care roles instantly with pre-loaded patient data.
                </h2>
                <p className="text-slate-600 leading-relaxed">
                  Explore Arthur Pendelton&apos;s care profile as an Elderly User, Family Member,
                  or Caretaker—or register a fresh profile and test passcode linking, AI assistance,
                  analytics, and automated reminder scans.
                </p>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => onOpenPortal('login')}
                  className="rounded-xl bg-sky-700 px-6 py-3.5 text-base font-semibold text-white hover:bg-sky-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  Open Demo &amp; Sign In
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-slate-50 py-8">
        <div className="mx-auto max-w-7xl px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
          <p className="font-display font-semibold text-slate-700">
            WellAge · Smarter Care. Healthier Aging.
          </p>
          <p>
            Routine coordination &amp; informational AI support only. Not a substitute for
            licensed medical advice.
          </p>
        </div>
      </footer>
    </div>
  );
}
