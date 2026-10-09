import type { AnySpec } from './site/prereg';

export type SourceId = 'quiz' | 'magnet' | 'survey' | 'ads' | 'news' | 'prereg';
export type StageId = 'new' | 'nurture' | 'call' | 'showed' | 'purchased' | 'lost';
export type Device = 'desktop' | 'mobile';
/** draft = generated from onboarding and only visible to the REPS team. */
export type SiteStatus = 'draft' | 'building' | 'review' | 'changes' | 'approved';

export interface Client {
  id: string;
  slug: string;
  name: string;
  /** Optional overrides for the KPI captions. Computed from the data when absent. */
  growthNote?: string;
  revenueNote?: string;
}

export interface LeadEvent {
  id: string;
  label: string;
  /** Where it happened: Website, Calendly, Stripe, MailerLite, or a person's name. */
  source: string;
  at?: string; // ISO date
}

export interface Lead {
  id: string;
  clientId: string;
  name: string;
  email: string;
  phone?: string;
  source: SourceId;
  stage: StageId;
  page?: string;
  utm?: string;
  firstSeen: string; // ISO date
  value: number; // GBP
  attended?: boolean | null;
  /** Short status on the card, e.g. "Thu 2:00pm" or "£997". Falls back to time since first seen. */
  headline?: string;
  /** One line under the card, e.g. "Calendly · Discovery Call". */
  detail?: string;
  mailerlite?: string;
  calendly?: string;
  stripe?: string;
  answersTitle?: string;
  answers: [string, string][];
  events: LeadEvent[]; // newest first
  notes?: string;
}

/** Where a comment pin sits: an element in the preview plus a fractional offset inside it. */
export interface PinAnchor {
  /** CSS selector inside the preview, with an optional index when several match. */
  sel?: string;
  n?: number;
  /** Or: index of the element among the preview's descendants (used for mock pages). */
  i?: number;
  fx: number;
  fy: number;
}

/** What a pin points at, captured when the comment is left. Gives Claude context for amends. */
export interface CommentTarget {
  section: string; // e.g. "Hero", "Pricing"
  text: string; // the words (or image label) under the pin
}

export interface SiteComment {
  id: string;
  pageId: string;
  author: string;
  role: 'client' | 'agency';
  device?: Device;
  anchor: PinAnchor;
  text: string;
  resolved: boolean;
  createdAt: string; // ISO date
  target?: CommentTarget;
}

/** One edit made to a site when amending it from comments. */
export interface SiteChange {
  path: string; // e.g. "hero.headline.bold"
  label: string; // e.g. "Hero headline"
  before: string;
  after: string;
  commentId?: string;
}

/** A comment the automatic amend could not handle (e.g. a new photo is needed). */
export interface UnresolvedComment {
  commentId: string;
  text: string;
  reason: string;
}

/** Example-only page drawn in code. Live sites use screenshots (kind: 'shot'). */
export type MockPage =
  | { type: 'home' }
  | { type: 'quiz'; title: string; step: string; q: string; opts: string[] }
  | { type: 'survey'; title: string; fields: string[] }
  | { type: 'magnet'; title: string; p: string; cover: string };

export interface MockBrand {
  name: string;
  accent: string;
  ink: string;
  bg: string;
  font: string;
  cta: string;
  eyebrow: string;
  h1: string;
  p: string;
  cards: [string, string][];
  quote: string;
  who: string;
}

export interface SitePage {
  id: string;
  key: string;
  name: string;
  path: string;
  /** shot = screenshots, mock = example page, template = generated from onboarding. */
  kind: 'shot' | 'mock' | 'template';
  desktopUrl?: string;
  mobileUrl?: string;
  mock?: MockPage;
  /** The main site or the pre-registration page, both kind 'template'. */
  spec?: AnySpec;
}

export interface SiteVersion {
  id: string;
  version: string; // "v2"
  label: string; // "v2 · Shape Up direction"
  sentNote: string;
  pages: SitePage[];
  comments: SiteComment[];
  /** published = the client can see it. pending = waiting for REPS approval. rejected = discarded. */
  state?: 'published' | 'pending' | 'rejected';
  /** For amended versions: the version it was made from, what changed and what still needs a person. */
  basedOn?: string;
  createdAt?: string;
  amendedBy?: 'claude' | 'rules';
  summary?: string;
  changes?: SiteChange[];
  unresolved?: UnresolvedComment[];
}

export interface Site {
  clientId: string;
  status: SiteStatus;
  statusNote: string;
  contact: string;
  domain: string;
  brand?: MockBrand;
  versions: SiteVersion[]; // newest first
}

export interface Viewer {
  name: string;
  email?: string;
  isAdmin: boolean;
}
