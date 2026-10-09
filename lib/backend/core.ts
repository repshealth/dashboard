import type { Client, Lead, LeadEvent, Site, SiteComment, SourceId, Viewer } from '../types';
import { STAGE_NAME } from '../constants';
import type { SiteCopy } from '../site/copy';
import { buildSpec, slugify } from '../site/compose';
import { emptyAnswers, emptyLaunch, launchOf, type OnboardingAnswers } from '../site/onboarding';
import { buildPreReg, type PreRegCopy } from '../site/prereg';
import { makeAmendedVersion, type AmendFn } from '../site/make-amend';
import { buildCampaign } from '../emails/copy';
import { applyRepsEdits, makeAmendedEmails, type EmailAmendFn } from '../emails/amend';
import type { EmailCampaign, EmailComment, LaunchEmail, MailerLiteSettings, MailerLiteState } from '../emails/types';
import { meetingKey, parseMeetingText } from '../meetings/parse';
import { matchClient } from '../meetings/match';
import { voiceForPrompt, type Meeting, type VoiceProfile } from '../meetings/types';
import type { DocMeta, DocStore } from './store';
import type { Backend, Submission } from './types';

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
};

/** The things that differ between example mode and production: Claude, MailerLite, emails. */
export interface Services {
  newId(): string;
  /** Example mode adds a short pause so loading states are visible. */
  pause?(ms: number): Promise<void>;
  /** Whether Claude is connected (needed to rewrite emails in a client's voice). */
  claude: boolean;
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
  /** Emails a client a sign-in link, e.g. when their website or emails are ready. */
  sendInvite(u: UserRec, clientName: string, what: 'website' | 'emails'): Promise<void>;
}

export class AccessError extends Error {
  constructor(message: string, public status = 403) { super(message); }
}

/* Access ---------------------------------------------------------------------------- */

/** What a client may see of their website: nothing while it's a draft, and never versions waiting for REPS. */
export function siteForClient(s: Site): Site {
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

  const existing = await store.byKey<Lead>('lead', `${clientId}|${email}`);
  let lead: Lead;
  if (existing) {
    lead = (await store.mutate<Lead>('lead', existing.id, (l) => {
      l.events.unshift(event(label));
      if (input.answers?.length) l.answers = input.answers;
      if (!l.phone && input.phone) l.phone = input.phone;
    }, meta.lead))!;
  } else {
    lead = {
      id: services.newId(), clientId, name: input.name || email, email, phone: input.phone || undefined, source: input.source,
      stage: 'new', page: input.page || undefined, utm: input.utm || undefined, firstSeen: new Date().toISOString(), value: 0,
      detail: input.answers?.[0] ? `${input.answers[0][0]}: ${input.answers[0][1]}` : input.form || undefined,
      answersTitle: titles[input.source], answers: input.answers ?? [], events: [event(label)],
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
  if (m.clientId) await refreshVoiceFor(store, services, m.clientId).catch((e) => console.error('Voice profile failed:', e));
  return { id: m.id, clientId: m.clientId, duplicate: false, meeting: m };
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
  const campaign = (clientId: string, fn: (c: EmailCampaign) => void) => store.mutate<EmailCampaign>('campaign', clientId, fn, meta.campaign);
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
    async signOut() {},

    async listClients() {
      const v = await signedIn();
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
      const a: OnboardingAnswers = {
        ...base, ...raw,
        contact: { ...base.contact, ...raw.contact }, business: { ...base.business, ...raw.business }, launch: { ...emptyLaunch(), ...raw.launch },
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

      // Calls already held with this person (e.g. the sales call) move into their new account,
      // and how they talked on them shapes their launch emails.
      let voice = '';
      const prior = (await store.list<Meeting>('meeting', { clientId: null })).filter((m) => m.attendees.includes(client.contactEmail!));
      if (prior.length) {
        for (const m of prior) await store.mutate<Meeting>('meeting', m.id, (x) => { x.clientId = clientId; }, meta.meeting);
        voice = voiceForPrompt(await refreshVoiceFor(store, services, clientId).catch(() => null));
      }

      const [site1, pre, mail] = await Promise.all([services.writeSiteCopy(a), services.writePreRegCopy(a), services.writeLaunchEmails(a, voice)]);
      const spec = buildSpec(a, site1.copy, slug);
      const prereg = buildPreReg(a, pre.copy, spec);
      const vid = services.newId();
      const s: Site = {
        clientId, status: 'draft', statusNote: 'Built from the onboarding form just now', contact: client.contactName ?? client.name, domain: client.name,
        versions: [{
          id: vid, version: 'v1', label: 'v1 · First draft', state: 'published', createdAt: now,
          sentNote: site1.by === 'claude' ? 'Built from the onboarding form, copy written by Claude' : 'Built from the onboarding form',
          pages: [
            { id: services.newId(), key: 'home', name: 'Homepage', path: ' · Homepage', kind: 'template', spec },
            { id: services.newId(), key: 'prereg', name: 'Pre-registration', path: ' · Pre-registration', kind: 'template', spec: prereg },
          ],
          comments: [],
        }],
      };
      await store.put('site', clientId, s, meta.site(s));
      const c = buildCampaign(a, clientId, mail.emails, mail.by);
      c.versions[0].id = services.newId();
      if (mail.by === 'claude') c.versions[0].sentNote = 'Written by Claude from the onboarding form';
      await store.put('campaign', clientId, c, meta.campaign(c));
      return wait({ clientId, slug, copyBy: site1.by }, 1800);
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

    /* Launch emails */
    async getEmails(clientId) {
      const v = await access(clientId);
      const c = await store.get<EmailCampaign>('campaign', clientId);
      return wait(c ? (v.isAdmin ? c : campaignForClient(c)) : null);
    },
    async listEmailCampaigns() {
      await admin();
      return wait(await store.list<EmailCampaign>('campaign'));
    },
    async addEmailComment(x) {
      const v = await access(x.clientId);
      const c = await store.get<EmailCampaign>('campaign', x.clientId);
      if (!c || (!v.isAdmin && c.status === 'draft')) throw new AccessError('These emails aren’t ready for comments yet.');
      const { clientId, versionId, ...rest } = x;
      const saved: EmailComment = {
        ...rest, author: actor(v), role: v.isAdmin ? 'agency' : 'client', resolved: false, text: rest.text.slice(0, 4000),
        id: services.newId(), createdAt: new Date().toISOString(),
      };
      await campaign(clientId, (cc) => cc.versions.find((y) => y.id === versionId && (v.isAdmin || y.state === 'published'))?.comments.push(saved));
      return saved;
    },
    async setEmailCommentResolved(clientId, commentId, resolved) {
      await access(clientId);
      await campaign(clientId, (c) => c.versions.forEach((ver) => ver.comments.forEach((x) => { if (x.id === commentId) x.resolved = resolved; })));
    },
    async sendEmailsToClient(clientId) {
      await admin();
      await campaign(clientId, (c) => { c.status = 'review'; c.statusNote = 'Sent for review just now by REPS team'; });
      await inviteFor(clientId, 'emails');
    },
    async requestEmailChanges(clientId, versionId) {
      const v = await access(clientId);
      const c = await store.get<EmailCampaign>('campaign', clientId);
      const base = c?.versions.find((x) => x.id === versionId && x.state === 'published');
      if (!c || !base) throw new AccessError('These emails were not found.', 404);
      if (c.status === 'draft' && !v.isAdmin) throw new AccessError('These emails aren’t ready yet.');
      const open = base.comments.filter((x) => !x.resolved).length;
      if (!open) return { open: 0, pending: false };
      const voice = voiceForPrompt(await store.get<VoiceProfile>('voice', clientId));
      const pending = await makeAmendedEmails(c, base, services.amendEmails(voice), services.newId);
      await campaign(clientId, (x) => {
        x.status = 'changes';
        x.statusNote = `Changes requested just now by ${actor(v)}`;
        if (pending) {
          x.versions = x.versions.filter((y) => y.state !== 'pending');
          x.versions.unshift(pending);
        }
      });
      return wait({ open, pending: Boolean(pending) }, 900);
    },
    async approveEmails(clientId, versionId) {
      const v = await access(clientId);
      const c = await store.get<EmailCampaign>('campaign', clientId);
      const ver = c?.versions.find((x) => x.id === versionId && x.state === 'published');
      if (!c || !ver) throw new AccessError('These emails were not found.', 404);
      if (c.status === 'draft' && !v.isAdmin) throw new AccessError('These emails aren’t ready yet.');
      await campaign(clientId, (x) => {
        x.versions.filter((y) => y.id === versionId).forEach((y) => y.comments.forEach((cm) => (cm.resolved = true)));
        x.status = 'approved';
        x.statusNote = `Approved just now by ${actor(v)}`;
      });
      const ml = await services.scheduleLaunch({ ...c, status: 'approved' }, ver.emails);
      await campaign(clientId, (x) => { x.mailerlite = ml; });
      return wait(v.isAdmin ? ml : { state: ml.state, note: '' }, 700);
    },
    async scheduleEmails(clientId) {
      await admin();
      const c = await store.get<EmailCampaign>('campaign', clientId);
      const ver = c?.versions.find((x) => x.state === 'published');
      if (!c || !ver || c.status !== 'approved') throw new AccessError('The client has to approve the emails first.', 400);
      const ml = await services.scheduleLaunch(c, ver.emails);
      await campaign(clientId, (x) => { x.mailerlite = ml; });
      return wait(ml, 600);
    },
    async approveEmailVersion(clientId, versionId) {
      await admin();
      await campaign(clientId, (c) => {
        const ver = c.versions.find((x) => x.id === versionId);
        if (!ver) return;
        ver.state = 'published';
        ver.sentNote = `${ver.sentNote}, sent for review just now`;
        c.versions.filter((x) => x.id === ver.basedOn).forEach((b) => b.comments.forEach((x) => (x.resolved = true)));
        c.versions = [ver, ...c.versions.filter((x) => x.id !== ver.id)];
        c.status = 'review';
        c.statusNote = `${ver.version} sent for review just now by REPS team`;
      });
      await inviteFor(clientId, 'emails');
    },
    async rejectEmailVersion(clientId, versionId, note) {
      await admin();
      await campaign(clientId, (c) => {
        c.versions.filter((x) => x.id === versionId).forEach((x) => (x.state = 'rejected'));
        c.statusNote = note || 'The REPS team is making your changes';
      });
    },
    async saveEmailEdits(clientId, emails) {
      await admin();
      if (!Array.isArray(emails) || emails.length !== 12) throw new AccessError('Could not read the emails.', 400);
      await campaign(clientId, (c) => { applyRepsEdits(c, emails, services.newId); });
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
  };
}
