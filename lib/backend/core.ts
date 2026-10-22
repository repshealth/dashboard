import type { Client, DesignFile, FormSubmission, Lead, LeadEvent, Site, SiteComment, SitePage, SiteSource, SiteVersion, SourceId, Viewer } from '../types';
import { absoluteAssets, pageName, type FetchedSite } from '../site/github';
import { STAGE_NAME } from '../constants';
import type { SiteCopy } from '../site/copy';
import { buildSpec, slugify } from '../site/compose';
import { emptyAnswers, emptyLaunch, launchOf, withLaunch, type LaunchDoc, type OnboardingAnswers } from '../site/onboarding';
import { buildPreReg, isPreReg, type AnySpec, type PreRegCopy, type PreRegSpec } from '../site/prereg';
import { LOOKS, type SiteDesign, type SiteSpec } from '../site/spec';
import { makeAmendedVersion, type AmendFn } from '../site/make-amend';
import { buildCampaign } from '../emails/copy';
import { applyRepsEdits, makeAmendedEmails, type EmailAmendFn } from '../emails/amend';
import { clientOfKey, isFlow, latestEmailVersion, pendingEmailVersion, type EmailCampaign, type EmailComment, type LaunchEmail, type MailerLiteSettings, type MailerLiteState } from '../emails/types';
import { meetingKey, parseMeetingText } from '../meetings/parse';
import { matchClient } from '../meetings/match';
import { voiceForPrompt, type Meeting, type VoiceProfile } from '../meetings/types';
import type { DocMeta, DocStore } from './store';
import type { Assignee, FoundTask, Task } from '../tasks/types';
import type { Backend, LoginInfo, Submission } from './types';
import type { StripePublic, StripeSettings } from '../stripe/types';
import { importStripeHistory, type StripeCtx } from '../stripe/apply';
import { hashPassword, passwordProblem, verifyPassword } from './password';
import { SITE_REPOS, STARTER_CLIENTS, STARTER_FLOWS } from '../starter';

/* Records ------------------------------------------------------------------------ */

/** A client as stored. Only the public fields (Client) ever go to the browser. */
export interface ClientRec extends Client {
  contactName?: string;
  contactEmail?: string;
  /** Other addresses the client joins calls from, learnt when calls are assigned. */
  meetingEmails: string[];
  /** User ids with a login to this client account. */
  members: string[];
  createdAt?: string;
}

export interface UserRec {
  id: string;
  email: string;
  name: string;
  isAdmin?: boolean;
  createdAt: string;
  /** Salted PBKDF2 hash (lib/backend/password.ts). Never sent to the browser. */
  passwordHash?: string;
  lastSignIn?: string;
}

export type ViewerRec = Viewer & { id: string };

/** Index fields for each kind of document. */
export const meta = {
  client: (c: ClientRec): DocMeta => ({ key: c.slug, sort: c.name }),
  lead: (l: Lead): DocMeta => ({ clientId: l.clientId, key: `${l.clientId}|${l.email.toLowerCase()}`, sort: l.firstSeen }),
  site: (s: Site): DocMeta => ({ clientId: s.clientId }),
  campaign: (c: EmailCampaign): DocMeta => ({ clientId: c.clientId }),
  submission: (s: Submission): DocMeta => ({ clientId: s.clientId, sort: s.submittedAt }),
  meeting: (m: Meeting): DocMeta => ({ clientId: m.clientId, key: meetingKey(m.title, m.startedAt), sort: m.startedAt }),
  voice: (v: VoiceProfile): DocMeta => ({ clientId: v.clientId }),
  user: (u: UserRec): DocMeta => ({ key: u.email.toLowerCase(), sort: u.createdAt }),
  task: (t: Task): DocMeta => ({ clientId: t.clientId, sort: t.createdAt }),
};

/** The things that differ between example mode and production: Claude, MailerLite, emails. */
export interface Services {
  newId(): string;
  /** Example mode adds a short pause so loading states are visible. */
  pause?(ms: number): Promise<void>;
  /** Whether Claude is connected (needed to rewrite emails in a client's voice). */
  claude: boolean;
  /** The dashboard's public address (APP_URL), when it's set. Used in login details sent to clients. */
  appUrl?: string;
  writeSiteCopy(a: OnboardingAnswers): Promise<{ copy: SiteCopy; by: 'claude' | 'template' }>;
  writePreRegCopy(a: OnboardingAnswers): Promise<{ copy: PreRegCopy; by: 'claude' | 'template' }>;
  writeLaunchEmails(a: OnboardingAnswers, voice: string): Promise<{ emails: LaunchEmail[]; by: 'claude' | 'template' }>;
  amendSite: AmendFn;
  amendEmails(voice: string): EmailAmendFn;
  /** A voice profile from a client's calls. Returns null when it can't do better than an existing one. */
  buildVoice(clientId: string, meetings: Meeting[], names: string[], coach: string, brand: string, existing: VoiceProfile | null): Promise<VoiceProfile | null>;
  scheduleLaunch(c: EmailCampaign, emails: LaunchEmail[]): Promise<MailerLiteState>;
  /** Adds a pre-registered person to the client's pre-reg group in MailerLite. */
  addSubscriber(clientId: string, p: { email: string; name?: string; phone?: string }): Promise<boolean>;
  /** The actions agreed on a call, with who each looks like it's for. */
  findTasks(m: Meeting, clientName: string, coach: string, clientNames: string[]): Promise<FoundTask[]>;
  /** Reads the site's HTML pages from GitHub at the latest commit on a branch. */
  fetchSite(repo: string, branch: string): Promise<FetchedSite>;
  /** Stores one page's HTML and returns the address it can be loaded from. */
  storeHtml(clientId: string, sha: string, path: string, html: string): Promise<string>;
  /** A generated page as one standalone HTML file. */
  renderPage(spec: AnySpec, title: string): string;
  /**
   * Saves a generated page for the team to review in Claude: a stored copy to download and,
   * when it's set up, a commit to the designs repo the "CRM - Website Designs" Project syncs from.
   */
  saveDesign(clientId: string, file: string, html: string): Promise<{ url: string; repoUrl?: string; note: string }>;
  /** The GitHub repo a client's finished site is committed to, e.g. repshealth/strong-with-dani-site. */
  siteRepoFor(slug: string): string | null;
  /** GET from the Stripe API with a client's restricted key. */
  stripeGet?(apiKey: string, path: string): Promise<Record<string, unknown>>;
  /** Emails a client a sign-in link, e.g. when their website or emails are ready. */
  sendInvite(u: UserRec, clientName: string, what: 'website' | 'emails'): Promise<void>;
}

export class AccessError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

/* Access ---------------------------------------------------------------------------- */

/** What a client may see of their website: nothing while it's a draft, and never versions waiting for REPS. */
export function siteForClient(full: Site): Site {
  const { designs: _d, specs: _s, ...s } = full; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (s.status === 'draft') return { ...s, versions: [] };
  return { ...s, versions: s.versions.filter((v) => (v.state ?? 'published') === 'published') };
}
export function campaignForClient(c: EmailCampaign): EmailCampaign {
  const { mailerlite, ...rest } = c;
  const safe = { ...rest, mailerlite: { state: mailerlite.state, note: '' } } as EmailCampaign;
  if (c.status === 'draft') return { ...safe, versions: [] };
  return { ...safe, versions: c.versions.filter((v) => v.state === 'published') };
}
const publicClient = (c: ClientRec): Client => ({ id: c.id, slug: c.slug, name: c.name, growthNote: c.growthNote, revenueNote: c.revenueNote });

/* Shared steps used by the backend and by public endpoints ----------------------------- */

/** Adds or updates a user by email. */
export async function ensureUser(store: DocStore, services: Services, email: string, name: string): Promise<UserRec> {
  const e = email.trim().toLowerCase();
  const found = await store.byKey<UserRec>('user', e);
  if (found) return found.doc;
  const u: UserRec = { id: services.newId(), email: e, name: name || e, createdAt: new Date().toISOString() };
  await store.put('user', u.id, u, meta.user(u));
  return u;
}

/**
 * Checks an email and password against the stored logins. Returns the user, or null for a wrong
 * email or password (the same either way, so it doesn't reveal who has a login).
 */
export async function checkLogin(store: DocStore, email: string, password: string): Promise<UserRec | null> {
  const found = await store.byKey<UserRec>('user', email.trim().toLowerCase());
  const ok = await verifyPassword(password, found?.doc.passwordHash ?? 'pbkdf2$100000$AAAAAAAAAAAAAAAAAAAAAA==$x');
  if (!found || !ok) return null;
  await store.mutate<UserRec>('user', found.id, (u) => { u.lastSignIn = new Date().toISOString(); }, meta.user);
  return found.doc;
}

const SOURCE_FORM: Record<string, string> = { quiz: 'Quiz', magnet: 'Lead magnet', survey: 'Survey', ads: 'Ad form', news: 'Newsletter', prereg: 'Pre-registration', stripe: 'Stripe checkout' };

/**
 * The lead forms on a site's pages, by the name each one sends with its leads: a `form: '…'`
 * in the page's script (sites made in Claude), a data-form attribute (the dashboard's own
 * designs) or a hidden input named form.
 */
export function formsInPages(files: { path: string; html: string }[]) {
  const found = new Map<string, string>();
  const add = (name: string, page: string) => {
    const n = name.replace(/\s+/g, ' ').trim();
    if (n.length >= 3 && n.length <= 60 && !found.has(n.toLowerCase())) found.set(n.toLowerCase(), JSON.stringify({ name: n, page }));
  };
  for (const f of files) {
    const page = '/' + f.path.replace(/(^|\/)index\.html?$/i, '$1').replace(/\.html?$/i, '');
    // Only look at scripts that post somewhere, so an unrelated "form:" in other code is ignored.
    for (const m of f.html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)) {
      if (!/fetch\(|XMLHttpRequest|sendBeacon/.test(m[1])) continue;
      for (const x of m[1].matchAll(/\bform\s*:\s*(['"])([^'"\n]{3,60})\1/g)) add(x[2], page);
    }
    for (const x of f.html.matchAll(/\bdata-form=(['"])([^'"]{3,60})\1/g)) add(x[2], page);
    for (const x of f.html.matchAll(/<input[^>]*name=(['"])form\1[^>]*value=(['"])([^'"]{3,60})\2/gi)) add(x[3], page);
  }
  return [...found.values()].map((v) => JSON.parse(v) as { name: string; page: string });
}

const stripePublic = (clientId: string, s: StripeSettings | null): StripePublic | null => (s ? {
  clientId, connected: Boolean(s.signingSecret), hasKey: Boolean(s.apiKey), connectedAt: s.connectedAt, lastEventAt: s.lastEventAt, lastNote: s.lastNote,
} : null);

/** What the Stripe code needs to read and update a client's leads. */
export function stripeCtx(store: DocStore, services: Services, clientId: string, s: StripeSettings | null): StripeCtx {
  const key = s?.apiKey;
  return {
    store, clientId, newId: () => services.newId(), meta,
    get: key && services.stripeGet ? (path: string) => services.stripeGet!(key, path) : undefined,
  };
}

/** A lead from a website or pre-registration form. A returning email adds to the timeline instead. */
export async function captureLead(store: DocStore, services: Services, input: {
  slug: string; email: string; name?: string; phone?: string; source: SourceId; form?: string; page?: string; utm?: string;
  answers?: [string, string][];
}) {
  const client = await store.byKey<ClientRec>('client', input.slug);
  if (!client) throw new AccessError('Unknown client.', 404);
  const clientId = client.id;
  const email = input.email.toLowerCase();
  const label = input.form ? `Submitted ${input.form}` : input.page ? `Submitted a form on ${input.page}` : 'Submitted a website form';
  const event = (l: string, source = 'Website'): LeadEvent => ({ id: services.newId(), label: l, source, at: new Date().toISOString() });
  const titles: Record<string, string> = { quiz: 'QUIZ ANSWERS', magnet: 'LEAD MAGNET', survey: 'SURVEY ANSWERS', ads: 'FORM ANSWERS', news: 'SIGNUP', prereg: 'PRE-REGISTRATION' };

  // Answers are kept per form, so a quiz and a calculator from the same person stay apart.
  const formName = (input.form || '').trim() || SOURCE_FORM[input.source] || 'Website form';
  const sub: FormSubmission | null = input.answers?.length || input.form
    ? { form: formName, source: input.source, page: input.page || undefined, at: new Date().toISOString(), answers: input.answers ?? [] }
    : null;

  const existing = await store.byKey<Lead>('lead', `${clientId}|${email}`);
  let lead: Lead;
  if (existing) {
    lead = (await store.mutate<Lead>('lead', existing.id, (l) => {
      l.events.unshift(event(label));
      if (input.answers?.length) l.answers = input.answers;
      if (sub) l.submissions = [sub, ...(l.submissions ?? []).filter((x) => x.form !== sub.form)];
      if (!l.phone && input.phone) l.phone = input.phone;
      if (!l.form && input.form) l.form = input.form;
    }, meta.lead))!;
  } else {
    lead = {
      id: services.newId(), clientId, name: input.name || email, email, phone: input.phone || undefined, source: input.source,
      form: input.form || undefined,
      stage: 'new', page: input.page || undefined, utm: input.utm || undefined, firstSeen: new Date().toISOString(), value: 0,
      detail: input.answers?.[0] ? `${input.answers[0][0]}: ${input.answers[0][1]}` : input.form || undefined,
      answersTitle: titles[input.source], answers: input.answers ?? [], submissions: sub ? [sub] : [], events: [event(label)],
    };
    await store.put('lead', lead.id, lead, meta.lead(lead));
  }
  // Pre-registrations join the pre-reg group in MailerLite, which the pre-reg launch emails go to.
  if (input.source === 'prereg' && (await services.addSubscriber(clientId, { email, name: input.name, phone: input.phone }))) {
    await store.mutate<Lead>('lead', lead.id, (l) => {
      l.mailerlite = 'Pre-reg group';
      if (l.stage === 'new') l.stage = 'nurture';
      l.events.unshift(event('Added to the pre-registration emails', 'MailerLite'));
    }, meta.lead);
  }
  return lead.id;
}

/** Rebuilds a client's voice profile from their calls. */
export async function refreshVoiceFor(store: DocStore, services: Services, clientId: string) {
  const [meetings, client, subs, existing] = await Promise.all([
    store.list<Meeting>('meeting', { clientId, limit: 12 }),
    store.get<ClientRec>('client', clientId),
    store.list<Submission>('submission', { clientId, limit: 1 }),
    store.get<VoiceProfile>('voice', clientId),
  ]);
  const withWords = meetings.filter((m) => m.transcript.length);
  if (!withWords.length) return existing;
  const a = subs[0]?.answers;
  const coach = a?.business.coachName || client?.contactName || client?.name || 'the coach';
  const names = [coach, a?.contact.name, client?.contactName].filter(Boolean) as string[];
  const v = await services.buildVoice(clientId, withWords, names, coach, client?.name ?? '', existing);
  if (!v) return existing;
  await store.put('voice', clientId, v, meta.voice(v));
  return v;
}

/** Pulls suggested tasks from a client's call into the agency review queue (once per call). */
export async function tasksFromMeeting(store: DocStore, services: Services, meetingId: string, force = false) {
  const m = await store.get<Meeting>('meeting', meetingId);
  if (!m?.clientId || (m.tasksFound && !force)) return 0;
  const [client, subs] = await Promise.all([store.get<ClientRec>('client', m.clientId), store.list<Submission>('submission', { clientId: m.clientId, limit: 1 })]);
  const a = subs[0]?.answers;
  const coach = a?.business.coachName || client?.contactName || client?.name || 'the client';
  const names = [coach, a?.contact.name, client?.contactName].filter(Boolean) as string[];
  const found = await services.findTasks(m, client?.name ?? '', coach, names);
  const existing = force ? (await store.list<Task>('task', { clientId: m.clientId })).filter((t) => t.meetingId === m.id) : [];
  const seen = new Set(existing.map((t) => t.title.toLowerCase()));
  let n = 0;
  for (const f of found) {
    if (!f.title.trim() || seen.has(f.title.toLowerCase())) continue;
    const t: Task = {
      id: services.newId(), clientId: m.clientId, title: f.title.trim(), detail: f.detail || undefined, quote: f.quote || undefined,
      meetingId: m.id, meetingTitle: m.title, meetingAt: m.startedAt, status: 'suggested', assignee: null, suggested: f.suggested,
      createdAt: new Date().toISOString(), source: 'meeting',
    };
    await store.put('task', t.id, t, meta.task(t));
    n++;
  }
  await store.mutate<Meeting>('meeting', m.id, (x) => { x.tasksFound = true; }, meta.meeting);
  return n;
}

/**
 * Pulls the latest version of a client's site from their GitHub repo. A new commit becomes
 * a new version: waiting in Approvals, or straight to the client if the team chose that.
 */
/** "Strong With Dani - Website Page" */
export const designName = (client: string, key: DesignFile['key']) =>
  `${client.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim()} - ${key === 'home' ? 'Website Page' : 'Pre-registration Page'}`;

/** True when a site's pages are drawn by the dashboard (older clients), not committed from Claude. */
export const isTemplateSite = (s: Site) => s.versions.some((v) => v.pages.some((p) => p.kind === 'template'));

/**
 * Saves generated pages as HTML for the team to review in Claude, and remembers what they were
 * made from. Nothing appears in the client's Website section until the final design is
 * committed to their site repo.
 */
export async function saveDesigns(store: DocStore, services: Services, clientId: string, clientName: string, specs: { home?: SiteSpec; prereg?: PreRegSpec }, note: string) {
  const saved: DesignFile[] = [];
  for (const key of ['home', 'prereg'] as const) {
    const spec = specs[key];
    if (!spec) continue;
    const name = designName(clientName, key);
    const html = services.renderPage(spec, key === 'home' ? clientName : `Pre-registration | ${clientName}`);
    const r = await services.saveDesign(clientId, `${name}.html`, html);
    saved.push({ key, name, file: `${name}.html`, url: r.url, repoUrl: r.repoUrl, design: isPreReg(spec) ? undefined : spec.design, savedAt: new Date().toISOString(), note: [note, r.note].filter(Boolean).join(' ') });
  }
  await store.mutate<Site>('site', clientId, (x) => {
    x.specs = { ...(x.specs ?? {}), ...specs };
    x.designs = [...saved, ...(x.designs ?? []).filter((d) => !saved.some((n) => n.key === d.key))]
      .sort((a, b) => (a.key === b.key ? 0 : a.key === 'home' ? -1 : 1));
  }, meta.site);
  return saved;
}

export async function syncSiteFromGitHub(store: DocStore, services: Services, clientId: string) {
  const s = await store.get<Site>('site', clientId);
  const src = s?.github;
  if (!s || !src?.repo) throw new AccessError('Connect a GitHub repo for this website first.', 400);
  let fetched: FetchedSite;
  try {
    fetched = await services.fetchSite(src.repo, src.branch || 'main');
  } catch (e) {
    const note = e instanceof Error ? e.message : String(e);
    await store.mutate<Site>('site', clientId, (x) => { if (x.github) Object.assign(x.github, { lastSync: new Date().toISOString(), lastNote: note }); }, meta.site);
    throw new AccessError(note, 502);
  }
  if (fetched.sha === src.lastSha) {
    await store.mutate<Site>('site', clientId, (x) => { if (x.github) Object.assign(x.github, { lastSync: new Date().toISOString(), lastNote: 'Up to date' }); }, meta.site);
    return { added: false, note: 'Already up to date.' };
  }
  const pages: SitePage[] = [];
  for (const f of fetched.files) {
    const htmlUrl = await services.storeHtml(clientId, fetched.sha, f.path, absoluteAssets(f.html, src.repo, fetched.sha, f.path));
    const name = pageName(f.path, f.html);
    pages.push({ id: services.newId(), key: f.path, name, path: ` · ${name}`, kind: 'html', htmlUrl });
  }
  let added: SiteVersion | null = null;
  await store.mutate<Site>('site', clientId, (x) => {
    const n = `v${x.versions.filter((v) => v.state !== 'rejected').length + 1}`;
    const base = x.versions.find((v) => (v.state ?? 'published') === 'published');
    // The first commit is the design the team signed off in Claude: show it straight away.
    // It stays REPS-only while the site is a draft.
    const auto = Boolean(x.github?.autoPublish) || !base;
    added = {
      id: services.newId(), version: n, label: `${n} · ${fetched.message || 'Updated in Claude'}`.slice(0, 120),
      sentNote: auto ? 'Updated in Claude just now' : 'Updated in Claude, waiting for REPS approval',
      pages, comments: [], state: auto ? 'published' : 'pending', basedOn: base?.id, createdAt: new Date().toISOString(),
      summary: fetched.message || 'Website updated in Claude.', changes: [], unresolved: [],
      commit: { sha: fetched.sha, message: fetched.message, url: fetched.url },
    };
    // Only the newest update waits for approval.
    x.versions.forEach((v) => { if (v.state === 'pending' && v.commit) v.state = 'rejected'; });
    x.versions.unshift(added);
    if (auto && x.status !== 'draft') { x.status = 'review'; x.statusNote = `${n} sent for review just now`; }
    if (!base && x.status === 'draft') x.statusNote = 'Committed from Claude. Check it over, then send it to the client.';
    if (x.github) Object.assign(x.github, { lastSha: fetched.sha, lastSync: new Date().toISOString(), lastNote: `Added ${n}` });
    x.forms = formsInPages(fetched.files);
  }, meta.site);
  return { added: true, note: `${(added as SiteVersion | null)?.version ?? 'A new version'} added from GitHub.` };
}

/** "Latest from GitHub: <commit message>" on a starting client's website. */
export const starterNote = (store: DocStore, clientId: string) => store.mutate<Site>('site', clientId, (x) => {
  const v = x.versions[0];
  if (v?.commit) { x.statusNote = `Latest from GitHub: ${v.commit.message}`; v.sentNote = 'From the latest commit on GitHub'; }
}, meta.site);

/**
 * Adds the starting clients (lib/starter.ts) to an empty database, connects each website to its
 * GitHub repo and pulls the latest commit. Each one is added once: a marker stops it being added again.
 */
export async function seedStarter(store: DocStore, services: Services) {
  for (const c of STARTER_CLIENTS) {
    // Each starting client is added once, so ones added to the list later still arrive.
    const mark = `starter:${c.slug}`;
    if (await store.get('setting', mark)) continue;
    await store.put('setting', mark, { at: new Date().toISOString() }, {});
    if (await store.byKey('client', c.slug)) continue;
    const client: ClientRec = {
      id: c.id, slug: c.slug, name: c.name, growthNote: 'Site not live yet', revenueNote: 'No sales yet',
      contactName: c.contactName, meetingEmails: [], members: [], createdAt: new Date().toISOString(),
    };
    await store.put('client', client.id, client, meta.client(client));
    const site: Site = {
      clientId: c.id, status: 'review', statusNote: 'Latest version from GitHub', contact: c.contactName, domain: c.name, versions: [],
      github: { repo: c.repo, branch: c.branch, autoPublish: false },
    };
    await store.put('site', c.id, site, meta.site(site));
    await syncSiteFromGitHub(store, services, c.id).catch((e) => console.error('Starter sync failed', c.repo, e));
    await starterNote(store, c.id);
  }
  await seedFlows(store, services);
  await linkSiteRepos(store, services);
}

/** Connects clients' websites to the repos listed in SITE_REPOS (once each) and pulls the latest commit. */
export async function linkSiteRepos(store: DocStore, services: Services) {
  const norm = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  let clients: ClientRec[] | null = null;
  for (const r of SITE_REPOS) {
    const mark = `site-repo:${norm(r.name)}:${r.repo}`;
    if (await store.get('setting', mark)) continue;
    clients ??= await store.list<ClientRec>('client');
    const c = clients.find((x) => norm(x.name) === norm(r.name));
    if (!c) continue; // Not signed up yet: try again next time.
    const s = await store.get<Site>('site', c.id);
    if (!s) continue;
    await store.put('setting', mark, { at: new Date().toISOString() }, {});
    if (s.github?.repo !== r.repo) {
      await store.mutate<Site>('site', c.id, (x) => { x.github = { repo: r.repo, branch: r.branch, autoPublish: x.github?.autoPublish ?? false }; }, meta.site);
    }
    await syncSiteFromGitHub(store, services, c.id).catch((e) => console.error('Site repo link failed', r.repo, e));
  }
  for (const r of SITE_REPOS) {
    if (!r.publish) continue;
    const mark = `site-publish:${norm(r.name)}:${r.publish}`;
    if (await store.get('setting', mark)) continue;
    clients ??= await store.list<ClientRec>('client');
    const c = clients.find((x) => norm(x.name) === norm(r.name));
    if (!c || (await store.get<Site>('site', c.id))?.github?.repo !== r.repo) continue;
    try {
      await syncSiteFromGitHub(store, services, c.id);
    } catch (e) {
      console.error('Publish sync failed, will try again', r.repo, e);
      continue; // e.g. GitHub limiting checks: try again next time
    }
    await publishPendingCommit(store, c.id);
    await store.put('setting', mark, { at: new Date().toISOString() }, {});
  }
}

/** Makes the newest version from GitHub waiting in Approvals the one shown in the Website section. */
export async function publishPendingCommit(store: DocStore, clientId: string) {
  await store.mutate<Site>('site', clientId, (x) => {
    const ver = x.versions.find((v) => v.state === 'pending' && v.commit);
    if (!ver) return;
    ver.state = 'published';
    ver.sentNote = 'Latest from GitHub, added by the REPS team';
    x.versions.filter((y) => y.id === ver.basedOn).forEach((b) => b.comments.forEach((cm) => { if (!cm.resolved) Object.assign(cm, { resolved: true, outcome: 'done', closedAt: new Date().toISOString() }); }));
    x.versions = [ver, ...x.versions.filter((y) => y.id !== ver.id)];
    if (x.status !== 'draft') { x.status = 'review'; x.statusNote = `${ver.version} ready to review: your changes have been made`; }
  }, meta.site);
}

/** Adds the starting follow-up flows, once each, to clients that exist. */
export async function seedFlows(store: DocStore, services: Pick<Services, 'newId'>) {
  for (const f of STARTER_FLOWS) {
    const key = `${f.clientId}~${f.flowId}`;
    const mark = `starter-flow:${key}`;
    if (await store.get('setting', mark)) continue;
    if (!(await store.get('client', f.clientId))) continue;
    await store.put('setting', mark, { at: new Date().toISOString() }, {});
    if (await store.get('campaign', key)) continue;
    const c = f.make(f.clientId, services.newId());
    await store.put('campaign', key, c, meta.campaign(c));
  }
}

/** One Google Meet notes doc or transcript. Notes and transcript of the same call merge into one meeting. */
export async function ingestMeetingDoc(store: DocStore, services: Services, d: {
  docId?: string; title: string; text: string; url?: string; attendees?: string[]; startedAt?: string | null; endedAt?: string | null;
  source: 'gemini' | 'pasted'; clientId?: string | null; ownDomains?: string[];
}) {
  if (d.docId) {
    const seen = await store.get<{ meetingId: string }>('meetingdoc', d.docId);
    if (seen) return { id: seen.meetingId, clientId: (await store.get<Meeting>('meeting', seen.meetingId))?.clientId ?? null, duplicate: true };
  }
  const p = parseMeetingText(d.text, d.title);
  const startedAt = d.startedAt || p.startedAt || new Date().toISOString();
  const title = p.title || d.title;
  const attendees = (d.attendees ?? []).map((e) => e.toLowerCase());
  const duration = d.startedAt && d.endedAt ? Math.round((Date.parse(d.endedAt) - Date.parse(d.startedAt)) / 6e4) : p.durationMins;
  let clientId = d.clientId;
  if (clientId === undefined) {
    const clients = await store.list<ClientRec>('client');
    clientId = matchClient(
      clients.map((c) => ({ id: c.id, name: c.name, slug: c.slug, emails: [c.contactEmail ?? '', ...c.meetingEmails].filter(Boolean) })),
      { title, attendees }, d.ownDomains ?? [],
    );
  }

  const same = await store.byKey<Meeting>('meeting', meetingKey(title, startedAt));
  let m: Meeting;
  if (same) {
    m = (await store.mutate<Meeting>('meeting', same.id, (x) => {
      x.summary ||= p.summary;
      if (!x.details.length) x.details = p.details;
      if (!x.nextSteps.length) x.nextSteps = p.nextSteps;
      if (p.transcript.length > x.transcript.length) x.transcript = p.transcript;
      x.attendees = [...new Set([...x.attendees, ...attendees])];
      x.durationMins ??= duration;
      x.clientId ??= clientId ?? null;
      x.docUrl ??= d.url;
    }, meta.meeting))!;
  } else {
    m = {
      id: services.newId(), clientId: clientId ?? null, title, startedAt, durationMins: duration, attendees, docUrl: d.url,
      summary: p.summary, details: p.details, nextSteps: p.nextSteps, transcript: p.transcript, visibleToClient: true, source: d.source,
    };
    await store.put('meeting', m.id, m, meta.meeting(m));
  }
  if (d.docId) await store.put('meetingdoc', d.docId, { meetingId: m.id });
  if (m.clientId) {
    await refreshVoiceFor(store, services, m.clientId).catch((e) => console.error('Voice profile failed:', e));
    await tasksFromMeeting(store, services, m.id).catch((e) => console.error('Finding tasks failed:', e));
  }
  return { id: m.id, clientId: m.clientId, duplicate: false, meeting: m };
}

/**
 * Builds a client's launch from their intake answers and the team's launch setup: the website
 * gets its pricing and offer, the pre-registration page is made, and both email sequences are
 * written. Drafts are updated in place; anything the client has already seen gets a new version
 * that waits for REPS approval. Returns a line per thing done, for the team.
 */
export async function buildLaunch(store: DocStore, services: Services, clientId: string): Promise<string[]> {
  const [launch, subs, client, voice] = await Promise.all([
    store.get<LaunchDoc>('launch', clientId), store.list<Submission>('submission', { clientId, limit: 1 }),
    store.get<ClientRec>('client', clientId), store.get<VoiceProfile>('voice', clientId),
  ]);
  if (!launch) throw new AccessError('Fill in the launch setup first.', 400);
  if (!subs[0] || !client) throw new AccessError('This client has no intake form yet.', 400);
  const a = withLaunch(subs[0].answers, launch.setup);
  if (!launchOf(a).date) throw new AccessError('Add the launch date first.', 400);
  const notes: string[] = [];

  const [site1, pre, mail] = await Promise.all([services.writeSiteCopy(a), services.writePreRegCopy(a), services.writeLaunchEmails(a, voiceForPrompt(voice))]);
  const spec = buildSpec(a, site1.copy, client.slug);
  const prereg = buildPreReg(a, pre.copy, spec);

  const current = await store.get<Site>('site', clientId);
  if (current && !isTemplateSite(current)) {
    // Sites made in Claude: refresh the design files for the team to review and commit.
    if (current.specs?.home?.design) spec.design = current.specs.home.design;
    const saved = await saveDesigns(store, services, clientId, client.name, { home: spec, prereg }, 'Updated with the launch setup.');
    const repo = current.github?.repo;
    notes.push(`${saved.map((d) => `"${d.file}"`).join(' and ')} saved for review in Claude.${repo ? ` Commit them to ${repo} when they're ready and they'll appear in the Website section.` : ''}`);
  } else await store.mutate<Site>('site', clientId, (x) => {
    const latest = x.versions.find((v) => (v.state ?? 'published') === 'published');
    const keep = (key: string) => latest?.pages.find((p) => p.key === key)?.id ?? services.newId();
    // Keep the look the team picked for this client.
    const before = latest?.pages.find((p) => p.key === 'home')?.spec;
    if (before && !isPreReg(before) && before.design && before.design !== 'shapeup') spec.design = before.design;
    const pages = [
      { id: keep('home'), key: 'home', name: 'Homepage', path: ' · Homepage', kind: 'template' as const, spec },
      { id: keep('prereg'), key: 'prereg', name: 'Pre-registration', path: ' · Pre-registration', kind: 'template' as const, spec: prereg },
    ];
    if (x.status === 'draft' && latest) {
      latest.pages = pages;
      latest.sentNote = 'Built from the intake form and launch setup';
      x.statusNote = 'Launch setup added. Check it over, then send it to the client.';
      notes.push('Website draft updated with the offer and pricing, and the pre-registration page added.');
    } else {
      const n = `v${x.versions.filter((v) => v.state !== 'rejected').length + 1}`;
      x.versions.forEach((v) => { if (v.state === 'pending') v.state = 'rejected'; });
      x.versions.unshift({
        id: services.newId(), version: n, label: `${n} · Launch details added`, state: 'pending', basedOn: latest?.id,
        sentNote: 'Updated from the launch setup', createdAt: new Date().toISOString(), pages, comments: [],
        summary: 'Offer, pricing and pre-registration page added from the launch setup.', changes: [], unresolved: [],
      });
      notes.push(`Website ${n} with the offer and pre-registration page is waiting in Approvals.`);
    }
  }, meta.site);

  const existing = await store.get<EmailCampaign>('campaign', clientId);
  if (!existing || existing.status === 'draft') {
    const c = buildCampaign(a, clientId, mail.emails, mail.by);
    c.versions[0].id = services.newId();
    if (mail.by === 'claude') c.versions[0].sentNote = 'Written by Claude from the intake form and launch setup';
    await store.put('campaign', clientId, c, meta.campaign(c));
    notes.push(existing ? 'Launch emails rewritten (still a draft).' : 'Both launch email sequences written as a draft.');
  } else {
    await store.mutate<EmailCampaign>('campaign', clientId, (c) => Object.assign(c, {
      launchDate: launchOf(a).date, websiteUrl: launchOf(a).websiteUrl, discountCode: launchOf(a).code, offer: launchOf(a).offer,
    }), meta.campaign);
    notes.push('The client has already seen their emails, so only the launch date, link and code were updated. Use Rewrite in Agency · Emails if the copy needs to change.');
  }
  return notes;
}

/* The backend ------------------------------------------------------------------------- */

/**
 * Every dashboard action, with its access rules. The browser calls these through
 * /api/rpc in production, or directly against the example data in the preview.
 */
export function createBackend(store: DocStore, services: Services, who: () => Promise<ViewerRec | null>, mode: 'demo' | 'live'): Backend {
  const wait = <T,>(x: T, ms = 120) => (services.pause ? services.pause(ms).then(() => x) : Promise.resolve(x));
  const signedIn = async () => {
    const v = await who();
    if (!v) throw new AccessError('Please sign in again.', 401);
    return v;
  };
  const admin = async () => {
    const v = await signedIn();
    if (!v.isAdmin) throw new AccessError('Only the REPS team can do that.');
    return v;
  };
  /** The viewer, if they may see this client's account. */
  const access = async (clientId: string) => {
    const v = await signedIn();
    if (v.isAdmin) return v;
    const c = await store.get<ClientRec>('client', clientId);
    if (!c || !c.members.includes(v.id)) throw new AccessError('You don’t have access to this account.');
    return v;
  };
  const actor = (v: ViewerRec) => (v.isAdmin ? 'REPS team' : v.name);
  const leadClient = async (leadId: string) => {
    const l = await store.get<Lead>('lead', leadId);
    if (!l) throw new AccessError('Lead not found.', 404);
    await access(l.clientId);
    return l;
  };
  const site = (clientId: string, fn: (s: Site) => void) => store.mutate<Site>('site', clientId, fn, meta.site);
  /** Launch emails are keyed by client id; follow-up flows by "<clientId>~<flowId>". */
  const campaign = (key: string, fn: (c: EmailCampaign) => void) => store.mutate<EmailCampaign>('campaign', key, fn, meta.campaign);
  const inviteFor = async (clientId: string, what: 'website' | 'emails') => {
    const c = await store.get<ClientRec>('client', clientId);
    if (!c?.contactEmail) return;
    const u = await ensureUser(store, services, c.contactEmail, c.contactName || c.name);
    if (!c.members.includes(u.id)) await store.mutate<ClientRec>('client', clientId, (x) => { x.members = [...new Set([...x.members, u.id])]; }, meta.client);
    await services.sendInvite(u, c.name, what);
  };

  return {
    mode,

    async getViewer() {
      const v = await who();
      return v ? { name: v.name, email: v.email, isAdmin: v.isAdmin } : null;
    },
    async signIn() {
      throw new AccessError('Sign in through /api/auth/login.', 400);
    },
    async signOut() {},

    /* Logins (agency only) */
    async getAppUrl() {
      await admin();
      return services.appUrl ? services.appUrl.replace(/\/$/, '') : null;
    },
    async listLogins() {
      await admin();
      const [users, clients] = await Promise.all([store.list<UserRec>('user'), store.list<ClientRec>('client')]);
      return wait(users.map((u): LoginInfo => ({
        id: u.id, name: u.name, email: u.email, isAdmin: Boolean(u.isAdmin), hasPassword: Boolean(u.passwordHash),
        clientIds: clients.filter((c) => c.members.includes(u.id)).map((c) => c.id), createdAt: u.createdAt, lastSignIn: u.lastSignIn,
      })).sort((a, b) => Number(b.isAdmin) - Number(a.isAdmin) || a.name.localeCompare(b.name)));
    },
    async saveLogin(x) {
      const v = await admin();
      const email = String(x.email || '').trim().toLowerCase();
      const name = String(x.name || '').trim();
      if (!name) throw new AccessError('Please add their name.', 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccessError('Please add a valid email address.', 400);
      if (x.password) { const p = passwordProblem(x.password); if (p) throw new AccessError(p, 400); }
      const same = await store.byKey<UserRec>('user', email);
      if (same && same.id !== x.id) throw new AccessError('There is already a login with that email.', 400);
      let u: UserRec;
      if (x.id) {
        const cur = await store.get<UserRec>('user', x.id);
        if (!cur) throw new AccessError('Login not found.', 404);
        if (cur.isAdmin && cur.id !== v.id) throw new AccessError('Agency logins are managed in Cloudflare.', 400);
        const passwordHash = x.password ? await hashPassword(x.password) : cur.passwordHash;
        u = (await store.mutate<UserRec>('user', x.id, (d) => Object.assign(d, { name, email, passwordHash }), meta.user))!;
      } else {
        if (!x.password) throw new AccessError('Please set a password.', 400);
        u = { id: services.newId(), email, name, createdAt: new Date().toISOString(), passwordHash: await hashPassword(x.password) };
        await store.put('user', u.id, u, meta.user(u));
      }
      // Which client accounts they can open. Agency logins already see everything.
      const want = new Set(u.isAdmin ? [] : x.clientIds ?? []);
      for (const c of await store.list<ClientRec>('client')) {
        const has = c.members.includes(u.id);
        if (has !== want.has(c.id)) await store.mutate<ClientRec>('client', c.id, (d) => { d.members = want.has(c.id) ? [...new Set([...d.members, u.id])] : d.members.filter((m) => m !== u.id); }, meta.client);
      }
      return wait({ id: u.id, name: u.name, email: u.email, isAdmin: Boolean(u.isAdmin), hasPassword: Boolean(u.passwordHash), clientIds: [...want], createdAt: u.createdAt, lastSignIn: u.lastSignIn });
    },
    /* Stripe (agency only) */
    async getStripe(clientId) {
      await admin();
      return wait(stripePublic(clientId, await store.get<StripeSettings>('stripe', clientId)));
    },
    async saveStripe(clientId, x) {
      await admin();
      if (!(await store.get<ClientRec>('client', clientId))) throw new AccessError('Client not found.', 404);
      if (x.disconnect) { await store.del('stripe', clientId); return null; }
      const old = await store.get<StripeSettings>('stripe', clientId);
      const secret = String(x.signingSecret ?? '').trim();
      const key = String(x.apiKey ?? '').trim();
      if (secret && !/^whsec_\w{10,}$/.test(secret)) throw new AccessError('The signing secret starts with whsec_. Copy it again from the webhook in Stripe.', 400);
      if (key && !/^(rk|sk)_(live|test)_\w{10,}$/.test(key)) throw new AccessError('The key starts with rk_live_ (a restricted key). Copy it again from Stripe.', 400);
      const signingSecret = secret || old?.signingSecret || '';
      if (!signingSecret) throw new AccessError('Paste the signing secret from Stripe first.', 400);
      const s: StripeSettings = { ...(old ?? {}), clientId, signingSecret, apiKey: key || old?.apiKey, connectedAt: old?.connectedAt ?? new Date().toISOString() };
      await store.put('stripe', clientId, s, { clientId });
      return stripePublic(clientId, s);
    },
    async importStripe(clientId) {
      await admin();
      const s = await store.get<StripeSettings>('stripe', clientId);
      if (!s?.apiKey || !services.stripeGet) throw new AccessError('Add a read-only Stripe key first.', 400);
      const r = await importStripeHistory(stripeCtx(store, services, clientId, s));
      await store.mutate<StripeSettings>('stripe', clientId, (x) => { x.lastNote = r.note; x.lastEventAt = new Date().toISOString(); }, () => ({ clientId }));
      return wait(r, 300);
    },
    async removeLogin(id) {
      const v = await admin();
      const u = await store.get<UserRec>('user', id);
      if (!u) return;
      if (u.isAdmin || u.id === v.id) throw new AccessError('Agency logins are managed in Cloudflare.', 400);
      for (const c of await store.list<ClientRec>('client', {})) {
        if (c.members.includes(id)) await store.mutate<ClientRec>('client', c.id, (d) => { d.members = d.members.filter((m) => m !== id); }, meta.client);
      }
      await store.del('user', id);
    },

    async listClients() {
      const v = await signedIn();
      if (v.isAdmin) await seedStarter(store, services).catch((e) => console.error('Starter data failed', e));
      const all = await store.list<ClientRec>('client');
      const mine = v.isAdmin ? all : all.filter((c) => c.members.includes(v.id));
      return wait(mine.map(publicClient).sort((a, b) => a.name.localeCompare(b.name)));
    },
    async listLeads(clientId) {
      await access(clientId);
      return wait(await store.list<Lead>('lead', { clientId }));
    },
    async moveLead(lead, stage) {
      const l = await leadClient(lead.id);
      const v = await signedIn();
      const event: LeadEvent = { id: services.newId(), label: `Moved to ${STAGE_NAME[stage]} manually`, source: actor(v), at: new Date().toISOString() };
      await store.mutate<Lead>('lead', l.id, (x) => { x.stage = stage; x.events.unshift(event); }, meta.lead);
      return event;
    },
    async saveNotes(leadId, notes) {
      await leadClient(leadId);
      await store.mutate<Lead>('lead', leadId, (x) => { x.notes = notes; }, meta.lead);
    },

    /* Website */
    async getSite(clientId) {
      const v = await access(clientId);
      const s = await store.get<Site>('site', clientId);
      return wait(s ? (v.isAdmin ? s : siteForClient(s)) : null);
    },
    async addComment(c) {
      const v = await access(c.clientId);
      const s = await store.get<Site>('site', c.clientId);
      if (!s || (!v.isAdmin && s.status === 'draft')) throw new AccessError('This website isn’t ready for comments yet.');
      const { clientId, ...rest } = c;
      const saved: SiteComment = {
        ...rest, author: actor(v), role: v.isAdmin ? 'agency' : 'client', resolved: false,
        text: rest.text.slice(0, 4000), id: services.newId(), createdAt: new Date().toISOString(),
      };
      const ok = await site(clientId, (x) => {
        const ver = x.versions.find((y) => y.pages.some((p) => p.id === c.pageId) && (v.isAdmin || (y.state ?? 'published') === 'published'));
        ver?.comments.push(saved);
      });
      if (!ok) throw new AccessError('Website not found.', 404);
      return saved;
    },
    async setCommentResolved(clientId, commentId, resolved) {
      await access(clientId);
      await site(clientId, (x) => x.versions.forEach((ver) => ver.comments.forEach((c) => { if (c.id === commentId) c.resolved = resolved; })));
    },
    async approveSite(clientId, versionId) {
      const v = await access(clientId);
      await site(clientId, (x) => {
        if (x.status === 'draft' && !v.isAdmin) throw new AccessError('This website isn’t ready yet.');
        x.versions.filter((ver) => ver.id === versionId).forEach((ver) => ver.comments.forEach((c) => (c.resolved = true)));
        x.status = 'approved';
        x.statusNote = `Approved just now by ${actor(v)}`;
      });
    },
    async sendSiteToClient(clientId) {
      await admin();
      await site(clientId, (x) => { x.status = 'review'; x.statusNote = 'Sent for review just now by REPS team'; });
      await inviteFor(clientId, 'website');
    },
    async requestChanges(clientId, versionId) {
      const v = await access(clientId);
      const s = await store.get<Site>('site', clientId);
      const base = s?.versions.find((x) => x.id === versionId && (x.state ?? 'published') === 'published');
      if (!s || !base) throw new AccessError('Website not found.', 404);
      if (s.status === 'draft' && !v.isAdmin) throw new AccessError('This website isn’t ready yet.');
      const open = base.comments.filter((c) => !c.resolved).length;
      if (!open) return { open: 0, pending: null };
      // The amend can take a minute with Claude. It runs before the reply, so nothing is lost if the worker stops.
      const pending = await makeAmendedVersion(s, base, services.amendSite, services.newId);
      await site(clientId, (x) => {
        x.status = 'changes';
        x.statusNote = `Changes requested just now by ${actor(v)}`;
        if (pending) {
          x.versions.forEach((ver) => { if (ver.state === 'pending') ver.state = 'rejected'; });
          x.versions.unshift(pending);
        }
      });
      return wait({ open, pending: v.isAdmin ? pending : null }, 900);
    },

    async submitOnboarding(raw) {
      const base = emptyAnswers();
      // The client only answers about themselves and their brand. The offer, pricing and launch
      // come later from the REPS team's launch setup.
      const a: OnboardingAnswers = {
        ...base, ...raw,
        contact: { ...base.contact, ...raw.contact }, business: { ...base.business, ...raw.business },
        domain: { ...base.domain, ...(raw.domain ?? {}) },
        offer: base.offer, leadMagnet: base.leadMagnet, launch: emptyLaunch(),
      };
      if (!a.business.brandName?.trim()) throw new AccessError('Please add your business name.', 400);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.contact.email || '')) throw new AccessError('Please add a valid email address.', 400);

      let slug = slugify(a.business.brandName);
      for (let n = 2; await store.byKey('client', slug); n++) slug = `${slugify(a.business.brandName)}-${n}`;
      const clientId = services.newId();
      const now = new Date().toISOString();
      const client: ClientRec = {
        id: clientId, slug, name: a.business.brandName.trim(), growthNote: 'Site not live yet', revenueNote: 'No sales yet',
        contactName: a.business.coachName || a.contact.name, contactEmail: a.contact.email.toLowerCase(), meetingEmails: [], members: [], createdAt: now,
      };
      await store.put('client', clientId, client, meta.client(client));
      const sub: Submission = { id: services.newId(), clientId, submittedAt: now, answers: a };
      await store.put('submission', sub.id, sub, meta.submission(sub));

      // Calls already held with this person (e.g. the sales call) move into their new account.
      const prior = (await store.list<Meeting>('meeting', { clientId: null })).filter((m) => m.attendees.includes(client.contactEmail!));
      for (const m of prior) await store.mutate<Meeting>('meeting', m.id, (x) => { x.clientId = clientId; }, meta.meeting);
      if (prior.length) await refreshVoiceFor(store, services, clientId).catch(() => null);

      // The first design of the website, from their branding, goes to the team to review in Claude.
      // The Website section stays empty until the final design is committed to the client's repo.
      const site1 = await services.writeSiteCopy(a);
      const spec = buildSpec(a, site1.copy, slug);
      const repo = services.siteRepoFor(slug);
      const s: Site = {
        clientId, status: 'draft', statusNote: 'We’re designing your website.',
        contact: client.contactName ?? client.name, domain: a.domain.name || client.name, versions: [],
        github: repo ? { repo, branch: 'main', autoPublish: false } : undefined,
      };
      await store.put('site', clientId, s, meta.site(s));
      await saveDesigns(store, services, clientId, client.name, { home: spec },
        site1.by === 'claude' ? 'Made from the intake form, copy written by Claude.' : 'Made from the intake form.');
      return wait({ clientId, slug, copyBy: site1.by }, 1800);
    },

    /* Launch setup (filled in by REPS after the intake form) */
    async listLaunchSetups() {
      await admin();
      return wait(await store.list<LaunchDoc>('launch'));
    },
    async getLaunchSetup(clientId) {
      await admin();
      return wait(await store.get<LaunchDoc>('launch', clientId));
    },
    async saveLaunchSetup(clientId, setup, build) {
      const v = await admin();
      const old = await store.get<LaunchDoc>('launch', clientId);
      const doc: LaunchDoc = { clientId, setup, savedAt: new Date().toISOString(), savedBy: actor(v), builtAt: old?.builtAt };
      await store.put('launch', clientId, doc, { clientId, sort: doc.savedAt });
      if (!build) return { built: false, notes: ['Saved.'] };
      const notes = await buildLaunch(store, services, clientId);
      await store.mutate<LaunchDoc>('launch', clientId, (x) => { x.builtAt = new Date().toISOString(); }, () => ({ clientId, sort: doc.savedAt }));
      return wait({ built: true, notes }, 1500);
    },

    /* Agency */
    async listAllLeads() {
      await admin();
      return wait(await store.list<Lead>('lead'));
    },
    async listSites() {
      await admin();
      return wait(await store.list<Site>('site'));
    },
    async saveSiteSource(clientId, src) {
      await admin();
      const repo = src.repo.trim().replace(/^https?:\/\/github\.com\//, '').replace(/\.git$/, '').replace(/\/$/, '');
      const ok = await site(clientId, (x) => {
        const live = (src.liveUrl ?? x.github?.liveUrl ?? '').trim().slice(0, 300);
        const liveUrl = live ? (/^https?:\/\//i.test(live) ? live : `https://${live}`) : undefined;
        x.github = repo ? { ...(x.github ?? {}), repo, branch: src.branch?.trim() || 'main', autoPublish: Boolean(src.autoPublish), liveUrl } as SiteSource : undefined;
      });
      if (!ok) throw new AccessError('This client has no website yet.', 404);
    },
    async setSiteDesign(clientId, design) {
      await admin();
      const look = LOOKS.find((l) => l.id === design);
      if (!look) throw new AccessError('Unknown website look.', 400);
      const current = await store.get<Site>('site', clientId);
      if (current && !isTemplateSite(current)) {
        const home = current.specs?.home;
        if (!home) throw new AccessError('There’s no generated design for this client.', 400);
        const client = await store.get<ClientRec>('client', clientId);
        await saveDesigns(store, services, clientId, client?.name ?? home.brand.name, { home: { ...home, design } }, `Redrawn in the ${look.name} look.`);
        return wait({ pending: false, file: true }, 300);
      }
      let result: { pending: boolean } | null = null;
      const ok = await site(clientId, (x) => {
        const latest = x.versions.find((v) => (v.state ?? 'published') === 'published');
        const home = latest?.pages.find((p) => p.key === 'home' && p.kind === 'template' && p.spec && !isPreReg(p.spec));
        if (!latest || !home) throw new AccessError('Only generated websites can change their look.', 400);
        if ((home.spec as SiteSpec).design === design) { result = { pending: false }; return; }
        if (x.status === 'draft') {
          home.spec = { ...(home.spec as SiteSpec), design };
          result = { pending: false };
          return;
        }
        // The client has seen it: the new look waits in Approvals.
        const n = `v${x.versions.filter((v) => v.state !== 'rejected').length + 1}`;
        x.versions.forEach((v) => { if (v.state === 'pending') v.state = 'rejected'; });
        const pages = latest.pages.map((p) => (p.id === home.id ? { ...p, id: services.newId(), spec: { ...(p.spec as SiteSpec), design } } : { ...p, id: services.newId() }));
        x.versions.unshift({
          id: services.newId(), version: n, label: `${n} · ${look.name} look`, state: 'pending', basedOn: latest.id,
          sentNote: `Switched to the ${look.name} look`, createdAt: new Date().toISOString(), pages, comments: [],
          summary: `Same words and photos in the ${look.name} design.`, changes: [], unresolved: [],
        });
        result = { pending: true };
      });
      if (!ok || !result) throw new AccessError('This client has no website yet.', 404);
      return wait(result as { pending: boolean }, 300);
    },
    async syncSite(clientId) {
      await admin();
      return wait(await syncSiteFromGitHub(store, services, clientId), 300);
    },
    async approveVersion(clientId, versionId) {
      await admin();
      await site(clientId, (x) => {
        const ver = x.versions.find((y) => y.id === versionId);
        if (!ver) return;
        ver.state = 'published';
        ver.sentNote = `${ver.sentNote}, sent for review just now`;
        x.versions.filter((y) => y.id === ver.basedOn).forEach((b) => b.comments.forEach((c) => (c.resolved = true)));
        x.versions = [ver, ...x.versions.filter((y) => y.id !== ver.id)];
        x.status = 'review';
        x.statusNote = `${ver.version} sent for review just now by REPS team`;
      });
      await inviteFor(clientId, 'website');
    },
    async closeComments(clientId, commentIds, outcome, note) {
      await admin();
      let open = 0;
      const ok = await site(clientId, (x) => {
        const base = x.versions.find((v) => (v.state ?? 'published') === 'published');
        if (!base) return;
        const at = new Date().toISOString();
        const why = (note ?? '').trim().slice(0, 500);
        base.comments.forEach((c) => {
          if (!commentIds.includes(c.id) || c.resolved) return;
          Object.assign(c, { resolved: true, outcome, closedAt: at, ...(outcome === 'declined' && why ? { outcomeNote: why } : {}) });
        });
        open = base.comments.filter((c) => !c.resolved).length;
        if (!open && x.status === 'changes') {
          const done = base.comments.some((c) => c.outcome === 'done');
          const declined = base.comments.some((c) => c.outcome === 'declined');
          x.status = 'review';
          x.statusNote = done && declined ? 'Your changes have been made, with a note on any we left as they were. Take a look and approve when you’re happy.'
            : done ? 'Your changes have been made. Take a look and approve when you’re happy.'
            : 'The REPS team has gone through your requests. See the notes on each comment.';
        }
      });
      if (!ok) throw new AccessError('Website not found.', 404);
      return wait({ open }, 300);
    },
    async rejectVersion(clientId, versionId, note) {
      await admin();
      await site(clientId, (x) => {
        x.versions.filter((y) => y.id === versionId).forEach((y) => (y.state = 'rejected'));
        x.statusNote = note || 'The REPS team is making your changes';
      });
    },
    async listSubmissions() {
      await admin();
      return wait(await store.list<Submission>('submission'));
    },

    /* Launch emails and follow-up flows. "key" is the campaign key: the client id for launch emails. */
    async getEmails(key) {
      const v = await access(clientOfKey(key));
      const c = await store.get<EmailCampaign>('campaign', key);
      return wait(c ? (v.isAdmin ? c : campaignForClient(c)) : null);
    },
    async listEmails(clientId) {
      const v = await access(clientId);
      if (v.isAdmin) await seedFlows(store, services).catch((e) => console.error('Starter flows failed', e));
      const all = await store.list<EmailCampaign>('campaign', { clientId });
      return wait(all.map((c) => (v.isAdmin ? c : campaignForClient(c))).sort((a, b) => Number(isFlow(a)) - Number(isFlow(b))));
    },
    async listEmailCampaigns() {
      await admin();
      // Flows written for starting clients appear here even if this loads before the client list.
      await seedFlows(store, services).catch((e) => console.error('Starter flows failed', e));
      return wait(await store.list<EmailCampaign>('campaign'));
    },
    async addEmailComment(x) {
      const key = x.campaign ?? x.clientId;
      const v = await access(clientOfKey(key));
      const c = await store.get<EmailCampaign>('campaign', key);
      if (!c || (!v.isAdmin && c.status === 'draft')) throw new AccessError('These emails aren’t ready for comments yet.');
      const { clientId: _c, campaign: _k, versionId, ...rest } = x; // eslint-disable-line @typescript-eslint/no-unused-vars
      const saved: EmailComment = {
        ...rest, author: actor(v), role: v.isAdmin ? 'agency' : 'client', resolved: false, text: rest.text.slice(0, 4000),
        id: services.newId(), createdAt: new Date().toISOString(),
      };
      await campaign(key, (cc) => cc.versions.find((y) => y.id === versionId && (v.isAdmin || y.state === 'published'))?.comments.push(saved));
      return saved;
    },
    async setEmailCommentResolved(key, commentId, resolved) {
      await access(clientOfKey(key));
      await campaign(key, (c) => c.versions.forEach((ver) => ver.comments.forEach((x) => { if (x.id === commentId) x.resolved = resolved; })));
    },
    async sendEmailsToClient(key) {
      await admin();
      await campaign(key, (c) => { c.status = 'review'; c.statusNote = 'Sent for review just now by REPS team'; });
      await inviteFor(clientOfKey(key), 'emails');
    },
    async requestEmailChanges(key, versionId) {
      const clientId = clientOfKey(key);
      const v = await access(clientId);
      const c = await store.get<EmailCampaign>('campaign', key);
      const base = c?.versions.find((x) => x.id === versionId && x.state === 'published');
      if (!c || !base) throw new AccessError('These emails were not found.', 404);
      if (c.status === 'draft' && !v.isAdmin) throw new AccessError('These emails aren’t ready yet.');
      const open = base.comments.filter((x) => !x.resolved).length;
      if (!open) return { open: 0, pending: false };
      const voice = voiceForPrompt(await store.get<VoiceProfile>('voice', clientId));
      const pending = await makeAmendedEmails(c, base, services.amendEmails(voice), services.newId);
      await campaign(key, (x) => {
        x.status = 'changes';
        x.statusNote = `Changes requested just now by ${actor(v)}`;
        if (pending) {
          x.versions = x.versions.filter((y) => y.state !== 'pending');
          x.versions.unshift(pending);
        }
      });
      return wait({ open, pending: Boolean(pending) }, 900);
    },
    async approveEmails(key, versionId) {
      const v = await access(clientOfKey(key));
      const c = await store.get<EmailCampaign>('campaign', key);
      const ver = c?.versions.find((x) => x.id === versionId && x.state === 'published');
      if (!c || !ver) throw new AccessError('These emails were not found.', 404);
      if (c.status === 'draft' && !v.isAdmin) throw new AccessError('These emails aren’t ready yet.');
      await campaign(key, (x) => {
        x.versions.filter((y) => y.id === versionId).forEach((y) => y.comments.forEach((cm) => (cm.resolved = true)));
        x.status = 'approved';
        x.statusNote = `Approved just now by ${actor(v)}`;
      });
      // A follow-up flow runs as an automation in MailerLite, which the REPS team builds from the approved copy.
      const ml: MailerLiteState = isFlow(c)
        ? { state: 'not_scheduled', note: `Approved. Build it as an automation in MailerLite that starts ${(c.flow?.trigger ?? 'when someone signs up').replace(/^W/, 'w')}, then sends these ${ver.emails.length} emails on the days shown.` }
        : await services.scheduleLaunch({ ...c, status: 'approved' }, ver.emails);
      await campaign(key, (x) => { x.mailerlite = ml; });
      return wait(v.isAdmin ? ml : { state: ml.state, note: '' }, 700);
    },
    async scheduleEmails(key) {
      await admin();
      const c = await store.get<EmailCampaign>('campaign', key);
      const ver = c?.versions.find((x) => x.state === 'published');
      if (!c || !ver || c.status !== 'approved') throw new AccessError('The client has to approve the emails first.', 400);
      if (isFlow(c)) throw new AccessError('Follow-up flows are set up as an automation in MailerLite, not scheduled from here.', 400);
      const ml = await services.scheduleLaunch(c, ver.emails);
      await campaign(key, (x) => { x.mailerlite = ml; });
      return wait(ml, 600);
    },
    async markFlowLive(key, live) {
      await admin();
      const c = await store.get<EmailCampaign>('campaign', key);
      if (!c || !isFlow(c)) throw new AccessError('This flow was not found.', 404);
      await campaign(key, (x) => {
        x.mailerlite = live
          ? { state: 'scheduled', note: 'Live in MailerLite as an automation.', at: new Date().toISOString() }
          : { state: 'not_scheduled', note: 'Marked as not live yet.' };
      });
    },
    async approveEmailVersion(key, versionId) {
      await admin();
      await campaign(key, (c) => {
        const ver = c.versions.find((x) => x.id === versionId);
        if (!ver) return;
        ver.state = 'published';
        ver.sentNote = `${ver.sentNote}, sent for review just now`;
        c.versions.filter((x) => x.id === ver.basedOn).forEach((b) => b.comments.forEach((x) => (x.resolved = true)));
        c.versions = [ver, ...c.versions.filter((x) => x.id !== ver.id)];
        c.status = 'review';
        c.statusNote = `${ver.version} sent for review just now by REPS team`;
      });
      await inviteFor(clientOfKey(key), 'emails');
    },
    async rejectEmailVersion(key, versionId, note) {
      await admin();
      await campaign(key, (c) => {
        c.versions.filter((x) => x.id === versionId).forEach((x) => (x.state = 'rejected'));
        c.statusNote = note || 'The REPS team is making your changes';
      });
    },
    async saveEmailEdits(key, emails) {
      await admin();
      const c = await store.get<EmailCampaign>('campaign', key);
      const count = (pendingEmailVersion(c) ?? latestEmailVersion(c) ?? c?.versions[0])?.emails.length ?? 12;
      if (!Array.isArray(emails) || emails.length !== count) throw new AccessError('Could not read the emails.', 400);
      await campaign(key, (cc) => { applyRepsEdits(cc, emails, services.newId); });
    },
    async saveLaunchSettings(clientId, x) {
      await admin();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.launchDate)) throw new AccessError('Please add a launch date.', 400);
      await campaign(clientId, (c) => Object.assign(c, { launchDate: x.launchDate, websiteUrl: x.websiteUrl.trim(), discountCode: x.discountCode.trim().toUpperCase() }));
      // The countdown on the pre-registration page follows the launch date.
      await site(clientId, (s) => s.versions.forEach((ver) => ver.pages.forEach((p) => { if (p.spec && 'kind' in p.spec) p.spec.launchDate = x.launchDate; })));
    },
    async getMailerLite(clientId) {
      await admin();
      const s = await store.get<MailerLiteSettings>('mailerlite', clientId);
      if (!s) return null;
      const { apiKey, ...rest } = s;
      return { ...rest, hasKey: Boolean(apiKey) };
    },
    async saveMailerLite(clientId, x) {
      await admin();
      const old = await store.get<MailerLiteSettings>('mailerlite', clientId);
      const clean = (v: unknown) => String(v ?? '').trim();
      const s: MailerLiteSettings = {
        apiKey: clean(x.apiKey) || old?.apiKey || '', fromEmail: clean(x.fromEmail), fromName: clean(x.fromName),
        preregGroupId: clean(x.preregGroupId), publicGroupId: clean(x.publicGroupId), publicSegmentId: clean(x.publicSegmentId), useHtml: Boolean(x.useHtml),
      };
      await store.put('mailerlite', clientId, s, { clientId });
    },
    async rewriteEmails(clientId) {
      await admin();
      if (!services.claude) throw new AccessError('Rewriting in the client’s voice needs Claude, which isn’t connected yet.', 400);
      const [c, voice, subs] = await Promise.all([
        store.get<EmailCampaign>('campaign', clientId), store.get<VoiceProfile>('voice', clientId), store.list<Submission>('submission', { clientId, limit: 1 }),
      ]);
      if (!c) throw new AccessError('These emails were not found.', 404);
      if (isFlow(c)) throw new AccessError('Rewriting from calls is only for launch emails for now. Use Edit emails for this flow.', 400);
      if (c.status === 'approved') throw new AccessError('These emails are already approved.', 400);
      if (!voice) throw new AccessError('No voice profile yet. Add a call transcript for this client first.', 400);
      if (!subs[0]) throw new AccessError('No onboarding answers for this client.', 400);
      const a0 = subs[0].answers;
      const a = { ...a0, launch: { ...launchOf(a0), date: c.launchDate, websiteUrl: c.websiteUrl, code: c.discountCode, offerDays: String(c.offerDays) as '4' | '5' | '7' } };
      const { emails, by } = await services.writeLaunchEmails(a, voiceForPrompt(voice));
      if (by !== 'claude') throw new AccessError('Claude could not rewrite them just now. Please try again.', 502);
      await campaign(clientId, (cc) => {
        const changed = applyRepsEdits(cc, emails, services.newId);
        if (changed && changed.state === 'pending') {
          changed.amendedBy = 'claude';
          changed.label = `${changed.version} · Rewritten in their voice`;
          changed.summary = `All 12 emails rewritten by Claude in ${cc.contact || 'the client'}'s voice, from ${voice.meetingsUsed} call${voice.meetingsUsed === 1 ? '' : 's'}.`;
        }
      });
    },

    /* Meetings */
    async listMeetings(clientId) {
      if (clientId === undefined) {
        await admin();
        return wait(await store.list<Meeting>('meeting'));
      }
      const v = await access(clientId);
      const list = await store.list<Meeting>('meeting', { clientId });
      return wait(v.isAdmin ? list : list.filter((m) => m.visibleToClient));
    },
    async addMeeting(x) {
      await admin();
      const r = await ingestMeetingDoc(store, services, {
        title: x.title || 'Call', text: x.text, source: 'pasted', clientId: x.clientId,
        startedAt: x.date ? new Date(x.date).toISOString() : null,
      });
      const m = await store.get<Meeting>('meeting', r.id);
      if (!m) throw new AccessError('Could not save the call.', 500);
      return m;
    },
    async updateMeeting(id, patch) {
      await admin();
      const m = await store.mutate<Meeting>('meeting', id, (x) => {
        if ('clientId' in patch) x.clientId = patch.clientId ?? null;
        if ('visibleToClient' in patch) x.visibleToClient = Boolean(patch.visibleToClient);
      }, meta.meeting);
      // Remember the client's addresses from this call, so their future calls match on their own.
      if (patch.clientId && m) {
        await store.mutate<ClientRec>('client', patch.clientId, (c) => {
          c.meetingEmails = [...new Set([...c.meetingEmails, ...m.attendees.filter((e) => e !== c.contactEmail)])];
        }, meta.client);
        await refreshVoiceFor(store, services, patch.clientId).catch(() => null);
        await tasksFromMeeting(store, services, id).catch(() => 0);
      }
    },
    async deleteMeeting(id) {
      await admin();
      await store.del('meeting', id);
    },
    async getVoice(clientId) {
      await admin();
      return wait(await store.get<VoiceProfile>('voice', clientId));
    },
    async refreshVoice(clientId) {
      await admin();
      const before = await store.get<VoiceProfile>('voice', clientId);
      const v = await refreshVoiceFor(store, services, clientId);
      if (!v) throw new AccessError('No call transcripts for this client yet.', 400);
      if (before && v.updatedAt === before.updatedAt) throw new AccessError('Rebuilding needs Claude, which isn’t connected yet. The current profile is kept.', 400);
      return wait(v, 600);
    },
    async saveVoice(x) {
      await admin();
      const v: VoiceProfile = { ...x, by: 'reps', updatedAt: new Date().toISOString() };
      await store.put('voice', v.clientId, v, meta.voice(v));
    },

    /* Tasks */
    async listTasks(clientId) {
      if (clientId === undefined) {
        await admin();
        return wait(await store.list<Task>('task'));
      }
      const v = await access(clientId);
      const list = await store.list<Task>('task', { clientId });
      return wait(v.isAdmin ? list : list.filter((t) => t.assignee === 'client' && (t.status === 'open' || t.status === 'done')));
    },
    async addTask(clientId, x) {
      await admin();
      if (!x.title?.trim()) throw new AccessError('Add a task first.', 400);
      const now = new Date().toISOString();
      const t: Task = {
        id: services.newId(), clientId, title: x.title.trim().slice(0, 300), detail: x.detail?.trim() || undefined,
        status: x.assignee ? 'open' : 'suggested', assignee: x.assignee, assignedAt: x.assignee ? now : undefined,
        due: x.due || undefined, createdAt: now, source: 'manual',
      };
      await store.put('task', t.id, t, meta.task(t));
      return t;
    },
    async updateTask(id, patch) {
      const t = await store.get<Task>('task', id);
      if (!t) throw new AccessError('Task not found.', 404);
      const v = await access(t.clientId);
      if (!v.isAdmin) {
        const onlyStatus = Object.keys(patch).every((k) => k === 'status') && (patch.status === 'done' || patch.status === 'open');
        if (t.assignee !== 'client' || !onlyStatus) throw new AccessError('Only the REPS team can change that.');
      }
      await store.mutate<Task>('task', id, (x) => {
        if (patch.title !== undefined) x.title = patch.title.trim().slice(0, 300) || x.title;
        if (patch.detail !== undefined) x.detail = patch.detail.trim() || undefined;
        if (patch.due !== undefined) x.due = patch.due || undefined;
        if (patch.assignee !== undefined) {
          x.assignee = patch.assignee as Assignee | null;
          if (patch.assignee) { x.assignedAt = new Date().toISOString(); if (x.status === 'suggested') x.status = 'open'; }
        }
        if (patch.status !== undefined) {
          x.status = patch.status;
          if (patch.status === 'done') { x.doneAt = new Date().toISOString(); x.doneBy = actor(v); }
          else { x.doneAt = undefined; x.doneBy = undefined; }
        }
      }, meta.task);
    },
    async findTasks(meetingId) {
      await admin();
      return wait(await tasksFromMeeting(store, services, meetingId, true), 600);
    },
  };
}
