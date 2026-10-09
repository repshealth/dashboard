import type { SiteChange, SiteStatus, UnresolvedComment } from '../types';
import type { EmailStage } from './schedule';

/** prereg = people who signed up on the pre-registration page. public = the client's general list, minus those people. */
export type EmailListId = 'prereg' | 'public';

export const EMAIL_LISTS: Record<EmailListId, { label: string; short: string; about: string }> = {
  prereg: { label: 'Pre-registration list', short: 'Pre-reg list', about: 'People who signed up on the pre-registration page. Launch emails include the discount.' },
  public: { label: 'General email list', short: 'General list', about: 'Everyone else on the email list. Same journey, full price.' },
};

export interface LaunchEmail {
  id: string; // stable across versions, e.g. "prereg-3"
  list: EmailListId;
  n: number; // 1 to 6
  stage: EmailStage;
  offset: number; // days from launch
  time: string; // "09:00"
  subject: string;
  preview: string; // the grey line inboxes show after the subject
  heading: string;
  body: string[]; // paragraphs
  button: string; // button label, linking to the website. Empty on warm-ups.
  ps: string;
}

/** The parts of an email a comment can be left on. */
export type EmailField = 'subject' | 'preview' | 'heading' | 'button' | 'ps' | `body.${number}`;

export interface EmailComment {
  id: string;
  emailId: string;
  field: EmailField;
  /** The words the comment was left on, captured so the amend has context. */
  quote: string;
  author: string;
  role: 'client' | 'agency';
  text: string;
  resolved: boolean;
  createdAt: string;
}

export interface EmailVersion {
  id: string;
  version: string; // "v1"
  label: string;
  sentNote: string;
  emails: LaunchEmail[];
  comments: EmailComment[];
  /** Same states as site versions: the client only sees published ones. */
  state: 'published' | 'pending' | 'rejected';
  basedOn?: string;
  createdAt?: string;
  amendedBy?: 'claude' | 'rules' | 'reps';
  summary?: string;
  changes?: SiteChange[];
  unresolved?: UnresolvedComment[];
}

export interface EmailBrand {
  name: string;
  coach: string;
  logoUrl?: string;
  primary: string;
  secondary: string;
  ink: string;
  font: 'bold' | 'modern' | 'elegant';
  replyTo: string;
}

/** Where scheduling in MailerLite has got to. */
export interface MailerLiteState {
  state: 'not_scheduled' | 'scheduled' | 'not_connected' | 'failed';
  note: string;
  at?: string;
  campaignIds?: string[];
}

/** A client's MailerLite account details. Saved by REPS; the API key never goes back to the browser. */
export interface MailerLiteSettings {
  apiKey: string;
  fromEmail: string; // must be verified in their MailerLite account
  fromName: string;
  preregGroupId: string; // pre-registration sign-ups are added here
  publicGroupId: string; // their general list
  publicSegmentId: string; // optional: general list minus the pre-reg group (preferred)
  useHtml: boolean; // send our designed HTML (needs MailerLite's Advanced plan)
}
/** What the browser sees: everything except the key itself. */
export type MailerLitePublic = Omit<MailerLiteSettings, 'apiKey'> & { hasKey: boolean };

export interface EmailCampaign {
  clientId: string;
  status: SiteStatus;
  statusNote: string;
  contact: string;
  brand: EmailBrand;
  launchDate: string; // YYYY-MM-DD
  offerDays: number;
  websiteUrl: string;
  discountCode: string;
  offer: string;
  mailerlite: MailerLiteState;
  versions: EmailVersion[]; // newest first
}

export const publishedEmailVersions = (c: EmailCampaign | null | undefined) => (c?.versions ?? []).filter((v) => v.state === 'published');
export const latestEmailVersion = (c: EmailCampaign | null | undefined) => publishedEmailVersions(c)[0] ?? null;
export const pendingEmailVersion = (c: EmailCampaign | null | undefined) => (c?.versions ?? []).find((v) => v.state === 'pending') ?? null;
export const nextEmailVersionName = (c: EmailCampaign) => `v${c.versions.filter((v) => v.state !== 'rejected').length + 1}`;

/** Campaigns with something for REPS to do: a revised version to approve, or comments to handle. */
export const emailsNeedingReps = (list: EmailCampaign[] | null) =>
  (list ?? []).filter((c) => pendingEmailVersion(c) || (c.status === 'changes' && latestEmailVersion(c)?.comments.some((x) => !x.resolved)) || c.status === 'draft').length;

/** "body.2" -> "paragraph 3". */
export function fieldLabel(field: string) {
  if (field.startsWith('body.')) return `paragraph ${Number(field.slice(5)) + 1}`;
  return { subject: 'subject line', preview: 'preview text', heading: 'heading', button: 'button', ps: 'P.S.' }[field] ?? field;
}

/** The text of one field of an email. */
export function fieldText(e: LaunchEmail, field: string) {
  if (field.startsWith('body.')) return e.body[Number(field.slice(5))] ?? '';
  return String((e as unknown as Record<string, unknown>)[field] ?? '');
}
