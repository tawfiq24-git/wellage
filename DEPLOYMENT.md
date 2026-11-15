# WellAge — Setup & Google Cloud Run Deployment Guide

## 1. Local Development

```bash
npm install
cp .env.example .env
# Add your GEMINI_API_KEY (and optional SMTP_* credentials) to .env
npm run dev
```

The app and REST API run together on `http://localhost:3000`.

## 2. Demo Accounts (Pre-seeded Demonstration Data)

You can use one-click demo buttons on the sign-in page or sign in manually with password `ElderCare2026!`:
- **Elderly User:** `arthur.pendelton@eldercare360.demo` (Profile Passcode: `749210`)
- **Family Member:** `clara.family@eldercare360.demo`
- **Caretaker:** `elena.caretaker@eldercare360.demo`

## 3. Environment Variables

- `GEMINI_API_KEY`: Google Gemini API key for WellAge AI (`gemini-4-hydrogen`).
- `ELDERCARE_SESSION_SECRET`: Random 32+ character secret for signing session tokens.
- `APP_URL`: Public URL used inside QR care-circle invitation links.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`: Optional Nodemailer SMTP credentials for automated email reminders.

## 4. Deploy to Google Cloud Run

```bash
gcloud auth login
gcloud config set project YOUR_GCP_PROJECT_ID

gcloud run deploy wellage \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-env-vars "NODE_ENV=production,ELDERCARE_SESSION_SECRET=replace-with-strong-secret" \
  --set-secrets "GEMINI_API_KEY=GEMINI_API_KEY:latest"
```
