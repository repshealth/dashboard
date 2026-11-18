import type { AdRowInput, AdStatus } from '../ads/types';

/** Meta's Graph API version. Versions last about two years; bump it when Meta warns. */
export const META_API_VERSION = 'v23.0';
export const META_GRAPH = `https://graph.facebook.com/${META_API_VERSION}`;

/** GET a Graph API path (or a full paging URL) with the token. */
export type MetaGet = (token: string, pathOrUrl: string) => Promise<Record<string, unknown>>;

export interface MetaAdAccountInfo {
  id: string; // numeric, without act_
  name: string;
  currency: string;
  status: 'active' | 'disabled' | 'unsettled' | 'closed' | 'other';
  business?: string;
}

/** Every page of a Graph API list (up to a limit, so a runaway account can't stall the sync). */
async function all(get: MetaGet, token: string, first: string, maxPages = 40) {
  const out: Record<string, unknown>[] = [];
  let next: string | undefined = first;
  for (let i = 0; next && i < maxPages; i++) {
    const page: Record<string, unknown> = await get(token, next);
    out.push(...(((page.data as Record<string, unknown>[]) ?? [])));
    next = (page.paging as { next?: string } | undefined)?.next;
  }
  return out;
}

const STATUS: Record<number, MetaAdAccountInfo['status']> = { 1: 'active', 2: 'disabled', 3: 'unsettled', 101: 'closed' };

export async function metaWhoAmI(get: MetaGet, token: string) {
  const me = await get(token, '/me?fields=id,name');
  return { id: String(me.id ?? ''), name: String(me.name ?? 'Meta user') };
}

/** Every ad account the token can see. */
export async function metaAdAccounts(get: MetaGet, token: string): Promise<MetaAdAccountInfo[]> {
  const list = await all(get, token, '/me/adaccounts?fields=account_id,name,currency,account_status,business{name}&limit=200', 20);
  return list.map((a) => ({
    id: String(a.account_id ?? String(a.id ?? '').replace(/^act_/, '')),
    name: String(a.name ?? 'Unnamed ad account'),
    currency: String(a.currency ?? 'GBP'),
    status: STATUS[Number(a.account_status)] ?? 'other',
    business: (a.business as { name?: string } | undefined)?.name,
  })).filter((a) => a.id).sort((a, b) => a.name.localeCompare(b.name));
}

type Action = { action_type?: string; value?: string };
const sumOf = (list: unknown, types: string[]) => {
  const xs = (Array.isArray(list) ? list : []) as Action[];
  for (const t of types) { const hit = xs.find((x) => x.action_type === t); if (hit) return Number(hit.value) || 0; }
  return 0;
};
// The first type found wins: "lead" and "omni_purchase" already add up their parts.
const LEADS = ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead'];
const BUYS = ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'];

/** Day-by-day results for every ad in the account between two dates (YYYY-MM-DD). */
export async function metaInsights(get: MetaGet, token: string, accountId: string, since: string, until: string): Promise<AdRowInput[]> {
  const range = encodeURIComponent(JSON.stringify({ since, until }));
  const fields = 'campaign_name,adset_name,ad_name,spend,impressions,reach,inline_link_clicks,actions,action_values';
  const list = await all(get, token, `/act_${accountId}/insights?level=ad&time_increment=1&time_range=${range}&fields=${fields}&limit=500`);
  return list.map((r) => {
    const metaLeads = sumOf(r.actions, LEADS);
    const purchases = sumOf(r.actions, BUYS);
    return {
      date: String(r.date_start ?? since),
      campaign: String(r.campaign_name ?? 'Unnamed campaign'),
      adset: String(r.adset_name ?? ''),
      ad: String(r.ad_name ?? ''),
      spend: Number(r.spend) || 0,
      impressions: Number(r.impressions) || 0,
      reach: Number(r.reach) || 0,
      clicks: Number(r.inline_link_clicks) || 0,
      results: metaLeads || purchases,
      resultType: metaLeads ? 'Leads' : purchases ? 'Purchases' : undefined,
      metaLeads,
      purchases,
      value: sumOf(r.action_values, BUYS),
    };
  });
}

export interface MetaCampaignInfo { id: string; name: string; status: AdStatus; dailyBudget?: number }

/** Campaigns with their live status and daily budget (budgets come in pence/cents). */
export async function metaCampaigns(get: MetaGet, token: string, accountId: string): Promise<MetaCampaignInfo[]> {
  const list = await all(get, token, `/act_${accountId}/campaigns?fields=id,name,effective_status,daily_budget&limit=200`, 10);
  return list.map((c) => {
    const s = String(c.effective_status ?? '');
    const status: AdStatus = /PAUSED/.test(s) ? 'paused' : /ARCHIVED|DELETED/.test(s) ? 'ended' : 'active';
    const b = Number(c.daily_budget);
    return { id: String(c.id), name: String(c.name ?? ''), status, ...(b > 0 ? { dailyBudget: b / 100 } : {}) };
  });
}
