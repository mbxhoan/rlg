import crypto from 'node:crypto';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'rlg_workspace_session';
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

function getSessionSecret() {
  return (
    process.env.APP_SESSION_SECRET ??
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    'rlg-session-secret'
  );
}

function getAccessPassword() {
  return process.env.APP_ACCESS_PASSWORD ?? 'rlg-workspace-dev';
}

export function validateAccessPassword(input: string) {
  const actual = getAccessPassword();
  return input.length > 0 && safeEqual(input, actual);
}

export function createSessionToken() {
  const payload = `v1:${Date.now()}`;
  const signature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  return `${Buffer.from(payload).toString('base64url')}.${signature}`;
}

export function isSessionTokenValid(token?: string | null) {
  if (!token) return false;
  const [encodedPayload, signature] = token.split('.');
  if (!encodedPayload || !signature) return false;

  const payload = Buffer.from(encodedPayload, 'base64url').toString('utf8');
  const expectedSignature = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');

  if (!safeEqual(signature, expectedSignature)) {
    return false;
  }

  const [version, issuedAtRaw] = payload.split(':');
  if (version !== 'v1') return false;

  const issuedAt = Number(issuedAtRaw);
  if (!Number.isFinite(issuedAt)) return false;

  const ageMs = Date.now() - issuedAt;
  return ageMs >= 0 && ageMs <= SESSION_MAX_AGE_SECONDS * 1000;
}

export async function getSessionTokenFromCookies() {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function isCurrentRequestAuthenticated() {
  return isSessionTokenValid(await getSessionTokenFromCookies());
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}
