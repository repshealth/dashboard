import { context, errorReply } from '@/lib/server/backend';
import { findOrCreateAdmin, isAdminEmail, sessionCookie, startSession } from '@/lib/server/auth';
import { checkLogin } from '@/lib/backend/core';
import { sameText } from '@/lib/backend/password';
import { setting } from '@/lib/server/env';

/**
 * POST /api/auth/login { email, password }
 *  - The agency login is an email in ADMIN_EMAILS with the ADMIN_PASSWORD secret (set in Cloudflare).
 *  - Everyone else uses a login made in Agency > Logins.
 * After 8 wrong passwords for one email it stops trying for 15 minutes.
 */
const MAX_TRIES = 8;
const LOCK_MS = 15 * 60e3;
interface Tries { n: number; until?: string }

const no = (msg = 'That email and password don’t match.') =>
  new Promise<Response>((r) => setTimeout(() => r(Response.json({ error: msg }, { status: 401 })), 600));

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string; password?: string };
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return Response.json({ error: 'Enter your email and password.' }, { status: 400 });
    const { store } = context(req);

    const key = `tries:${email}`;
    const tries = await store.get<Tries>('setting', key);
    if (tries?.until && Date.parse(tries.until) > Date.now()) return no('Too many attempts. Please wait 15 minutes and try again.');

    let userId: string | null = null;
    const adminPassword = setting('ADMIN_PASSWORD');
    if (isAdminEmail(email) && adminPassword && sameText(password, adminPassword)) {
      userId = (await findOrCreateAdmin(store, email))?.id ?? null;
    } else {
      userId = (await checkLogin(store, email, password))?.id ?? null;
    }

    if (!userId) {
      const n = (tries?.n ?? 0) + 1;
      await store.put<Tries>('setting', key, n >= MAX_TRIES ? { n: 0, until: new Date(Date.now() + LOCK_MS).toISOString() } : { n }, {});
      return no();
    }
    if (tries) await store.del('setting', key);
    const s = await startSession(store, userId);
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie(s.value, s.maxAge) } });
  } catch (e) {
    return errorReply(e);
  }
}
