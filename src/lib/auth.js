// Admin sign-in.
//
// One owner password, kept as the ADMIN_PASSWORD secret in Cloudflare
// (never in the repository). A successful sign-in creates a random session
// token; only its hash is stored in D1 and the token itself lives in an
// HttpOnly cookie.

import { getCookie, setCookie, deleteCookie } from 'hono/cookie';

const COOKIE = 'shop_admin';
const SESSION_DAYS = 14;
const MAX_FAILED_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

async function sha256(text) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const cookieOptions = (c) => ({
  path: '/admin',
  httpOnly: true,
  sameSite: 'Strict',
  secure: new URL(c.req.url).protocol === 'https:',
});

export const isConfigured = (env) => typeof env.ADMIN_PASSWORD === 'string' && env.ADMIN_PASSWORD.length >= 8;

export async function isSignedIn(c) {
  const token = getCookie(c, COOKIE);
  if (!token) return false;
  const row = await c.env.DB.prepare('SELECT expires_at FROM sessions WHERE token_hash = ?')
    .bind(await sha256(token))
    .first();
  return Boolean(row && row.expires_at > Date.now());
}

/** Returns { ok } or { ok: false, status, message }. */
export async function signIn(c, password) {
  const db = c.env.DB;
  if (!isConfigured(c.env)) {
    return { ok: false, status: 503, message: 'ADMIN_PASSWORD 시크릿이 아직 설정되지 않았습니다 (8자 이상).' };
  }
  const ip = c.req.header('cf-connecting-ip') ?? 'local';
  const since = Date.now() - ATTEMPT_WINDOW_MS;
  const recent = await db
    .prepare('SELECT COUNT(*) AS n FROM login_attempts WHERE ip = ? AND at > ?')
    .bind(ip, since)
    .first();
  if ((recent?.n ?? 0) >= MAX_FAILED_ATTEMPTS) {
    return { ok: false, status: 429, message: '로그인 시도가 너무 많습니다. 15분 뒤에 다시 시도해 주세요.' };
  }

  const [given, expected] = await Promise.all([sha256(String(password ?? '')), sha256(c.env.ADMIN_PASSWORD)]);
  if (!safeEqual(given, expected)) {
    await db.batch([
      db.prepare('INSERT INTO login_attempts (ip, at) VALUES (?, ?)').bind(ip, Date.now()),
      db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(since),
    ]);
    return { ok: false, status: 401, message: '비밀번호가 올바르지 않습니다.' };
  }

  const token = [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, '0')).join('');
  const expires = Date.now() + SESSION_DAYS * 86_400_000;
  await db.batch([
    db.prepare('INSERT INTO sessions (token_hash, expires_at) VALUES (?, ?)').bind(await sha256(token), expires),
    db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(Date.now()),
    db.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip),
  ]);
  setCookie(c, COOKIE, token, { ...cookieOptions(c), maxAge: SESSION_DAYS * 86_400 });
  return { ok: true };
}

export async function signOut(c) {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
  }
  deleteCookie(c, COOKIE, cookieOptions(c));
}

/** Middleware: signed-in admin only, and state-changing requests must come from this site. */
export async function requireAdmin(c, next) {
  if (!(await isSignedIn(c))) return c.json({ error: '로그인이 필요합니다.' }, 401);
  return next();
}

export async function sameOriginOnly(c, next) {
  if (!['GET', 'HEAD'].includes(c.req.method)) {
    const origin = c.req.header('origin');
    if (origin && origin !== new URL(c.req.url).origin) {
      return c.json({ error: '허용되지 않은 요청입니다.' }, 403);
    }
  }
  return next();
}
