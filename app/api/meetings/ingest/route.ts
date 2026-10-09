import { context, errorReply } from '@/lib/server/backend';
import { ingestMeetingDoc } from '@/lib/backend/core';
import { setting } from '@/lib/server/env';

export const maxDuration = 120;

/**
 * Google Meet notes and transcripts arrive here from the Apps Script in
 * integrations/google-meet/Code.gs, which runs in a REPS Google account.
 *
 *   POST /api/meetings/ingest   header x-reps-secret: <MEETINGS_SECRET>
 *   { docId, title, text, url, attendees: [emails], startedAt, endedAt }
 *
 * The call is matched to a client by attendee email, then by the client's name in the
 * title. Unmatched calls wait in Agency · Meetings to be assigned.
 */
export async function POST(req: Request) {
  const secret = setting('MEETINGS_SECRET');
  if (!secret || req.headers.get('x-reps-secret') !== secret) return Response.json({ error: 'Not allowed.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.title || typeof body.text !== 'string' || !body.text.trim()) return Response.json({ error: 'Missing title or text.' }, { status: 400 });
  try {
    const { store, services, ownDomains } = context(req);
    const r = await ingestMeetingDoc(store, services, {
      docId: String(body.docId || '') || undefined,
      title: String(body.title).slice(0, 300),
      text: String(body.text).slice(0, 900_000),
      url: typeof body.url === 'string' ? body.url : undefined,
      attendees: Array.isArray(body.attendees) ? body.attendees.filter((e: unknown) => typeof e === 'string') : [],
      startedAt: body.startedAt || null,
      endedAt: body.endedAt || null,
      source: 'gemini',
      ownDomains,
    });
    return Response.json({ ok: true, id: r.id, clientId: r.clientId, duplicate: r.duplicate });
  } catch (e) {
    return errorReply(e);
  }
}
