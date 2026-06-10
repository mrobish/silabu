import jwt from 'jsonwebtoken';
import crypto from 'crypto';

export interface AccessTokenPayload {
  userId: string;
  email: string;
  role: string;
  tenantId: string | null;
}

export interface RefreshTokenPayload {
  sessionId: string;
  userId: string;
}

const ACCESS_TOKEN_SECRET = process.env.JWT_SECRET || 'access-token-secret-dev';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'refresh-token-secret-dev';

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_TOKEN_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_TOKEN_SECRET) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_TOKEN_SECRET) as RefreshTokenPayload;
}

export function hashRefreshToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
