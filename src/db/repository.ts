import crypto from 'node:crypto';
import { and, desc, eq, inArray, or } from 'drizzle-orm';
import {
  generateInviteToken,
  generateSixDigitPasscode,
  hashSecret,
  verifySecret,
} from '../../server/auth.ts';
import type {
  AiChatMessageRecord,
  AppointmentRecord,
  CareActivityRecord,
  DoseStatus,
  ElderlyProfileRecord,
  EmergencyContactRecord,
  FoodInstruction,
  MedicationFrequency,
  MedicationLogRecord,
  MedicationRecord,
  NotificationRecord,
  NotificationType,
  UserRecord,
  UserRole,
} from '../../server/types.ts';
import { db } from './index.ts';
import {
  aiChatMessages,
  appointments,
  careActivities,
  caretakerConnections,
  elderlyProfiles,
  emergencyContacts,
  familyConnections,
  medicationLogs,
  medications,
  notifications,
  users,
} from './schema.ts';

function wrapDbError(context: string, error: unknown): Error {
  console.error(`[WellAge DB] ${context}:`, error);
  return new Error('Database operation failed. Please try again shortly.', {
    cause: error,
  });
}

function toUserRecord(row: typeof users.$inferSelect): UserRecord {
  return {
    id: row.userId,
    name: row.fullName,
    email: row.email,
    phone: row.phone,
    role: row.role as UserRole,
    passwordHash: row.passwordHash,
    avatarUrl: row.avatarUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toProfileRecord(row: typeof elderlyProfiles.$inferSelect): ElderlyProfileRecord {
  return {
    id: row.profileId,
    ownerUserId: row.userId,
    fullName: row.fullName,
    age: row.age,
    bloodGroup: row.bloodGroup,
    allergies: Array.isArray(row.allergies) ? row.allergies : [],
    primaryConditions: Array.isArray(row.primaryConditions) ? row.primaryConditions : [],
    physicianName: row.physicianName,
    physicianPhone: row.physicianPhone,
    passcodePlain: row.passcodePlain,
    passcodeHash: row.passcodeHash,
    qrInviteToken: row.qrInviteToken,
    avatarUrl: row.avatarUrl ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMedicationRecord(row: typeof medications.$inferSelect): MedicationRecord {
  return {
    id: row.medicationId,
    elderlyProfileId: row.elderlyProfileId,
    name: row.medicineName,
    dosage: row.dosage,
    instructions: row.instructions,
    foodInstruction: row.foodInstruction as FoodInstruction,
    frequency: row.frequency as MedicationFrequency,
    timings: Array.isArray(row.timings) ? row.timings : [],
    startDate: row.startDate,
    endDate: row.endDate,
    prescribedBy: row.prescribedBy,
    isActive: row.isActive,
    createdByUserId: row.createdByUserId || '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toMedicationLogRecord(row: typeof medicationLogs.$inferSelect): MedicationLogRecord {
  return {
    id: row.logId,
    elderlyProfileId: row.elderlyProfileId,
    medicationId: row.medicationId,
    medicationName: row.medicationName,
    dosage: row.dosage,
    scheduledDate: row.scheduledDate,
    scheduledTime: row.scheduledTime,
    status: row.status as DoseStatus,
    notes: row.notes,
    recordedByUserId: row.recordedByUserId,
    recordedByName: row.recordedByName,
    recordedAt: row.recordedAt.toISOString(),
  };
}

function toAppointmentRecord(row: typeof appointments.$inferSelect): AppointmentRecord {
  return {
    id: row.appointmentId,
    elderlyProfileId: row.elderlyProfileId,
    doctorName: row.doctorName,
    specialty: row.specialty,
    clinicName: row.hospitalName,
    date: row.appointmentDate,
    time: row.appointmentTime,
    purpose: row.purpose,
    doctorPhone: row.doctorPhone,
    doctorEmail: row.doctorEmail,
    status: row.status as 'upcoming' | 'completed' | 'cancelled',
    reminderSent: row.reminderSent,
    notes: row.notes,
    createdByUserId: row.createdByUserId || '',
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toNotificationRecord(row: typeof notifications.$inferSelect): NotificationRecord {
  return {
    id: row.notificationId,
    elderlyProfileId: row.elderlyProfileId,
    recipientUserId: row.userId,
    type: row.notificationType as NotificationType,
    title: row.title,
    message: row.message,
    severity: row.severity as 'info' | 'warning' | 'critical',
    read: row.readStatus,
    emailSent: row.emailSent,
    emailRecipient: row.emailRecipient ?? undefined,
    dedupeKey: row.dedupeKey ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

function toEmergencyContactRecord(
  row: typeof emergencyContacts.$inferSelect,
): EmergencyContactRecord {
  return {
    id: row.contactId,
    elderlyProfileId: row.elderlyProfileId,
    name: row.contactName,
    relationship: row.relationship,
    phone: row.phoneNumber,
    email: row.email,
    isPrimary: row.isPrimary,
    createdAt: row.createdAt.toISOString(),
  };
}

function toCareActivityRecord(row: typeof careActivities.$inferSelect): CareActivityRecord {
  return {
    id: row.activityId,
    elderlyProfileId: row.elderlyProfileId,
    actorUserId: row.actorUserId,
    actorName: row.actorName,
    actorRole: row.actorRole as UserRole,
    action: row.action,
    details: row.details,
    createdAt: row.createdAt.toISOString(),
  };
}

function toAiChatMessageRecord(row: typeof aiChatMessages.$inferSelect): AiChatMessageRecord {
  return {
    id: row.messageId,
    elderlyProfileId: row.elderlyProfileId,
    userId: row.userId,
    role: row.role as 'user' | 'assistant',
    text: row.text,
    createdAt: row.createdAt.toISOString(),
  };
}

export const dbRepo = {
  async getUserById(userId: string): Promise<UserRecord | undefined> {
    try {
      const rows = await db.select().from(users).where(eq(users.userId, userId)).limit(1);
      return rows[0] ? toUserRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getUserById', error);
    }
  },

  async getUserByFirebaseUid(firebaseUid: string): Promise<UserRecord | undefined> {
    try {
      const rows = await db
        .select()
        .from(users)
        .where(eq(users.firebaseUid, firebaseUid))
        .limit(1);
      return rows[0] ? toUserRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getUserByFirebaseUid', error);
    }
  },

  async getUserByEmail(email: string): Promise<UserRecord | undefined> {
    try {
      const normalized = email.trim().toLowerCase();
      const rows = await db.select().from(users).where(eq(users.email, normalized)).limit(1);
      return rows[0] ? toUserRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getUserByEmail', error);
    }
  },

  async upsertFirebaseUser(params: {
    firebaseUid: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    requestedRole?: UserRole;
    passcode?: string;
    relationship?: string;
    specialization?: string;
  }): Promise<UserRecord> {
    try {
      const normalizedEmail = params.email.trim().toLowerCase();
      const existingByUidOrEmail = await db
        .select()
        .from(users)
        .where(
          or(
            eq(users.firebaseUid, params.firebaseUid),
            eq(users.email, normalizedEmail),
          ),
        )
        .limit(1);

      if (existingByUidOrEmail[0]) {
        const existing = existingByUidOrEmail[0];
        const [updated] = await db
          .update(users)
          .set({
            firebaseUid: params.firebaseUid,
            email: normalizedEmail,
            fullName: params.name.trim() || existing.fullName,
            avatarUrl: params.avatarUrl ?? existing.avatarUrl,
          })
          .where(eq(users.userId, existing.userId))
          .returning();
        return toUserRecord(updated);
      }

      const role: UserRole = params.requestedRole || 'elderly';

      return await db.transaction(async (tx) => {
        // If family or caretaker supplied a passcode during first sign-in, validate first
        let targetProfile: typeof elderlyProfiles.$inferSelect | undefined;
        if ((role === 'family' || role === 'caretaker') && params.passcode) {
          const allProfiles = await tx.select().from(elderlyProfiles);
          const cleanCode = params.passcode.trim();
          targetProfile = allProfiles.find((p) => verifySecret(cleanCode, p.passcodeHash));
          if (!targetProfile) {
            throw new Error('INVALID_PASSCODE');
          }
        }

        const [inserted] = await tx
          .insert(users)
          .values({
            userId: params.firebaseUid,
            firebaseUid: params.firebaseUid,
            fullName: params.name.trim() || normalizedEmail.split('@')[0],
            email: normalizedEmail,
            phone: '',
            passwordHash: '',
            role,
            avatarUrl: params.avatarUrl ?? null,
          })
          .onConflictDoUpdate({
            target: users.firebaseUid,
            set: {
              email: normalizedEmail,
              fullName: params.name.trim() || normalizedEmail.split('@')[0],
              avatarUrl: params.avatarUrl ?? null,
            },
          })
          .returning();

        if (role === 'elderly') {
          const code = generateSixDigitPasscode();
          await tx
            .insert(elderlyProfiles)
            .values({
              profileId: `profile_${crypto.randomUUID().slice(0, 8)}`,
              userId: inserted.userId,
              fullName: inserted.fullName,
              age: 70,
              bloodGroup: 'O+',
              allergies: [],
              primaryConditions: [],
              physicianName: 'Primary Care Physician',
              physicianPhone: '',
              passcodePlain: code,
              passcodeHash: hashSecret(code),
              qrInviteToken: `ec360_${generateInviteToken()}`,
              avatarUrl: inserted.avatarUrl,
            })
            .onConflictDoNothing();
        } else if (targetProfile) {
          if (role === 'family') {
            await tx.insert(familyConnections).values({
              connectionId: `fam_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: targetProfile.profileId,
              familyUserId: inserted.userId,
              relationship: params.relationship?.trim() || 'Family Member',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          } else {
            await tx.insert(caretakerConnections).values({
              connectionId: `care_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: targetProfile.profileId,
              caretakerUserId: inserted.userId,
              specialization: params.specialization?.trim() || 'Caregiver',
              shiftNotes: '',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          }

          await tx.insert(careActivities).values({
            activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: targetProfile.profileId,
            actorUserId: inserted.userId,
            actorName: inserted.fullName,
            actorRole: role,
            action: 'Joined Care Circle',
            details: `${inserted.fullName} connected as ${role}.`,
          });
        }

        return toUserRecord(inserted);
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PASSCODE') {
        throw error;
      }
      throw wrapDbError('upsertFirebaseUser', error);
    }
  },

  async registerPasswordUser(params: {
    name: string;
    email: string;
    password: string;
    phone?: string;
    role: UserRole;
    age?: number;
    bloodGroup?: string;
    physicianName?: string;
    physicianPhone?: string;
    passcode?: string;
    relationship?: string;
    specialization?: string;
  }): Promise<UserRecord> {
    try {
      const normalizedEmail = params.email.trim().toLowerCase();
      return await db.transaction(async (tx) => {
        let targetProfile: typeof elderlyProfiles.$inferSelect | undefined;
        if ((params.role === 'family' || params.role === 'caretaker') && params.passcode) {
          const allProfiles = await tx.select().from(elderlyProfiles);
          const cleanCode = params.passcode.trim();
          targetProfile = allProfiles.find((p) => verifySecret(cleanCode, p.passcodeHash));
          if (!targetProfile) {
            throw new Error('INVALID_PASSCODE');
          }
        }

        const [newUser] = await tx
          .insert(users)
          .values({
            userId: `user_${crypto.randomUUID().slice(0, 8)}`,
            firebaseUid: null,
            fullName: params.name.trim(),
            email: normalizedEmail,
            phone: params.phone?.trim() || '',
            role: params.role,
            passwordHash: hashSecret(params.password),
          })
          .returning();

        if (params.role === 'elderly') {
          const code = generateSixDigitPasscode();
          await tx.insert(elderlyProfiles).values({
            profileId: `profile_${crypto.randomUUID().slice(0, 8)}`,
            userId: newUser.userId,
            fullName: newUser.fullName,
            age: Number(params.age) > 0 ? Number(params.age) : 70,
            bloodGroup: params.bloodGroup?.trim() || 'O+',
            allergies: [],
            primaryConditions: [],
            physicianName: params.physicianName?.trim() || 'Primary Care Physician',
            physicianPhone: params.physicianPhone?.trim() || '',
            passcodePlain: code,
            passcodeHash: hashSecret(code),
            qrInviteToken: `ec360_${generateInviteToken()}`,
          });
        } else if (targetProfile) {
          if (params.role === 'family') {
            await tx.insert(familyConnections).values({
              connectionId: `fam_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: targetProfile.profileId,
              familyUserId: newUser.userId,
              relationship: params.relationship?.trim() || 'Family Member',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          } else {
            await tx.insert(caretakerConnections).values({
              connectionId: `care_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: targetProfile.profileId,
              caretakerUserId: newUser.userId,
              specialization: params.specialization?.trim() || 'Caregiver',
              shiftNotes: '',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          }

          await tx.insert(careActivities).values({
            activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: targetProfile.profileId,
            actorUserId: newUser.userId,
            actorName: newUser.fullName,
            actorRole: params.role,
            action: 'Joined Care Circle',
            details: `${newUser.fullName} connected as ${params.role}.`,
          });
        }

        return toUserRecord(newUser);
      });
    } catch (error) {
      if (error instanceof Error && error.message === 'INVALID_PASSCODE') {
        throw error;
      }
      throw wrapDbError('registerPasswordUser', error);
    }
  },

  async getAllProfiles(): Promise<ElderlyProfileRecord[]> {
    try {
      const rows = await db.select().from(elderlyProfiles);
      return rows.map(toProfileRecord);
    } catch (error) {
      throw wrapDbError('getAllProfiles', error);
    }
  },

  async getProfileById(profileId: string): Promise<ElderlyProfileRecord | undefined> {
    try {
      const rows = await db
        .select()
        .from(elderlyProfiles)
        .where(eq(elderlyProfiles.profileId, profileId))
        .limit(1);
      return rows[0] ? toProfileRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getProfileById', error);
    }
  },

  async getAccessibleProfilesForUser(user: UserRecord): Promise<ElderlyProfileRecord[]> {
    try {
      if (user.role === 'elderly') {
        const rows = await db
          .select()
          .from(elderlyProfiles)
          .where(eq(elderlyProfiles.userId, user.id));
        return rows.map(toProfileRecord);
      }

      if (user.role === 'family') {
        const rows = await db
          .select({ profile: elderlyProfiles })
          .from(elderlyProfiles)
          .innerJoin(
            familyConnections,
            eq(familyConnections.elderlyProfileId, elderlyProfiles.profileId),
          )
          .where(
            and(
              eq(familyConnections.familyUserId, user.id),
              eq(familyConnections.accessStatus, 'active'),
            ),
          );
        return rows.map((r) => toProfileRecord(r.profile));
      }

      if (user.role === 'caretaker') {
        const rows = await db
          .select({ profile: elderlyProfiles })
          .from(elderlyProfiles)
          .innerJoin(
            caretakerConnections,
            eq(caretakerConnections.elderlyProfileId, elderlyProfiles.profileId),
          )
          .where(
            and(
              eq(caretakerConnections.caretakerUserId, user.id),
              eq(caretakerConnections.accessStatus, 'active'),
            ),
          );
        return rows.map((r) => toProfileRecord(r.profile));
      }

      return [];
    } catch (error) {
      throw wrapDbError('getAccessibleProfilesForUser', error);
    }
  },

  async userHasProfileAccess(user: UserRecord, profileId: string): Promise<boolean> {
    const profiles = await this.getAccessibleProfilesForUser(user);
    return profiles.some((p) => p.id === profileId);
  },

  async connectUserToProfile(params: {
    user: UserRecord;
    passcode?: string;
    qrToken?: string;
    relationship?: string;
    specialization?: string;
  }): Promise<ElderlyProfileRecord | null> {
    try {
      let matched: typeof elderlyProfiles.$inferSelect | undefined;
      if (params.qrToken) {
        const rows = await db
          .select()
          .from(elderlyProfiles)
          .where(eq(elderlyProfiles.qrInviteToken, params.qrToken.trim()))
          .limit(1);
        matched = rows[0];
      } else if (params.passcode) {
        const allProfiles = await db.select().from(elderlyProfiles);
        const cleanCode = params.passcode.trim();
        matched = allProfiles.find((p) => verifySecret(cleanCode, p.passcodeHash));
      }

      if (!matched) return null;

      await db.transaction(async (tx) => {
        if (params.user.role === 'family') {
          const existing = await tx
            .select()
            .from(familyConnections)
            .where(
              and(
                eq(familyConnections.elderlyProfileId, matched!.profileId),
                eq(familyConnections.familyUserId, params.user.id),
              ),
            )
            .limit(1);

          if (!existing[0]) {
            await tx.insert(familyConnections).values({
              connectionId: `fam_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: matched!.profileId,
              familyUserId: params.user.id,
              relationship: params.relationship?.trim() || 'Family Member',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          }
        } else if (params.user.role === 'caretaker') {
          const existing = await tx
            .select()
            .from(caretakerConnections)
            .where(
              and(
                eq(caretakerConnections.elderlyProfileId, matched!.profileId),
                eq(caretakerConnections.caretakerUserId, params.user.id),
              ),
            )
            .limit(1);

          if (!existing[0]) {
            await tx.insert(caretakerConnections).values({
              connectionId: `care_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: matched!.profileId,
              caretakerUserId: params.user.id,
              specialization: params.specialization?.trim() || 'Caregiver',
              shiftNotes: '',
              accessStatus: 'active',
              receiveEmailAlerts: true,
            });
          }
        }

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: matched!.profileId,
          actorUserId: params.user.id,
          actorName: params.user.name,
          actorRole: params.user.role,
          action: 'Connected to Care Profile',
          details: `${params.user.name} (${params.user.role}) joined via secure passcode/QR authorization.`,
        });
      });

      return toProfileRecord(matched);
    } catch (error) {
      throw wrapDbError('connectUserToProfile', error);
    }
  },

  async rotatePasscode(params: {
    profileId: string;
    actor: UserRecord;
  }): Promise<{ passcode: string; qrInviteToken: string }> {
    try {
      const newPasscode = generateSixDigitPasscode();
      const newToken = `ec360_${generateInviteToken()}`;

      await db.transaction(async (tx) => {
        await tx
          .update(elderlyProfiles)
          .set({
            passcodePlain: newPasscode,
            passcodeHash: hashSecret(newPasscode),
            qrInviteToken: newToken,
            updatedAt: new Date(),
          })
          .where(eq(elderlyProfiles.profileId, params.profileId));

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: 'Rotated Access Passcode & QR Token',
          details: 'Generated a fresh 6-digit passcode and QR invitation token.',
        });
      });

      return { passcode: newPasscode, qrInviteToken: newToken };
    } catch (error) {
      throw wrapDbError('rotatePasscode', error);
    }
  },

  async getCareCircleDetails(profileId: string) {
    try {
      const profileRow = await db
        .select()
        .from(elderlyProfiles)
        .where(eq(elderlyProfiles.profileId, profileId))
        .limit(1);
      const profile = profileRow[0];
      if (!profile) return null;

      const ownerRow = await db
        .select()
        .from(users)
        .where(eq(users.userId, profile.userId))
        .limit(1);

      const familyRows = await db
        .select({ conn: familyConnections, user: users })
        .from(familyConnections)
        .innerJoin(users, eq(familyConnections.familyUserId, users.userId))
        .where(eq(familyConnections.elderlyProfileId, profileId));

      const caretakerRows = await db
        .select({ conn: caretakerConnections, user: users })
        .from(caretakerConnections)
        .innerJoin(users, eq(caretakerConnections.caretakerUserId, users.userId))
        .where(eq(caretakerConnections.elderlyProfileId, profileId));

      const activityRows = await db
        .select()
        .from(careActivities)
        .where(eq(careActivities.elderlyProfileId, profileId))
        .orderBy(desc(careActivities.createdAt))
        .limit(30);

      return {
        owner: ownerRow[0] ? toUserRecord(ownerRow[0]) : null,
        family: familyRows.map(({ conn, user }) => ({
          connectionId: conn.connectionId,
          userId: conn.familyUserId,
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          relationship: conn.relationship,
          receiveEmailAlerts: conn.receiveEmailAlerts,
          connectedAt: conn.connectedAt.toISOString(),
        })),
        caretakers: caretakerRows.map(({ conn, user }) => ({
          connectionId: conn.connectionId,
          userId: conn.caretakerUserId,
          name: user.fullName,
          email: user.email,
          phone: user.phone,
          avatarUrl: user.avatarUrl ?? null,
          specialization: conn.specialization,
          shiftNotes: conn.shiftNotes,
          receiveEmailAlerts: conn.receiveEmailAlerts,
          connectedAt: conn.connectedAt.toISOString(),
        })),
        activities: activityRows.map(toCareActivityRecord),
      };
    } catch (error) {
      throw wrapDbError('getCareCircleDetails', error);
    }
  },

  async getAuthorizedCareCircleRecipients(profileId: string): Promise<UserRecord[]> {
    try {
      const profileRows = await db
        .select()
        .from(elderlyProfiles)
        .where(eq(elderlyProfiles.profileId, profileId))
        .limit(1);
      if (!profileRows[0]) return [];

      const famRows = await db
        .select()
        .from(familyConnections)
        .where(eq(familyConnections.elderlyProfileId, profileId));
      const careRows = await db
        .select()
        .from(caretakerConnections)
        .where(eq(caretakerConnections.elderlyProfileId, profileId));

      const ids = Array.from(
        new Set([
          profileRows[0].userId,
          ...famRows.map((f) => f.familyUserId),
          ...careRows.map((c) => c.caretakerUserId),
        ]),
      );

      if (ids.length === 0) return [];
      const userRows = await db.select().from(users).where(inArray(users.userId, ids));
      return userRows.map(toUserRecord);
    } catch (error) {
      throw wrapDbError('getAuthorizedCareCircleRecipients', error);
    }
  },

  // ---------------- MEDICATIONS & LOGS ----------------

  async getMedications(profileId: string): Promise<MedicationRecord[]> {
    try {
      const rows = await db
        .select()
        .from(medications)
        .where(eq(medications.elderlyProfileId, profileId));
      return rows.map(toMedicationRecord);
    } catch (error) {
      throw wrapDbError('getMedications', error);
    }
  },

  async getMedicationById(
    profileId: string,
    medId: string,
  ): Promise<MedicationRecord | undefined> {
    try {
      const rows = await db
        .select()
        .from(medications)
        .where(
          and(
            eq(medications.medicationId, medId),
            eq(medications.elderlyProfileId, profileId),
          ),
        )
        .limit(1);
      return rows[0] ? toMedicationRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getMedicationById', error);
    }
  },

  async createMedication(params: {
    profileId: string;
    actor: UserRecord;
    name: string;
    dosage: string;
    instructions: string;
    foodInstruction: FoodInstruction;
    frequency: MedicationFrequency;
    timings: string[];
    startDate: string;
    endDate: string;
    prescribedBy: string;
  }): Promise<MedicationRecord> {
    try {
      const now = new Date();
      const medId = `med_${crypto.randomUUID().slice(0, 8)}`;

      const created = await db.transaction(async (tx) => {
        const [row] = await tx
          .insert(medications)
          .values({
            medicationId: medId,
            elderlyProfileId: params.profileId,
            medicineName: params.name,
            dosage: params.dosage,
            instructions: params.instructions,
            foodInstruction: params.foodInstruction,
            frequency: params.frequency,
            timings: params.timings,
            startDate: params.startDate,
            endDate: params.endDate,
            prescribedBy: params.prescribedBy,
            isActive: true,
            createdByUserId: params.actor.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: `Added Medication: ${row.medicineName} (${row.dosage})`,
          details: `Scheduled at ${params.timings.join(', ')} (${params.foodInstruction.replace('_', ' ')}).`,
        });

        return row;
      });

      return toMedicationRecord(created);
    } catch (error) {
      throw wrapDbError('createMedication', error);
    }
  },

  async updateMedication(params: {
    profileId: string;
    medId: string;
    actor: UserRecord;
    patch: Partial<{
      name: string;
      dosage: string;
      instructions: string;
      foodInstruction: FoodInstruction;
      frequency: MedicationFrequency;
      timings: string[];
      startDate: string;
      endDate: string;
      prescribedBy: string;
      isActive: boolean;
    }>;
  }): Promise<MedicationRecord | null> {
    try {
      const updated = await db.transaction(async (tx) => {
        const existingRows = await tx
          .select()
          .from(medications)
          .where(
            and(
              eq(medications.medicationId, params.medId),
              eq(medications.elderlyProfileId, params.profileId),
            ),
          )
          .limit(1);

        if (!existingRows[0]) return null;
        const current = existingRows[0];

        const [row] = await tx
          .update(medications)
          .set({
            medicineName: params.patch.name ?? current.medicineName,
            dosage: params.patch.dosage ?? current.dosage,
            instructions: params.patch.instructions ?? current.instructions,
            foodInstruction: params.patch.foodInstruction ?? current.foodInstruction,
            frequency: params.patch.frequency ?? current.frequency,
            timings: params.patch.timings ?? current.timings,
            startDate: params.patch.startDate ?? current.startDate,
            endDate: params.patch.endDate ?? current.endDate,
            prescribedBy: params.patch.prescribedBy ?? current.prescribedBy,
            isActive:
              params.patch.isActive !== undefined ? params.patch.isActive : current.isActive,
            updatedAt: new Date(),
          })
          .where(eq(medications.medicationId, params.medId))
          .returning();

        const timingsList = Array.isArray(row.timings) ? row.timings : [];
        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: `Updated Medication: ${row.medicineName}`,
          details: `Dosage ${row.dosage} · Timings: ${timingsList.join(', ')}`,
        });

        return row;
      });

      return updated ? toMedicationRecord(updated) : null;
    } catch (error) {
      throw wrapDbError('updateMedication', error);
    }
  },

  async deleteMedication(params: {
    profileId: string;
    medId: string;
    actor: UserRecord;
  }): Promise<string | null> {
    try {
      return await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(medications)
          .where(
            and(
              eq(medications.medicationId, params.medId),
              eq(medications.elderlyProfileId, params.profileId),
            ),
          )
          .returning();

        if (!deleted[0]) return null;

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: `Removed Medication: ${deleted[0].medicineName}`,
          details: `${deleted[0].medicineName} (${deleted[0].dosage}) was removed from active schedules.`,
        });

        return deleted[0].medicationId;
      });
    } catch (error) {
      throw wrapDbError('deleteMedication', error);
    }
  },

  async getMedicationLogs(profileId: string, limit?: number): Promise<MedicationLogRecord[]> {
    try {
      const baseQuery = db
        .select()
        .from(medicationLogs)
        .where(eq(medicationLogs.elderlyProfileId, profileId))
        .orderBy(desc(medicationLogs.recordedAt));

      const rows = limit ? await baseQuery.limit(limit) : await baseQuery;
      return rows.map(toMedicationLogRecord);
    } catch (error) {
      throw wrapDbError('getMedicationLogs', error);
    }
  },

  async upsertMedicationLog(params: {
    profileId: string;
    med: MedicationRecord;
    scheduledDate: string;
    scheduledTime: string;
    status: DoseStatus;
    notes?: string;
    actorId: string;
    actorName: string;
    actorRole?: UserRole;
    recordActivity?: boolean;
  }): Promise<MedicationLogRecord> {
    try {
      const row = await db.transaction(async (tx) => {
        const existingRows = await tx
          .select()
          .from(medicationLogs)
          .where(
            and(
              eq(medicationLogs.elderlyProfileId, params.profileId),
              eq(medicationLogs.medicationId, params.med.id),
              eq(medicationLogs.scheduledDate, params.scheduledDate),
              eq(medicationLogs.scheduledTime, params.scheduledTime),
            ),
          )
          .limit(1);

        const now = new Date();
        let savedRow: typeof medicationLogs.$inferSelect;
        if (existingRows[0]) {
          const [updated] = await tx
            .update(medicationLogs)
            .set({
              status: params.status,
              notes:
                typeof params.notes === 'string'
                  ? params.notes.trim()
                  : existingRows[0].notes,
              recordedByUserId: params.actorId,
              recordedByName: params.actorName,
              recordedAt: now,
            })
            .where(eq(medicationLogs.logId, existingRows[0].logId))
            .returning();
          savedRow = updated;
        } else {
          const [inserted] = await tx
            .insert(medicationLogs)
            .values({
              logId: `log_${crypto.randomUUID().slice(0, 8)}`,
              elderlyProfileId: params.profileId,
              medicationId: params.med.id,
              medicationName: params.med.name,
              dosage: params.med.dosage,
              scheduledDate: params.scheduledDate,
              scheduledTime: params.scheduledTime,
              status: params.status,
              notes: typeof params.notes === 'string' ? params.notes.trim() : '',
              recordedByUserId: params.actorId,
              recordedByName: params.actorName,
              recordedAt: now,
            })
            .returning();
          savedRow = inserted;
        }

        if (params.recordActivity && params.actorRole) {
          await tx.insert(careActivities).values({
            activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            actorUserId: params.actorId,
            actorName: params.actorName,
            actorRole: params.actorRole,
            action: `Marked ${params.med.name} (${params.scheduledTime}) as ${params.status.toUpperCase()}`,
            details: savedRow.notes || `Recorded by ${params.actorName}.`,
          });
        }

        return savedRow;
      });

      return toMedicationLogRecord(row);
    } catch (error) {
      throw wrapDbError('upsertMedicationLog', error);
    }
  },

  // ---------------- APPOINTMENTS ----------------

  async getAppointments(profileId: string): Promise<AppointmentRecord[]> {
    try {
      const rows = await db
        .select()
        .from(appointments)
        .where(eq(appointments.elderlyProfileId, profileId));
      return rows
        .map(toAppointmentRecord)
        .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
    } catch (error) {
      throw wrapDbError('getAppointments', error);
    }
  },

  async getAppointmentById(
    profileId: string,
    apptId: string,
  ): Promise<AppointmentRecord | undefined> {
    try {
      const rows = await db
        .select()
        .from(appointments)
        .where(
          and(
            eq(appointments.appointmentId, apptId),
            eq(appointments.elderlyProfileId, profileId),
          ),
        )
        .limit(1);
      return rows[0] ? toAppointmentRecord(rows[0]) : undefined;
    } catch (error) {
      throw wrapDbError('getAppointmentById', error);
    }
  },

  async createAppointment(params: {
    profileId: string;
    actor: UserRecord;
    doctorName: string;
    specialty: string;
    clinicName: string;
    date: string;
    time: string;
    purpose: string;
    doctorPhone: string;
    doctorEmail: string;
    notes: string;
  }): Promise<AppointmentRecord> {
    try {
      const now = new Date();
      const row = await db.transaction(async (tx) => {
        const [inserted] = await tx
          .insert(appointments)
          .values({
            appointmentId: `appt_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            doctorName: params.doctorName,
            specialty: params.specialty,
            hospitalName: params.clinicName,
            appointmentDate: params.date,
            appointmentTime: params.time,
            purpose: params.purpose,
            doctorPhone: params.doctorPhone,
            doctorEmail: params.doctorEmail,
            status: 'upcoming',
            reminderSent: false,
            notes: params.notes,
            createdByUserId: params.actor.id,
            createdAt: now,
            updatedAt: now,
          })
          .returning();

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: `Scheduled Appointment with ${inserted.doctorName}`,
          details: `${inserted.appointmentDate} at ${inserted.appointmentTime} · ${inserted.hospitalName}`,
        });

        return inserted;
      });

      return toAppointmentRecord(row);
    } catch (error) {
      throw wrapDbError('createAppointment', error);
    }
  },

  async updateAppointment(params: {
    profileId: string;
    apptId: string;
    actor?: UserRecord;
    patch: Partial<{
      doctorName: string;
      specialty: string;
      clinicName: string;
      date: string;
      time: string;
      purpose: string;
      doctorPhone: string;
      doctorEmail: string;
      status: 'upcoming' | 'completed' | 'cancelled';
      reminderSent: boolean;
      notes: string;
    }>;
  }): Promise<AppointmentRecord | null> {
    try {
      const row = await db.transaction(async (tx) => {
        const existingRows = await tx
          .select()
          .from(appointments)
          .where(
            and(
              eq(appointments.appointmentId, params.apptId),
              eq(appointments.elderlyProfileId, params.profileId),
            ),
          )
          .limit(1);
        if (!existingRows[0]) return null;
        const current = existingRows[0];

        const [updated] = await tx
          .update(appointments)
          .set({
            doctorName: params.patch.doctorName ?? current.doctorName,
            specialty: params.patch.specialty ?? current.specialty,
            hospitalName: params.patch.clinicName ?? current.hospitalName,
            appointmentDate: params.patch.date ?? current.appointmentDate,
            appointmentTime: params.patch.time ?? current.appointmentTime,
            purpose: params.patch.purpose ?? current.purpose,
            doctorPhone: params.patch.doctorPhone ?? current.doctorPhone,
            doctorEmail: params.patch.doctorEmail ?? current.doctorEmail,
            status: params.patch.status ?? current.status,
            reminderSent:
              params.patch.reminderSent !== undefined
                ? params.patch.reminderSent
                : current.reminderSent,
            notes: params.patch.notes ?? current.notes,
            updatedAt: new Date(),
          })
          .where(eq(appointments.appointmentId, params.apptId))
          .returning();

        if (params.actor) {
          await tx.insert(careActivities).values({
            activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            actorUserId: params.actor.id,
            actorName: params.actor.name,
            actorRole: params.actor.role,
            action: `Updated Appointment: ${updated.doctorName}`,
            details: `${updated.appointmentDate} at ${updated.appointmentTime} · Status: ${updated.status}`,
          });
        }

        return updated;
      });

      return row ? toAppointmentRecord(row) : null;
    } catch (error) {
      throw wrapDbError('updateAppointment', error);
    }
  },

  async deleteAppointment(params: {
    profileId: string;
    apptId: string;
    actor: UserRecord;
  }): Promise<string | null> {
    try {
      return await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(appointments)
          .where(
            and(
              eq(appointments.appointmentId, params.apptId),
              eq(appointments.elderlyProfileId, params.profileId),
            ),
          )
          .returning();

        if (!deleted[0]) return null;

        await tx.insert(careActivities).values({
          activityId: `act_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.profileId,
          actorUserId: params.actor.id,
          actorName: params.actor.name,
          actorRole: params.actor.role,
          action: `Deleted Appointment: ${deleted[0].doctorName}`,
          details: `Removed appointment on ${deleted[0].appointmentDate} at ${deleted[0].appointmentTime}.`,
        });

        return deleted[0].appointmentId;
      });
    } catch (error) {
      throw wrapDbError('deleteAppointment', error);
    }
  },

  // ---------------- EMERGENCY CONTACTS ----------------

  async getEmergencyContacts(profileId: string): Promise<EmergencyContactRecord[]> {
    try {
      const rows = await db
        .select()
        .from(emergencyContacts)
        .where(eq(emergencyContacts.elderlyProfileId, profileId));
      return rows.map(toEmergencyContactRecord);
    } catch (error) {
      throw wrapDbError('getEmergencyContacts', error);
    }
  },

  async createEmergencyContact(params: {
    profileId: string;
    name: string;
    relationship: string;
    phone: string;
    email: string;
    isPrimary: boolean;
  }): Promise<EmergencyContactRecord> {
    try {
      const row = await db.transaction(async (tx) => {
        if (params.isPrimary) {
          await tx
            .update(emergencyContacts)
            .set({ isPrimary: false })
            .where(eq(emergencyContacts.elderlyProfileId, params.profileId));
        }
        const [inserted] = await tx
          .insert(emergencyContacts)
          .values({
            contactId: `ec_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            contactName: params.name,
            relationship: params.relationship,
            phoneNumber: params.phone,
            email: params.email,
            isPrimary: params.isPrimary,
          })
          .returning();
        return inserted;
      });
      return toEmergencyContactRecord(row);
    } catch (error) {
      throw wrapDbError('createEmergencyContact', error);
    }
  },

  async deleteEmergencyContact(
    profileId: string,
    contactId: string,
  ): Promise<string | null> {
    try {
      const deleted = await db
        .delete(emergencyContacts)
        .where(
          and(
            eq(emergencyContacts.contactId, contactId),
            eq(emergencyContacts.elderlyProfileId, profileId),
          ),
        )
        .returning();
      return deleted[0] ? deleted[0].contactId : null;
    } catch (error) {
      throw wrapDbError('deleteEmergencyContact', error);
    }
  },

  // ---------------- NOTIFICATIONS ----------------

  async getNotificationsForUser(
    userId: string,
    accessibleProfileIds: string[],
  ): Promise<NotificationRecord[]> {
    try {
      if (accessibleProfileIds.length === 0) return [];
      const rows = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.userId, userId),
            inArray(notifications.elderlyProfileId, accessibleProfileIds),
          ),
        )
        .orderBy(desc(notifications.createdAt));
      return rows.map(toNotificationRecord);
    } catch (error) {
      throw wrapDbError('getNotificationsForUser', error);
    }
  },

  async notificationDedupeExists(dedupeKey: string): Promise<boolean> {
    try {
      const rows = await db
        .select({ id: notifications.notificationId })
        .from(notifications)
        .where(eq(notifications.dedupeKey, dedupeKey))
        .limit(1);
      return rows.length > 0;
    } catch (error) {
      throw wrapDbError('notificationDedupeExists', error);
    }
  },

  async insertNotification(params: {
    elderlyProfileId: string;
    recipientUserId: string;
    type: NotificationType;
    title: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    emailSent: boolean;
    emailRecipient?: string;
    dedupeKey?: string;
  }): Promise<NotificationRecord | null> {
    try {
      const rows = await db
        .insert(notifications)
        .values({
          notificationId: `notif_${crypto.randomUUID().slice(0, 8)}`,
          elderlyProfileId: params.elderlyProfileId,
          userId: params.recipientUserId,
          notificationType: params.type,
          title: params.title,
          message: params.message,
          severity: params.severity,
          readStatus: false,
          emailSent: params.emailSent,
          emailRecipient: params.emailRecipient ?? null,
          dedupeKey: params.dedupeKey ?? null,
        })
        .onConflictDoNothing()
        .returning();
      return rows[0] ? toNotificationRecord(rows[0]) : null;
    } catch (error) {
      throw wrapDbError('insertNotification', error);
    }
  },

  async markNotificationRead(
    userId: string,
    notifId: string,
  ): Promise<NotificationRecord | null> {
    try {
      const rows = await db
        .update(notifications)
        .set({ readStatus: true })
        .where(
          and(
            eq(notifications.notificationId, notifId),
            eq(notifications.userId, userId),
          ),
        )
        .returning();
      return rows[0] ? toNotificationRecord(rows[0]) : null;
    } catch (error) {
      throw wrapDbError('markNotificationRead', error);
    }
  },

  async markAllNotificationsRead(userId: string): Promise<number> {
    try {
      const rows = await db
        .update(notifications)
        .set({ readStatus: true })
        .where(and(eq(notifications.userId, userId), eq(notifications.readStatus, false)))
        .returning({ id: notifications.notificationId });
      return rows.length;
    } catch (error) {
      throw wrapDbError('markAllNotificationsRead', error);
    }
  },

  // ---------------- AI CHAT HISTORY ----------------

  async getAiChatHistory(
    profileId: string,
    userId: string,
  ): Promise<AiChatMessageRecord[]> {
    try {
      const rows = await db
        .select()
        .from(aiChatMessages)
        .where(
          and(
            eq(aiChatMessages.elderlyProfileId, profileId),
            eq(aiChatMessages.userId, userId),
          ),
        )
        .orderBy(aiChatMessages.createdAt);
      return rows.map(toAiChatMessageRecord);
    } catch (error) {
      throw wrapDbError('getAiChatHistory', error);
    }
  },

  async clearAiChatHistory(profileId: string, userId: string): Promise<void> {
    try {
      await db
        .delete(aiChatMessages)
        .where(
          and(
            eq(aiChatMessages.elderlyProfileId, profileId),
            eq(aiChatMessages.userId, userId),
          ),
        );
    } catch (error) {
      throw wrapDbError('clearAiChatHistory', error);
    }
  },

  async saveAiChatExchange(params: {
    profileId: string;
    userId: string;
    userText: string;
    assistantText: string;
  }): Promise<{
    userMessage: AiChatMessageRecord;
    assistantMessage: AiChatMessageRecord;
  }> {
    try {
      const now = Date.now();
      const [userRow, assistantRow] = await db.transaction(async (tx) => {
        const [u] = await tx
          .insert(aiChatMessages)
          .values({
            messageId: `msg_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            userId: params.userId,
            role: 'user',
            text: params.userText,
            createdAt: new Date(now),
          })
          .returning();

        const [a] = await tx
          .insert(aiChatMessages)
          .values({
            messageId: `msg_${crypto.randomUUID().slice(0, 8)}`,
            elderlyProfileId: params.profileId,
            userId: params.userId,
            role: 'assistant',
            text: params.assistantText,
            createdAt: new Date(now + 1),
          })
          .returning();

        return [u, a];
      });

      return {
        userMessage: toAiChatMessageRecord(userRow),
        assistantMessage: toAiChatMessageRecord(assistantRow),
      };
    } catch (error) {
      throw wrapDbError('saveAiChatExchange', error);
    }
  },
};
