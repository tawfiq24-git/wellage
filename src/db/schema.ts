import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

// 1. Users
export const users = pgTable('users', {
  userId: text('user_id').primaryKey(),
  firebaseUid: text('firebase_uid').unique(),
  fullName: text('full_name').notNull(),
  email: text('email').notNull().unique(),
  phone: text('phone').notNull().default(''),
  passwordHash: text('password_hash').notNull().default(''),
  role: text('role').notNull().default('elderly'), // 'elderly' | 'family' | 'caretaker'
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 2. Elderly_Profiles
export const elderlyProfiles = pgTable('elderly_profiles', {
  profileId: text('profile_id').primaryKey(),
  userId: text('user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  fullName: text('full_name').notNull(),
  age: integer('age').notNull().default(70),
  dateOfBirth: text('date_of_birth').notNull().default(''),
  bloodGroup: text('blood_group').notNull().default('O+'),
  emergencyContact: text('emergency_contact').notNull().default(''),
  address: text('address').notNull().default(''),
  medicalNotes: text('medical_notes').notNull().default(''),
  allergies: jsonb('allergies').$type<string[]>().notNull().default([]),
  primaryConditions: jsonb('primary_conditions').$type<string[]>().notNull().default([]),
  physicianName: text('physician_name').notNull().default('Primary Care Physician'),
  physicianPhone: text('physician_phone').notNull().default(''),
  passcodePlain: text('passcode_plain').notNull(),
  passcodeHash: text('passcode_hash').notNull(),
  qrInviteToken: text('qr_invite_token').notNull().unique(),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 3. Family_Connections
export const familyConnections = pgTable('family_connections', {
  connectionId: text('connection_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  familyUserId: text('family_user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  relationship: text('relationship').notNull().default('Family Member'),
  accessStatus: text('access_status').notNull().default('active'),
  receiveEmailAlerts: boolean('receive_email_alerts').notNull().default(true),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
});

// 4. Caretaker_Connections
export const caretakerConnections = pgTable('caretaker_connections', {
  connectionId: text('connection_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  caretakerUserId: text('caretaker_user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  specialization: text('specialization').notNull().default('Caregiver'),
  shiftNotes: text('shift_notes').notNull().default(''),
  accessStatus: text('access_status').notNull().default('active'),
  receiveEmailAlerts: boolean('receive_email_alerts').notNull().default(true),
  connectedAt: timestamp('connected_at', { withTimezone: true }).defaultNow().notNull(),
});

// 5. Medications
export const medications = pgTable('medications', {
  medicationId: text('medication_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  medicineName: text('medicine_name').notNull(),
  dosage: text('dosage').notNull(),
  instructions: text('instructions').notNull().default(''),
  foodInstruction: text('food_instruction').notNull().default('anytime'),
  frequency: text('frequency').notNull().default('daily'),
  timings: jsonb('timings').$type<string[]>().notNull().default([]),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull().default(''),
  prescribedBy: text('prescribed_by').notNull().default(''),
  isActive: boolean('is_active').notNull().default(true),
  createdByUserId: text('created_by_user_id')
    .references(() => users.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 6. Medication_Logs
export const medicationLogs = pgTable('medication_logs', {
  logId: text('log_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  medicationId: text('medication_id')
    .references(() => medications.medicationId, { onDelete: 'cascade' })
    .notNull(),
  medicationName: text('medication_name').notNull(),
  dosage: text('dosage').notNull(),
  scheduledDate: text('scheduled_date').notNull(),
  scheduledTime: text('scheduled_time').notNull(),
  status: text('status').notNull(), // 'taken' | 'missed' | 'skipped'
  notes: text('notes').notNull().default(''),
  recordedByUserId: text('recorded_by_user_id').notNull(),
  recordedByName: text('recorded_by_name').notNull(),
  recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
});

// 7. Appointments
export const appointments = pgTable('appointments', {
  appointmentId: text('appointment_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  doctorName: text('doctor_name').notNull(),
  specialty: text('specialty').notNull().default('General Practice'),
  hospitalName: text('hospital_name').notNull(),
  appointmentDate: text('appointment_date').notNull(),
  appointmentTime: text('appointment_time').notNull(),
  purpose: text('purpose').notNull(),
  doctorPhone: text('doctor_phone').notNull().default(''),
  doctorEmail: text('doctor_email').notNull().default(''),
  status: text('status').notNull().default('upcoming'), // 'upcoming' | 'completed' | 'cancelled'
  reminderSent: boolean('reminder_sent').notNull().default(false),
  notes: text('notes').notNull().default(''),
  createdByUserId: text('created_by_user_id')
    .references(() => users.userId, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// 8. Notifications
export const notifications = pgTable('notifications', {
  notificationId: text('notification_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  notificationType: text('notification_type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  severity: text('severity').notNull().default('info'),
  readStatus: boolean('read_status').notNull().default(false),
  emailSent: boolean('email_sent').notNull().default(false),
  emailRecipient: text('email_recipient'),
  dedupeKey: text('dedupe_key').unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// 9. Emergency_Contacts
export const emergencyContacts = pgTable('emergency_contacts', {
  contactId: text('contact_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  contactName: text('contact_name').notNull(),
  relationship: text('relationship').notNull().default('Emergency Contact'),
  phoneNumber: text('phone_number').notNull(),
  email: text('email').notNull().default(''),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Supporting Care Activity Audit Log
export const careActivities = pgTable('care_activities', {
  activityId: text('activity_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  actorUserId: text('actor_user_id').notNull(),
  actorName: text('actor_name').notNull(),
  actorRole: text('actor_role').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Supporting AI Chat History
export const aiChatMessages = pgTable('ai_chat_messages', {
  messageId: text('message_id').primaryKey(),
  elderlyProfileId: text('elderly_profile_id')
    .references(() => elderlyProfiles.profileId, { onDelete: 'cascade' })
    .notNull(),
  userId: text('user_id')
    .references(() => users.userId, { onDelete: 'cascade' })
    .notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  text: text('text').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  ownedProfiles: many(elderlyProfiles),
  familyConnections: many(familyConnections),
  caretakerConnections: many(caretakerConnections),
  notifications: many(notifications),
  aiChatMessages: many(aiChatMessages),
}));

export const elderlyProfilesRelations = relations(elderlyProfiles, ({ one, many }) => ({
  owner: one(users, {
    fields: [elderlyProfiles.userId],
    references: [users.userId],
  }),
  familyConnections: many(familyConnections),
  caretakerConnections: many(caretakerConnections),
  medications: many(medications),
  medicationLogs: many(medicationLogs),
  appointments: many(appointments),
  notifications: many(notifications),
  emergencyContacts: many(emergencyContacts),
  careActivities: many(careActivities),
  aiChatMessages: many(aiChatMessages),
}));

export const familyConnectionsRelations = relations(familyConnections, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [familyConnections.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
  familyUser: one(users, {
    fields: [familyConnections.familyUserId],
    references: [users.userId],
  }),
}));

export const caretakerConnectionsRelations = relations(caretakerConnections, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [caretakerConnections.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
  caretakerUser: one(users, {
    fields: [caretakerConnections.caretakerUserId],
    references: [users.userId],
  }),
}));

export const medicationsRelations = relations(medications, ({ one, many }) => ({
  profile: one(elderlyProfiles, {
    fields: [medications.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
  logs: many(medicationLogs),
}));

export const medicationLogsRelations = relations(medicationLogs, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [medicationLogs.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
  medication: one(medications, {
    fields: [medicationLogs.medicationId],
    references: [medications.medicationId],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [appointments.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [notifications.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
  recipient: one(users, {
    fields: [notifications.userId],
    references: [users.userId],
  }),
}));

export const emergencyContactsRelations = relations(emergencyContacts, ({ one }) => ({
  profile: one(elderlyProfiles, {
    fields: [emergencyContacts.elderlyProfileId],
    references: [elderlyProfiles.profileId],
  }),
}));
