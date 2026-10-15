import { context } from '@/lib/server/backend';
import { stripeCtx, type ClientRec } from '@/lib/backend/core';
import { applyStripeEvent } from '@/lib/stripe/apply';
import { verifyStripeSignature } from '@/lib/stripe/verify';
import type { StripeSettings } from '@/lib/stripe/types';

/**
 * POST /api/stripe/<client-slug>  Stripe webhook for one client's Stripe account.
 *
 * Each payment, subscription change and refund is matched to a lead by email (or Stripe
 * customer) and moves them to Purchased with their totals. Signed with the client's own
 * signing secret, saved in their Leads page (Stripe button).
 *
 * Until the secret is saved, events get a 200 and are ignored, so Stripe doesn't flag errors
 * while it's being set up.
 */
export async function POST(req: Request, { params }: { params: Promise<{ client: string }> }) {
  const body = await req.text();
  try {
    const { client: slug } = await params;
    const { store, services } = context(req);
    const client = await store.byKey<ClientRec>('client', decodeURIComponent(slug).toLowerCase());
    if (!client) return Response.json({ error: 'Unknown client.' }, { status: 404 });
    const settings = await store.get<StripeSettings>('stripe', client.id);
    if (!settings?.signingSecret) return Response.json({ ok: true, ignored: 'Not connected yet' });
    if (!(await verifyStripeSignature(settings.signingSecret, req.headers.get('stripe-signature'), body))) {
      return Response.json({ error: 'Bad signature.' }, { status: 400 });
    }
    const evt = JSON.parse(body) as Record<string, unknown>;
    // Stripe can send the same event more than once.
    const seenKey = `stripe-evt:${String(evt.id)}`;
    if (await store.get('setting', seenKey)) return Response.json({ ok: true, duplicate: true });
    const note = await applyStripeEvent(stripeCtx(store, services, client.id, settings), evt);
    await store.put('setting', seenKey, { at: new Date().toISOString() }, {});
    await store.mutate<StripeSettings>('stripe', client.id, (x) => { x.lastEventAt = new Date().toISOString(); x.lastNote = note; }, () => ({ clientId: client.id }));
    return Response.json({ ok: true, note });
  } catch (e) {
    console.error('Stripe webhook failed', e);
    // A 500 makes Stripe retry later, which is what we want for a passing problem.
    return Response.json({ error: 'Could not process the event.' }, { status: 500 });
  }
}
