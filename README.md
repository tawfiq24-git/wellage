#  WellAge – Smarter Care. Healthier Aging.

### AI-Powered Elderly Care & Medication Management Platform

WellAge is an intelligent elderly healthcare management platform designed to simplify medication management, doctor appointments, and daily healthcare routines while keeping family members and caretakers connected.

Our goal is to make elderly care smarter, safer, more accessible, and collaborative through AI-powered assistance and technology.

---

##  Overview

Elderly individuals often face challenges managing daily medications, remembering medical appointments, and maintaining consistent healthcare routines.

WellAge addresses these challenges through a shared healthcare ecosystem that connects elderly individuals, family members, and caretakers using secure access and intelligent healthcare management features.

##  Key Features

###  Smart Medication Management
- Add, view, edit, and manage medication schedules.
- Track medication adherence.
- Mark medications as Taken, Missed, or Skipped.
- Maintain medication history.
- Receive medication reminders.

###  Family & Caregiver Coordination
- Shared elderly healthcare profiles.
- Secure passcode-based access.
- Multiple authorized family members and caretakers.
- Monitor medication adherence.
- Collaborative healthcare management.

###  Doctor Appointment Management
- Schedule doctor appointments.
- Manage doctor and hospital information.
- Track upcoming appointments.
- Maintain appointment history.
- Receive appointment reminders.

###  WellAge AI – Healthcare Assistant
- Gemini-powered AI chatbot.
- Understand medication schedules.
- Retrieve authorized healthcare information.
- Assist with daily healthcare routines.
- Provide general wellness guidance.
- Elderly-friendly conversational interface.

###  Smart Notifications
- Upcoming medication reminders.
- Missed medication alerts.
- Doctor appointment notifications.
- In-app notification management.
- Email notification integration.

###  Healthcare Analytics
- Medication adherence reports.
- Daily and weekly tracking.
- Taken vs. missed medication statistics.
- Healthcare activity monitoring.

###  Additional Features
- Emergency contact management.
- Voice-friendly interaction.
- Accessible and responsive interface.
- Secure healthcare profile management.

---

##  Technology Stack

| Category | Technologies |
|---|---|
| Frontend | React.js, Vite, JavaScript |
| Styling | Tailwind CSS |
| Backend | Node.js, Express.js |
| Database | PostgreSQL |
| ORM | Prisma |
| AI Integration | Google Gemini API |
| Authentication | Firebase Authentication (if configured) |
| Notifications | Nodemailer |
| Charts | Recharts |
| Deployment | Google Cloud Run |

---

##  Application Architecture

```text
             WellAge Application
                      |
              React + Vite
                      |
             Express Backend
                      |
        --------------------------
        |            |           |
     Gemini AI    REST APIs   Authentication
        |            |           |
        --------------------------
                      |
                 Prisma ORM
                      |
                PostgreSQL
                      |
        --------------------------
        |            |           |
      Users      Medications  Appointments
        |            |           |
     Family       Logs       Notifications
```

---

##  Security

- Secure authentication and authorization.
- Role-based access control.
- Protected backend APIs.
- Environment-based API credentials.
- Secure database connectivity.
- Authorized access to healthcare profiles.
- Protection of sensitive healthcare information.

**Medical Disclaimer:** WellAge AI provides general healthcare routine assistance and is not a substitute for professional medical advice, diagnosis, or treatment.

---

## ⚙️ Installation and Setup

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/wellage.git
cd wellage
```

### 2. Install Dependencies

Install frontend and backend dependencies according to the project structure.

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env` file in the backend directory.

```env
PORT=5000
DATABASE_URL=your_postgresql_connection_string
GEMINI_API_KEY=your_gemini_api_key
```

Add other required credentials for authentication and email notifications.

### 4. Configure PostgreSQL and Prisma

```bash
npx prisma generate
npx prisma migrate dev
```

### 5. Start the Application

Run the backend:

```bash
npm run dev
```

Run the frontend in its respective directory:

```bash
npm run dev
```

**Note:** Installation commands may vary depending on the actual project folder structure and configured scripts.

---

##  Project Objective

WellAge aims to improve elderly healthcare management by connecting technology, artificial intelligence, and family collaboration into one accessible platform.

We believe that technology should not only make healthcare smarter but also make caring for
