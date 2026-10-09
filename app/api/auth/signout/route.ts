import { context } from '@/lib/server/backend';
import { endSession, sessionCookie } from '@/lib/server/auth';

/** POST /api/auth/signout  Ends the session and clears the cookie. */
export async function POST(req: Request) {
  try {
    await endSession(context(req).store, req);
  } catch (e) {
    console.error(e);
  }
  return Response.json({ ok: true }, { headers: { 'Set-Cookie': sessionCookie('', 0) } });
}
