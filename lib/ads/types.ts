/**
 * Meta ads. Until Meta is connected, numbers come from an Ads Manager export (CSV); once it is,
 * the same rows are filled in by the Meta Marketing API, so the screens don't change.
 */
export type AdStatus = 'active' | 'paused' | 'ended' | 'draft';
export const AD_STATUS: Record<AdStatus, string> = { active: 'Active', paused: 'Paused', ended: 'Ended', draft: 'Not started' };

/** One line of results: one ad (or ad set, or campaign) on one day. */
export interface AdRow {
  id: string;
  clientId: string;
  date: string; // YYYY-MM-DD
  /** Set when the export covers a period rather than a single day. */
  endDate?: string;
  campaign: string;
  adset: string;
  ad: string;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number; // link clicks
  results: number; // Meta's "Results" for the campaign's goal
  resultType?: string;
  metaLeads: number;
  purchases: number;
  value: number; // purchase conversion value
  delivery?: string;
  importedAt: string;
}
export type AdRowInput = Omit<AdRow, 'id' | 'clientId' | 'importedAt'>;

/** Settings the team keeps for a campaign: which funnel it drives, its tag and budget. */
export interface AdCampaign {
  id: string;
  clientId: string;
  name: string;
  status: AdStatus;
  funnelId?: string;
  /** The utm_campaign value its ads send, used to match leads. Defaults to the campaign name. */
  utm?: string;
  dailyBudget?: number;
  notes?: string;
  /** The Meta campaign id, once connected. */
  metaId?: string;
  createdAt: string;
  updatedAt: string;
}
export type AdCampaignInput = Pick<AdCampaign, 'name' | 'status' | 'funnelId' | 'utm' | 'dailyBudget' | 'notes'> & { id?: string };

/** A client's Meta ad account. */
export interface MetaAdsAccount {
  clientId: string;
  adAccountId?: string;
  currency: string;
  connected: boolean;
  lastImportAt?: string;
  lastImportName?: string;
  lastImportRange?: [string, string];
}

export interface AdMetrics {
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  results: number;
  metaLeads: number;
  purchases: number;
  value: number;
  ctr: number | null;
  cpc: number | null;
  cpm: number | null;
}
/** What the ads turned into on the dashboard: leads whose utm_campaign matches, and what they did next. */
export interface AdOutcome {
  leads: number;
  booked: number;
  bought: number;
  revenue: number;
  cpl: number | null;
  costPerCall: number | null;
  roas: number | null;
}
export interface AdLine { name: string; m: AdMetrics }
export interface AdCampaignReport extends AdLine {
  settings?: AdCampaign;
  status: AdStatus;
  funnelName?: string;
  out: AdOutcome;
  adsets: (AdLine & { ads: AdLine[] })[];
  first?: string;
  last?: string;
}
export interface AdsReport {
  from: string;
  to: string;
  account: MetaAdsAccount;
  totals: AdMetrics;
  out: AdOutcome;
  days: { date: string; spend: number; clicks: number; leads: number }[];
  campaigns: AdCampaignReport[];
  /** Rows exist at all for this client (in any range). */
  hasData: boolean;
  recentLeads: { id: string; name: string; at: string; campaign: string; stage: string }[];
}
