/**
 * Funnel pages: single campaign pages (an app launch, a challenge, a waitlist) that sit
 * apart from a client's main website, each with its own view and conversion tracking.
 */
export type FunnelKind = 'launch' | 'challenge' | 'waitlist' | 'sales' | 'webinar' | 'other';

export const FUNNEL_KINDS: { id: FunnelKind; label: string }[] = [
  { id: 'launch', label: 'App launch' },
  { id: 'challenge', label: 'Challenge' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'sales', label: 'Sales page' },
  { id: 'webinar', label: 'Webinar' },
  { id: 'other', label: 'Other' },
];
export const FUNNEL_KIND_NAME = Object.fromEntries(FUNNEL_KINDS.map((k) => [k.id, k.label])) as Record<FunnelKind, string>;

export interface Funnel {
  id: string;
  clientId: string;
  name: string;
  kind: FunnelKind;
  /** The live page, e.g. https://www.daileydemolition.com/bring-it-home/ */
  url: string;
  /** Forms on the page whose sign-ups count, by the names they arrive with (e.g. "Bring It Home waitlist"). */
  forms: string[];
  /** Campaign dates (YYYY-MM-DD). Stats default to this window. */
  startsOn?: string;
  endsOn?: string;
  /** draft = not live yet. ended = campaign over (also automatic after endsOn). */
  status: 'draft' | 'live' | 'ended';
  notes?: string;
  createdAt: string;
  /** When the tracking snippet last reported a view. */
  lastViewAt?: string;
}

export type FunnelInput = Pick<Funnel, 'name' | 'kind' | 'url' | 'forms' | 'status'> & Partial<Pick<Funnel, 'id' | 'startsOn' | 'endsOn' | 'notes'>>;

/** One page view, as sent by the tracking snippet. */
export interface FunnelHit {
  t: string; // ISO time
  /** Anonymous visitor id kept in the visitor's browser. */
  v: string;
  /** Where they came from: utm_source, the referring site, or "Direct". */
  s: string;
  d: 'mobile' | 'desktop';
}

export interface FunnelDay { date: string; views: number; visitors: number; signups: number }

export interface FunnelStats {
  from: string;
  to: string;
  views: number;
  visitors: number;
  signups: number;
  booked: number;
  purchased: number;
  revenue: number;
  /** Sign-ups as a share of unique visitors (0 to 1). */
  conversion: number | null;
  days: FunnelDay[];
  sources: { name: string; visitors: number; signups: number }[];
  mobileShare: number | null;
  /** The latest sign-ups, for the list under the stats. */
  recent: { id: string; name: string; at: string; stage: string }[];
}

/** Whether the campaign is on now (ended automatically once its end date has passed). */
export function funnelState(f: Pick<Funnel, 'status' | 'endsOn'>, today = new Date().toISOString().slice(0, 10)) {
  if (f.status === 'live' && f.endsOn && f.endsOn < today) return 'ended';
  return f.status;
}
