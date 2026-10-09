import { context } from '@/lib/server/backend';
import { findOrCreateAdmin, sessionCookie, startSession, useToken } from '@/lib/server/auth';

/** GET /api/auth/verify?token=...  The link in the sign-in email. Starts a session and opens the dashboard. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const back = (path: string) => Response.redirect(new URL(path, url.origin).toString(), 303);
  try {
    const token = url.searchParams.get('token') || '';
    const { store } = context(req);
    const email = token ? await useToken(store, token) : null;
    if (!email) return back('/login?error=expired');
    const user = await findOrCreateAdmin(store, email);
    if (!user) return back('/login?error=expired');
    const s = await startSession(store, user.id);
    return new Response(null, { status: 303, headers: { Location: new URL('/', url.origin).toString(), 'Set-Cookie': sessionCookie(s.value, s.maxAge) } });
  } catch (e) {
    console.error(e);
    return back('/login?error=server');
  }
}
