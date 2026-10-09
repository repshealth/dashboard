import { context, errorReply } from '@/lib/server/backend';
import { findOrCreateAdmin, linkEmail, sendEmail, signInLink } from '@/lib/server/auth';

/**
 * POST /api/auth/request { email }
 * Emails a sign-in link to REPS admins and to clients who have been given access.
 * Always replies the same way, so it can't be used to find out who has an account.
 */
export async function POST(req: Request) {
  try {
    const { email } = (await req.json().catch(() => ({}))) as { email?: string };
    const e = String(email || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return Response.json({ error: 'Please enter a valid email.' }, { status: 400 });
    const { store } = context(req);
    const user = await findOrCreateAdmin(store, e);
    if (user) {
      const link = await signInLink(store, new URL(req.url).origin, e);
      const m = linkEmail('Sign in to REPS Scaling OS', 'Click the button to sign in. The link works once and expires in 30 minutes.', 'Sign in', link);
      await sendEmail(e, 'Your REPS sign-in link', m.html, m.text);
    }
    return Response.json({ ok: true });
  } catch (err) {
    return errorReply(err);
  }
}
