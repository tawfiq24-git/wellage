import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { adminAuth } from '../src/lib/firebase-admin.ts';
import type { UserRecord, UserRole } from './types.ts';

const SESSION_SECRET =
  process.env.ELDERCARE_SESSION_SECRET ||
  'eldercare-360-dev-session-secret-replace-in-production';

export interface SessionPayload {
  userId: string;
  role: UserRole;
  email: string;
  exp: number;
}

export interface AuthenticatedRequest extends Request {
  authUser?: UserRecord;
  firebaseToken?: DecodedIdToken;
}

export function hashSecret(plain: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plain, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifySecret(plain: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  if (!salt || !keyHex) return false;
  const keyBuf = Buffer.from(keyHex, 'hex');
  const derivedBuf = crypto.scryptSync(plain, salt, 64);
  if (keyBuf.length !== derivedBuf.length) return false;
  return crypto.timingSafeEqual(keyBuf, derivedBuf);
}

export function signSessionToken(user: UserRecord): string {
  const payload: SessionPayload = {
    userId: user.id,
    role: user.role,
    email: user.email,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');

  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as SessionPayload;
    if (!parsed.userId || !parsed.exp || Date.now() > parsed.exp) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function generateSixDigitPasscode(): string {
  const num = crypto.randomInt(100000, 999999);
  return String(num);
}

export function generateInviteToken(): string {
  return crypto.randomBytes(18).toString('base64url');
}

export function sanitizeUser(user: UserRecord) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    avatarUrl: user.avatarUrl || null,
    createdAt: user.createdAt,
  };
}

export function createAuthMiddleware(deps: {
  getUserById: (id: string) => Promise<UserRecord | undefined>;
  getUserByFirebaseUid: (uid: string) => Promise<UserRecord | undefined>;
  ensureSeeded?: () => Promise<void>;
}) {
  return async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) {
    const authHeader = req.headers.authorization;
    const token =
      authHeader && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : null;

    if (!token) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    try {
      if (deps.ensureSeeded) {
        await deps.ensureSeeded();
      }

      // Firebase ID Tokens are 3-segment JWTs
      if (token.split('.').length === 3) {
        const decoded = await adminAuth.verifyIdToken(token);
        req.firebaseToken = decoded;
        const fbUser =
          (await deps.getUserByFirebaseUid(decoded.uid)) ||
          (await deps.getUserById(decoded.uid));

        if (!fbUser) {
          res.status(401).json({
            error: 'Account setup incomplete. Please sign in again.',
          });
          return;
        }
        req.authUser = fbUser;
        next();
        return;
      }

      const payload = verifySessionToken(token);
      if (!payload) {
        res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
        return;
      }

      const user = await deps.getUserById(payload.userId);
      if (!user) {
        res.status(401).json({ error: 'User account not found.' });
        return;
      }

      req.authUser = user;
      next();
    } catch (error) {
      console.error('Authentication verification failed:', error);
      res.status(401).json({ error: 'Unauthorized: Invalid or expired token.' });
    }
  };
}
