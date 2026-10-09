import type { SiteStatus, SourceId, StageId } from './types';

export const SOURCES: Record<SourceId, { label: string; rgb: string; text: string }> = {
  quiz: { label: 'Quiz', rgb: '108,85,163', text: '#57428C' },
  magnet: { label: 'Lead magnet', rgb: '29,95,209', text: '#1A4FAE' },
  survey: { label: 'Survey', rgb: '0,0,0', text: '#0B0B0C' },
  ads: { label: 'Ads', rgb: '194,24,91', text: '#A3154D' },
  news: { label: 'Newsletter', rgb: '22,120,77', text: '#13663F' },
  prereg: { label: 'Pre-reg page', rgb: '201,112,10', text: '#8F4E05' },
};
export const SOURCE_IDS = Object.keys(SOURCES) as SourceId[];

export const STAGES: { id: StageId; label: string; name: string; hint: string }[] = [
  { id: 'new', label: 'NEW LEAD', name: 'New lead', hint: 'Form submitted on a website page' },
  { id: 'nurture', label: 'NURTURING', name: 'Nurturing', hint: 'In a MailerLite sequence' },
  { id: 'call', label: 'CALL BOOKED', name: 'Call booked', hint: 'Booked via Calendly' },
  { id: 'showed', label: 'SHOWED / NO-SHOW', name: 'Showed / No-show', hint: 'Calendly call has passed' },
  { id: 'purchased', label: 'PURCHASED', name: 'Purchased', hint: 'Paid via Stripe' },
  { id: 'lost', label: 'LOST', name: 'Lost', hint: 'Marked lost by the client' },
];
export const STAGE_NAME = Object.fromEntries(STAGES.map((s) => [s.id, s.name])) as Record<StageId, string>;
export const STAGE_ORDER = Object.fromEntries(STAGES.map((s, i) => [s.id, i])) as Record<StageId, number>;

export const AUTO_MOVES: [string, string][] = [
  ['Website form', 'New lead'],
  ['MailerLite opens & clicks', 'Nurturing'],
  ['Calendly booking', 'Call booked'],
  ['Calendly attended / no-show', 'Showed / No-show'],
  ['Stripe payment', 'Purchased'],
];

export const SITE_STATUS: Record<SiteStatus, { label: string; cls: string }> = {
  draft: { label: 'Draft · REPS only', cls: 'st-changes' },
  building: { label: 'Being built', cls: 'st-build' },
  review: { label: 'Ready for review', cls: 'st-review' },
  changes: { label: 'Changes requested', cls: 'st-changes' },
  approved: { label: 'Approved', cls: 'st-approved' },
};
