import { context } from '@/lib/server/backend';
import { sourceOf } from '@/lib/funnels/stats';
import type { Funnel, FunnelHit } from '@/lib/funnels/types';

/**
 * POST /api/track  A page view from a funnel page's tracking snippet.
 * Body (text or JSON): { f: funnel id, v: visitor id, r: referrer, s: utm_source, w: screen width }
 * Sent with navigator.sendBeacon, so there's no CORS preflight and the page never waits.
 */
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|uptime/i;

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS });
}

export async function POST(req: Request) {
  const done = new Response(null, { status: 204, headers: CORS });
  try {
    if (BOTS.test(req.headers.get('user-agent') ?? '')) return done;
    const raw = (await req.text()).slice(0, 2000);
    const b = JSON.parse(raw) as Record<string, unknown>;
    const id = String(b.f ?? '').slice(0, 64);
    const v = String(b.v ?? '').replace(/[^\w-]/g, '').slice(0, 40);
    if (!id || !v) return done;
    const { store, services } = context(req);
    const f = await store.get<Funnel>('funnel', id);
    if (!f || f.status === 'draft') return done;
    let own = '';
    try { own = new URL(f.url).hostname; } catch { /* no page address */ }
    const hit: FunnelHit = {
      t: new Date().toISOString(), v,
      s: sourceOf(String(b.r ?? ''), String(b.s ?? ''), own),
      d: Number(b.w) > 0 && Number(b.w) < 768 ? 'mobile' : 'desktop',
    };
    await store.put('fhit', services.newId(), hit, { clientId: f.id, sort: hit.t });
    // Shows the team the snippet is working (written at most every 10 minutes).
    if (!f.lastViewAt || Date.now() - Date.parse(f.lastViewAt) > 10 * 60_000) {
      await store.mutate<Funnel>('funnel', f.id, (x) => { x.lastViewAt = hit.t; }, (x) => ({ clientId: x.clientId, sort: x.createdAt }));
    }
  } catch { /* never break the client's page */ }
  return done;
}
