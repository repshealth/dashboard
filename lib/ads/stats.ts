import type { Lead } from '../types';
import type { AdCampaign, AdCampaignReport, AdLine, AdMetrics, AdOutcome, AdRow, AdsReport, MetaAdsAccount } from './types';

const zero = (): AdMetrics => ({ spend: 0, impressions: 0, reach: 0, clicks: 0, results: 0, metaLeads: 0, purchases: 0, value: 0, ctr: null, cpc: null, cpm: null });
const add = (m: AdMetrics, r: AdRow) => {
  m.spend += r.spend; m.impressions += r.impressions; m.reach += r.reach; m.clicks += r.clicks;
  m.results += r.results; m.metaLeads += r.metaLeads; m.purchases += r.purchases; m.value += r.value;
};
const rates = (m: AdMetrics) => {
  m.spend = Math.round(m.spend * 100) / 100;
  m.ctr = m.impressions ? m.clicks / m.impressions : null;
  m.cpc = m.clicks ? m.spend / m.clicks : null;
  m.cpm = m.impressions ? (m.spend / m.impressions) * 1000 : null;
  return m;
};
const key = (s?: string) => (s ?? '').trim().toLowerCase();
const booked = (l: Lead) => ['call', 'showed', 'purchased'].includes(l.stage) || (l.stage === 'lost' && Boolean(l.attended)) || Boolean(l.booking);
const paid = (l: Lead) => Number(l.payments?.totalPaid ?? (l.stage === 'purchased' ? l.value : 0)) || 0;
const bought = (l: Lead) => l.stage === 'purchased' || paid(l) > 0;

function outcome(spend: number, leads: Lead[]): AdOutcome {
  const b = leads.filter(booked).length;
  const p = leads.filter(bought).length;
  const revenue = leads.reduce((s, l) => s + paid(l), 0);
  return {
    leads: leads.length, booked: b, bought: p, revenue,
    cpl: leads.length ? spend / leads.length : null,
    costPerCall: b ? spend / b : null,
    roas: spend > 0 ? revenue / spend : null,
  };
}

/** Is this lead from an ad? Its utm_campaign matches a campaign's tag, or it came in as an ads lead. */
export function campaignOfLead(l: Lead, tags: Map<string, string>) {
  const t = key(l.utm);
  if (t && tags.has(t)) return tags.get(t)!;
  return null;
}

export function adsReport(account: MetaAdsAccount, rows: AdRow[], settings: AdCampaign[], leads: Lead[], funnels: { id: string; name: string }[], from: string, to: string): AdsReport {
  const inRange = rows.filter((r) => r.date >= from && r.date <= to);
  const totals = zero();
  const dayMap = new Map<string, { date: string; spend: number; clicks: number; leads: number }>();
  for (let d = new Date(`${from}T12:00:00Z`); d.toISOString().slice(0, 10) <= to && dayMap.size < 400; d = new Date(d.getTime() + 864e5)) {
    const k = d.toISOString().slice(0, 10); dayMap.set(k, { date: k, spend: 0, clicks: 0, leads: 0 });
  }
  const byName = new Map<string, { m: AdMetrics; sets: Map<string, { m: AdMetrics; ads: Map<string, AdMetrics> }>; first?: string; last?: string }>();
  for (const r of inRange) {
    add(totals, r);
    const day = dayMap.get(r.date); if (day) { day.spend += r.spend; day.clicks += r.clicks; }
    let c = byName.get(r.campaign);
    if (!c) { c = { m: zero(), sets: new Map() }; byName.set(r.campaign, c); }
    add(c.m, r);
    if (!c.first || r.date < c.first) c.first = r.date;
    if (!c.last || r.date > c.last) c.last = r.date;
    if (r.adset) {
      let s = c.sets.get(r.adset);
      if (!s) { s = { m: zero(), ads: new Map() }; c.sets.set(r.adset, s); }
      add(s.m, r);
      if (r.ad) { let a = s.ads.get(r.ad); if (!a) { a = zero(); s.ads.set(r.ad, a); } add(a, r); }
    }
  }
  // Campaigns set up on the dashboard show even before they have results.
  for (const s of settings) if (!byName.has(s.name)) byName.set(s.name, { m: zero(), sets: new Map() });

  const settingOf = new Map(settings.map((s) => [key(s.name), s]));
  const tags = new Map<string, string>();
  for (const name of byName.keys()) tags.set(key(settingOf.get(key(name))?.utm || name), name);
  for (const s of settings) if (s.utm) tags.set(key(s.utm), s.name);

  const fromT = `${from}T00:00:00`, toT = `${to}T23:59:59.999Z`;
  const leadsBy = new Map<string, Lead[]>();
  const adLeads: Lead[] = [];
  const recent: AdsReport['recentLeads'] = [];
  for (const l of leads) {
    if (!l.firstSeen || l.firstSeen < fromT || l.firstSeen > toT) continue;
    const c = campaignOfLead(l, tags);
    if (!c && l.source !== 'ads') continue;
    adLeads.push(l);
    if (c) { const list = leadsBy.get(c) ?? []; list.push(l); leadsBy.set(c, list); }
    recent.push({ id: l.id, name: l.name, at: l.firstSeen, campaign: c ?? 'Ads (no campaign tag)', stage: l.stage });
    const day = dayMap.get(l.firstSeen.slice(0, 10)); if (day) day.leads++;
  }
  const fname = new Map(funnels.map((f) => [f.id, f.name]));
  const today = new Date().toISOString().slice(0, 10);
  const campaigns: AdCampaignReport[] = [...byName.entries()].map(([name, c]) => {
    const st = settingOf.get(key(name));
    const m = rates(c.m);
    return {
      name, m, settings: st, first: c.first, last: c.last,
      status: st?.status ?? (c.last && c.last >= new Date(Date.parse(`${today}T12:00:00Z`) - 2 * 864e5).toISOString().slice(0, 10) ? 'active' : 'ended'),
      funnelName: st?.funnelId ? fname.get(st.funnelId) : undefined,
      out: outcome(m.spend, leadsBy.get(name) ?? []),
      adsets: [...c.sets.entries()].map(([sn, s]) => ({ name: sn, m: rates(s.m), ads: [...s.ads.entries()].map(([an, a]): AdLine => ({ name: an, m: rates(a) })).sort((a, b) => b.m.spend - a.m.spend) })).sort((a, b) => b.m.spend - a.m.spend),
    };
  }).sort((a, b) => b.m.spend - a.m.spend || a.name.localeCompare(b.name));

  rates(totals);
  return {
    from, to, account, totals, out: outcome(totals.spend, adLeads),
    days: [...dayMap.values()].map((d) => ({ ...d, spend: Math.round(d.spend * 100) / 100 })),
    campaigns, hasData: rows.length > 0,
    recentLeads: recent.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, 8),
  };
}
