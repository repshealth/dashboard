import type { Lead } from '../types';
import type { Funnel, FunnelDay, FunnelHit, FunnelStats } from './types';

const day = (iso: string) => iso.slice(0, 10);
const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** When a lead signed up through this funnel's forms, or null if they didn't. */
export function signedUpAt(f: Pick<Funnel, 'forms'>, l: Lead): string | null {
  const forms = new Set(f.forms.map((x) => x.trim().toLowerCase()).filter(Boolean));
  if (!forms.size) return null;
  const subs = (l.submissions ?? []).filter((s) => forms.has(s.form.trim().toLowerCase())).map((s) => s.at).sort();
  if (subs.length) return subs[0];
  return l.form && forms.has(l.form.trim().toLowerCase()) ? l.firstSeen : null;
}

const booked = (l: Lead) => ['call', 'showed', 'purchased'].includes(l.stage) || Boolean(l.booking) || (l.stage === 'lost' && !!l.attended);
const bought = (l: Lead) => l.stage === 'purchased' || (l.payments?.totalPaid ?? 0) > 0;
const paid = (l: Lead) => Number(l.payments?.totalPaid ?? (l.stage === 'purchased' ? l.value : 0)) || 0;

/**
 * A funnel's numbers for a date range (inclusive, YYYY-MM-DD): views and unique visitors from
 * the tracking snippet, sign-ups from its forms, and how many of those people went on to book
 * a call or buy.
 */
export function funnelStats(f: Funnel, hits: FunnelHit[], leads: Lead[], from: string, to: string): FunnelStats {
  const inRange = (iso: string) => { const d = day(iso); return d >= from && d <= to; };
  const hs = hits.filter((h) => inRange(h.t));
  const people = leads.map((l) => ({ l, at: signedUpAt(f, l) })).filter((x): x is { l: Lead; at: string } => Boolean(x.at) && inRange(x.at!));

  const days: FunnelDay[] = [];
  const byDay = new Map<string, { views: number; v: Set<string>; signups: number }>();
  for (let d = from; d <= to; d = addDays(d, 1)) { byDay.set(d, { views: 0, v: new Set(), signups: 0 }); if (byDay.size > 400) break; }
  for (const h of hs) { const b = byDay.get(day(h.t)); if (b) { b.views++; b.v.add(h.v); } }
  for (const p of people) { const b = byDay.get(day(p.at)); if (b) b.signups++; }
  for (const [date, b] of byDay) days.push({ date, views: b.views, visitors: b.v.size, signups: b.signups });

  // Sources: the first place each visitor came from in the range.
  const firstSource = new Map<string, string>();
  for (const h of [...hs].sort((a, b) => (a.t < b.t ? -1 : 1))) if (!firstSource.has(h.v)) firstSource.set(h.v, h.s || 'Direct');
  const src = new Map<string, { visitors: number; signups: number }>();
  for (const s of firstSource.values()) { const x = src.get(s) ?? { visitors: 0, signups: 0 }; x.visitors++; src.set(s, x); }
  const utm = (l: Lead) => (l.utm ? l.utm : null);
  for (const p of people) { const name = utm(p.l) && src.has(utm(p.l)!) ? utm(p.l)! : null; if (name) src.get(name)!.signups++; }
  const sources = [...src.entries()].map(([name, x]) => ({ name, ...x })).sort((a, b) => b.visitors - a.visitors).slice(0, 8);

  const visitors = new Set(hs.map((h) => h.v)).size;
  const devices = new Map<string, 'mobile' | 'desktop'>();
  for (const h of hs) devices.set(h.v, h.d);
  const mobile = [...devices.values()].filter((d) => d === 'mobile').length;

  return {
    from, to, views: hs.length, visitors, signups: people.length,
    booked: people.filter((p) => booked(p.l)).length,
    purchased: people.filter((p) => bought(p.l)).length,
    revenue: Math.round(people.reduce((a, p) => a + paid(p.l), 0) * 100) / 100,
    conversion: visitors ? people.length / visitors : null,
    days, sources,
    mobileShare: devices.size ? mobile / devices.size : null,
    recent: people.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8).map((p) => ({ id: p.l.id, name: p.l.name, at: p.at, stage: p.l.stage })),
  };
}

/** "Direct", a utm_source, or a tidy referring site ("instagram.com" from l.instagram.com). */
export function sourceOf(referrer: string, utmSource: string, ownHost: string) {
  if (utmSource.trim()) return utmSource.trim().toLowerCase().slice(0, 60);
  try {
    const host = new URL(referrer).hostname.replace(/^(www|m|l|lm)\./, '');
    if (!host || host === ownHost.replace(/^www\./, '')) return 'Direct';
    return host.slice(0, 60);
  } catch { return 'Direct'; }
}
