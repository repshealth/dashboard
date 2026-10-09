import type { DocStore } from '../backend/store';
import { meta, type UserRec, type ViewerRec } from '../backend/core';
import { list, setting } from './env';

/**
 * Sign-in with emailed links. No passwords.
 *  - A sign-in link holds a random token. Only its SHA-256 hash is stored, it works once,
 *    and it expires (30 minutes, or 7 days for invites).
 *  - Opening it starts a session: a random value in an HttpOnly cookie, stored hashed.
 *  - REPS admins are the emails in ADMIN_EMAILS. Clients get a login when the team
 *    sends them their website or emails.
 */
export const COOKIE = 'reps_session';
const SESSION_DAYS = 30;

const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const randomToken = () => b64url(crypto.getRandomValues(new Uint8Array(32)));
export async function sha256(s: string) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

interface TokenRec { email: string; expiresAt: string; next?: string }
interface SessionRec { userId: string; expiresAt: string }

export const isAdminEmail = (email: string) => list('ADMIN_EMAILS').includes(email.toLowerCase());

/** Makes a one-time sign-in link for an email address. */
export async function signInLink(store: DocStore, origin: string, email: string, days = 0) {
  const token = randomToken();
  const ms = days ? days * 864e5 : 30 * 60e3;
  await store.put<TokenRec>('token', await sha256(token), { email: email.toLowerCase(), expiresAt: new Date(Date.now() + ms).toISOString() }, { sort: new Date().toISOString() });
  return `${appUrl(origin)}/api/auth/verify?token=${encodeURIComponent(token)}`;
}

/** Uses up a sign-in token and returns the email it was for. */
export async function useToken(store: DocStore, token: string) {
  const id = await sha256(token);
  const t = await store.get<TokenRec>('token', id);
  await store.del('token', id);
  if (!t || Date.parse(t.expiresAt) < Date.now()) return null;
  return t.email;
}

export async function startSession(store: DocStore, userId: string) {
  const value = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  await store.put<SessionRec>('session', await sha256(value), { userId, expiresAt }, { sort: expiresAt });
  return { value, maxAge: SESSION_DAYS * 86400 };
}

export async function endSession(store: DocStore, req: Request) {
  const v = readCookie(req);
  if (v) await store.del('session', await sha256(v));
}

export function readCookie(req: Request) {
  const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : null;
}

export const sessionCookie = (value: string, maxAge: number) =>
  `${COOKIE}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;

/** The signed-in user behind a request, or null. */
export async function viewerFrom(store: DocStore, req: Request): Promise<ViewerRec | null> {
  const v = readCookie(req);
  if (!v) return null;
  const s = await store.get<SessionRec>('session', await sha256(v));
  if (!s || Date.parse(s.expiresAt) < Date.now()) return null;
  const u = await store.get<UserRec>('user', s.userId);
  if (!u) return null;
  return { id: u.id, name: u.name, email: u.email, isAdmin: Boolean(u.isAdmin) || isAdminEmail(u.email) };
}

export async function findOrCreateAdmin(store: DocStore, email: string): Promise<UserRec | null> {
  const e = email.toLowerCase();
  const found = await store.byKey<UserRec>('user', e);
  if (found) return found.doc;
  if (!isAdminEmail(e)) return null;
  const u: UserRec = { id: crypto.randomUUID(), email: e, name: 'REPS team', isAdmin: true, createdAt: new Date().toISOString() };
  await store.put('user', u.id, u, meta.user(u));
  return u;
}

/** The dashboard's address, for links in emails. */
export const appUrl = (origin: string) => (setting('APP_URL') || origin).replace(/\/$/, '');

/**
 * Sends an email through Resend (resend.com). Returns false if email isn't set up,
 * in which case the message is written to the Worker's logs instead.
 */
export async function sendEmail(to: string, subject: string, html: string, text: string) {
  const key = setting('RESEND_API_KEY');
  const from = setting('EMAIL_FROM');
  if (!key || !from) {
    console.log(`[email not sent: RESEND_API_KEY or EMAIL_FROM missing] To ${to}: ${subject}\n${text}`);
    return false;
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to, subject, html, text }),
  });
  if (!res.ok) console.error('Resend failed:', res.status, await res.text().catch(() => ''));
  return res.ok;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** A plain, branded email with one button. */
export function linkEmail(heading: string, body: string, button: string, url: string) {
  const html = `<div style="font-family:Montserrat,Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#121214">
<div style="font-weight:800;font-size:20px;letter-spacing:.5px;color:#6C55A3">REPS</div>
<h1 style="font-size:20px;margin:22px 0 10px">${esc(heading)}</h1>
<p style="font-size:14px;line-height:1.6;margin:0 0 22px">${esc(body)}</p>
<a href="${esc(url)}" style="display:inline-block;background:#6C55A3;color:#fff;text-decoration:none;font-weight:700;font-size:14px;padding:12px 22px;border-radius:6px">${esc(button)}</a>
<p style="font-size:12px;color:#74737E;margin-top:26px">If the button doesn't work, copy this link into your browser:<br>${esc(url)}</p></div>`;
  return { html, text: `${heading}\n\n${body}\n\n${button}: ${url}` };
}
