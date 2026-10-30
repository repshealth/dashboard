import { context } from '@/lib/server/backend';
import { calendlyCtx, type ClientRec } from '@/lib/backend/core';
import { applyCalendlyEvent } from '@/lib/calendly/apply';
import { verifyStripeSignature } from '@/lib/stripe/verify';
import type { CalendlySettings } from '@/lib/calendly/types';

/**
 * POST /api/calendly/<client-slug>  Calendly webhook for one client's Calendly account.
 *
 * Set up automatically when the REPS team pastes the client's Calendly token (Leads, Calendly
 * button). Bookings move leads to Call booked, cancellations back to Nurturing, and no-shows to
 * Showed / No-show, matched by email. Each update is signed with a key only the dashboard knows
 * (Calendly signs the same way as Stripe: t=…,v1=… over "t.body").
 */
export async function POST(req: Request, { params }: { params: Promise<{ client: string }> }) {
  const body = await req.text();
  try {
    const { client: slug } = await params;
    const { store, services } = context(req);
    const client = await store.byKey<ClientRec>('client', decodeURIComponent(slug).toLowerCase());
    if (!client) return Response.json({ error: 'Unknown client.' }, { status: 404 });
    const settings = await store.get<CalendlySettings>('calendly', client.id);
    if (!settings?.signingKey) return Response.json({ ok: true, ignored: 'Not connected' });
    if (!(await verifyStripeSignature(settings.signingKey, req.headers.get('calendly-webhook-signature'), body, 900))) {
      return Response.json({ error: 'Bad signature.' }, { status: 400 });
    }
    const evt = JSON.parse(body) as Record<string, unknown>;
    const p = (evt.payload ?? {}) as Record<string, unknown>;
    // Calendly can send the same update more than once.
    const seenKey = `calendly-evt:${String(evt.event)}:${String(p.uri ?? '')}`;
    if (await store.get('setting', seenKey)) return Response.json({ ok: true, duplicate: true });
    const note = await applyCalendlyEvent(calendlyCtx(store, services, client.id, settings), evt);
    await store.put('setting', seenKey, { at: new Date().toISOString() }, {});
    await store.mutate<CalendlySettings>('calendly', client.id, (x) => { x.lastEventAt = new Date().toISOString(); x.lastNote = note; }, () => ({ clientId: client.id }));
    return Response.json({ ok: true, note });
  } catch (e) {
    console.error('Calendly webhook failed', e);
    // A 500 makes Calendly retry later.
    return Response.json({ error: 'Could not process the update.' }, { status: 500 });
  }
}
