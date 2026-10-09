import seed from '../demo/seed.json';
import type { Lead, Site, SiteComment } from '../types';
import { uid } from '../format';
import { fallbackCopy } from '../site/copy';
import { buildSpec } from '../site/compose';
import { exampleAnswers, launchOf, type OnboardingAnswers } from '../site/onboarding';
import { buildPreReg, fallbackPreRegCopy } from '../site/prereg';
import { amendWithRules } from '../site/amend-rules';
import { makeAmendedVersion } from '../site/make-amend';
import type { SiteSpec } from '../site/spec';
import { buildCampaign, fallbackEmails, toEmails } from '../emails/copy';
import { sequenceSlots } from '../emails/schedule';
import { makeAmendedEmails, rulesEmailAmend } from '../emails/amend';
import type { EmailCampaign, EmailComment } from '../emails/types';
import { demoMeetings, demoVoice } from '../demo/meetings';
import { voiceFromRules } from '../meetings/voice';
import { tasksFromNotes } from '../tasks/extract';
import type { Task } from '../tasks/types';
import { MemoryStore } from './store';
import { createBackend, meta, type ClientRec, type Services } from './core';
import type { Backend, Submission } from './types';

/**
 * Example mode: the same backend as production (core.ts), running on example data held
 * in memory in the browser. Accounts created through the onboarding form, comments,
 * amends and approvals all work, and everything resets when the page is reloaded.
 * Claude, MailerLite and emails are stood in for by simple rules.
 */
const store = new MemoryStore();

const services: Services = {
  newId: uid,
  pause: (ms) => new Promise((r) => setTimeout(r, ms)),
  claude: false,
  writeSiteCopy: async (a) => ({ copy: fallbackCopy(a), by: 'template' }),
  writePreRegCopy: async (a) => ({ copy: fallbackPreRegCopy(a), by: 'template' }),
  writeLaunchEmails: async (a) => {
    const f = fallbackEmails(a);
    return { emails: toEmails(f, sequenceSlots(launchOf(a).offerDays), f), by: 'template' };
  },
  amendSite: async (spec, comments) => ({ ...amendWithRules(spec, comments), by: 'rules' }),
  amendEmails: () => rulesEmailAmend,
  // Without Claude, a rules-only profile never replaces a fuller one.
  buildVoice: async (clientId, meetings, names, _coach, _brand, existing) =>
    existing && existing.by !== 'rules' ? null : voiceFromRules(clientId, meetings, names),
  scheduleLaunch: async () => ({ state: 'scheduled', note: 'Example mode: 12 emails would now be scheduled in MailerLite', at: new Date().toISOString() }),
  addSubscriber: async () => false,
  findTasks: async (m, _client, _coach, names) => tasksFromNotes(m, names),
  sendInvite: async () => {},
};

/** Example generated site and emails, each with an amend already waiting for approval. */
async function seedExample() {
  for (const c of seed.clients) {
    const rec = { ...c, meetingEmails: [], members: [] } as ClientRec;
    await store.put('client', rec.id, rec, meta.client(rec));
  }
  for (const l of seed.leads as unknown as Lead[]) await store.put('lead', l.id, l, meta.lead(l));
  for (const s of seed.sites as unknown as Site[]) await store.put('site', s.clientId, s, meta.site(s));

  const a = exampleAnswers();
  const slug = 'strong-with-dani';
  const spec = buildSpec(a, fallbackCopy(a), slug);
  const pages = [
    { id: `${slug}-v1-home`, key: 'home', name: 'Homepage', path: ' · Homepage', kind: 'template' as const, spec },
    { id: `${slug}-v1-prereg`, key: 'prereg', name: 'Pre-registration', path: ' · Pre-registration', kind: 'template' as const, spec: buildPreReg(a, fallbackPreRegCopy(a), spec) },
  ];
  const at = (d: string) => `2026-10-${d}:00`;
  const comment = (n: number, sel: string, idx: number | undefined, section: string, text: string, said: string, when: string): SiteComment => ({
    id: `${slug}-c${n}`, pageId: pages[0].id, author: 'Dani', role: 'client', anchor: { sel, n: idx, fx: 0.5, fy: 0.3 },
    text: said, resolved: false, createdAt: at(when), target: { section, text },
  });
  const s1 = pages[0].spec as SiteSpec;
  const site: Site = {
    clientId: slug, status: 'changes', statusNote: 'Changes requested by Dani', contact: 'Dani', domain: a.business.brandName,
    versions: [{
      id: `${slug}-v1`, version: 'v1', label: 'v1 · First draft', sentNote: 'Sent for review 8 Oct by REPS team', state: 'published', pages,
      comments: [
        comment(1, '.t-sub', undefined, 'Hero', s1.hero.sub, 'Can this say “Training, food and accountability in one app, built for busy mums.”', '08T18:20'),
        comment(2, '.t-feat .t-card-t', 0, 'Feature cards', s1.features.items[0].title, 'Change this to “Home & gym plans”', '08T18:24'),
        comment(3, '.t-hero-img', undefined, 'Hero', 'Hero photo of the coach', 'Can we use the photo from my beach shoot here instead?', '08T18:26'),
      ],
    }],
  };
  const pending = await makeAmendedVersion(site, site.versions[0], services.amendSite, uid);
  if (pending) { pending.createdAt = at('09T08:12'); site.versions.unshift(pending); }

  const client: ClientRec = {
    id: slug, slug, name: a.business.brandName, growthNote: 'Site not live yet', revenueNote: 'No sales yet',
    contactName: 'Dani', contactEmail: a.contact.email, meetingEmails: [], members: [],
  };
  const sub: Submission = { id: `${slug}-form`, clientId: slug, submittedAt: at('07T19:42'), answers: a };

  const f = fallbackEmails(a);
  const c: EmailCampaign = buildCampaign(a, slug, toEmails(f, sequenceSlots(launchOf(a).offerDays), f), 'template');
  const v1 = c.versions[0];
  v1.sentNote = 'Sent for review 8 Oct by REPS team';
  c.status = 'changes';
  c.statusNote = 'Changes requested by Dani';
  const e3 = v1.emails.find((e) => e.id === 'prereg-3')!;
  const e6 = v1.emails.find((e) => e.id === 'public-6')!;
  const ec = (n: number, emailId: string, field: EmailComment['field'], quote: string, text: string, when: string): EmailComment => ({
    id: `${slug}-ec${n}`, emailId, field, quote, author: 'Dani', role: 'client', text, resolved: false, createdAt: at(when),
  });
  v1.comments.push(
    ec(1, 'prereg-3', 'subject', e3.subject, 'Can this say "Doors are open (and your 30% is waiting)"', '08T19:02'),
    ec(2, 'public-6', 'body.0', e6.body[0], 'I would never say this, it sounds too salesy. Can it be more like me chatting to a friend?', '08T19:05'),
  );
  const pend = await makeAmendedEmails(c, v1, rulesEmailAmend, uid);
  if (pend) { pend.createdAt = at('09T08:14'); c.versions.unshift(pend); }

  await Promise.all([
    store.put('client', slug, client, meta.client(client)),
    store.put('site', slug, site, meta.site(site)),
    store.put('submission', sub.id, sub, meta.submission(sub)),
    store.put('campaign', slug, c, meta.campaign(c)),
    ...demoMeetings.map((m) => store.put('meeting', m.id, m, meta.meeting(m))),
    ...demoVoice.map((v) => store.put('voice', v.clientId, v, meta.voice(v))),
    ...demoTasks(slug).map((t) => store.put('task', t.id, t, meta.task(t))),
  ]);
}
/** Example tasks: some from the latest call waiting for review, some already assigned. */
function demoTasks(clientId: string): Task[] {
  const call = (id: string) => demoMeetings.find((m) => m.id === id)!;
  const review = call('m-dani-3');
  const onboard = call('m-dani-2');
  const t = (n: number, m: typeof review, title: string, rest: Partial<Task>): Task => ({
    id: `task-${n}`, clientId, title, meetingId: m.id, meetingTitle: m.title, meetingAt: m.startedAt,
    status: 'suggested', assignee: null, createdAt: m.startedAt, source: 'meeting', ...rest,
  });
  return [
    t(1, review, 'Leave comments on the website in the dashboard', { suggested: 'client', quote: 'Dani will leave comments on the website in the dashboard.' }),
    t(2, review, 'Send the beach shoot photos', { suggested: 'client', detail: 'For the hero and the coach section.', quote: 'Dani will send the beach shoot photos by Monday.', due: '2026-10-12' }),
    t(3, review, 'Swap the hero photo for one from the beach shoot', { suggested: 'sam', quote: 'And the photo, can we use one from my beach shoot? That one is a bit old now.' }),
    t(4, review, 'Rewrite the hero line to speak to busy mums', { suggested: 'ai', detail: 'Dani suggested: "Training, food and accountability in one app, built for busy mums."', quote: 'It is nice, but it is a bit, I don\'t know, gym-bro? My girls are mums.' }),
    t(5, review, 'Update the launch emails once comments are in', { suggested: 'james', quote: 'James will update the launch emails once comments are in.' }),
    t(6, onboard, 'Submit the onboarding form with photos', { status: 'done', assignee: 'client', suggested: 'client', assignedAt: onboard.startedAt, doneAt: '2026-10-07T19:42:00', doneBy: 'Dani' }),
    t(7, onboard, 'Build the website, pre-registration page and launch emails', { status: 'done', assignee: 'james', suggested: 'james', assignedAt: onboard.startedAt, doneAt: '2026-10-08T12:00:00', doneBy: 'REPS team' }),
    t(8, onboard, 'Set up the MailerLite groups for the launch', { status: 'open', assignee: 'alyza', assignedAt: onboard.startedAt, due: '2026-10-20' }),
    t(9, onboard, 'Post three Instagram stories about the pre-registration page', { status: 'open', assignee: 'client', assignedAt: onboard.startedAt, detail: 'Link to the pre-registration page in each one.' }),
  ];
}

const seeded = seedExample();

const base = createBackend(store, services, async () => {
  await seeded;
  return { id: 'reps', name: 'REPS team', isAdmin: true };
}, 'demo');

export const demoBackend: Backend = base;
export type { OnboardingAnswers };
