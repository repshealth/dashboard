import type { Site } from '../types';
import { uid } from '../format';
import { fallbackCopy } from '../site/copy';
import type { OnboardingAnswers } from '../site/onboarding';
import { launchOf } from '../site/onboarding';
import { fallbackPreRegCopy } from '../site/prereg';
import { amendWithRules } from '../site/amend-rules';
import { renderPage } from '../site/render/renderer.gen';
import { fallbackEmails, toEmails } from '../emails/copy';
import { sequenceSlots } from '../emails/schedule';
import { rulesEmailAmend } from '../emails/amend';
import { voiceFromRules } from '../meetings/voice';
import { tasksFromNotes } from '../tasks/extract';
import { fetchSiteFromGitHub, type FetchedSite } from '../site/github';
import { STARTER_CLIENTS } from '../starter';
import { MemoryStore } from './store';
import { checkLogin, createBackend, meta, starterNote, syncSiteFromGitHub, type ClientRec, type Services, type UserRec, type ViewerRec } from './core';
import type { Backend } from './types';

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
  // In the preview, public repos are read straight from GitHub by the browser.
  fetchSite: (repo, branch) => fetchSiteFromGitHub(repo, branch),
  storeHtml: async (_c, _sha, _path, html) => URL.createObjectURL(new Blob([html], { type: 'text/html' })),
  renderPage: (spec, title) => renderPage(spec, { title }),
  // In the preview the file is kept in the browser. Live, it's also committed to the designs repo.
  saveDesign: async (_c, _file, html) => ({
    url: URL.createObjectURL(new Blob([html], { type: 'text/html' })),
    note: 'Example mode: live, this is also committed to the designs repo your Claude Project syncs from.',
  }),
  siteRepoFor: (slug) => `repshealth/${slug}-site`,
  sendInvite: async () => {},
};

/**
 * Starts with the real clients only (lib/starter.ts). Each website shows the latest commit from
 * its GitHub repo, saved into the preview when it was built (Check for updates fetches newer ones).
 */
async function seedExample() {
  const snapshots: Record<string, () => Promise<FetchedSite>> = {
    'repshealth/physique-x': async () => (await import('../demo/physique-x.json')).default as FetchedSite,
    'repshealth/dailey': async () => (await import('../demo/dailey.json')).default as FetchedSite,
  };
  for (const c of STARTER_CLIENTS) {
    const rec: ClientRec = {
      id: c.id, slug: c.slug, name: c.name, growthNote: 'Site not live yet', revenueNote: 'No sales yet',
      contactName: c.contactName, meetingEmails: [], members: [],
    };
    await store.put('client', rec.id, rec, meta.client(rec));
    const site: Site = {
      clientId: c.id, status: 'review', statusNote: 'Latest version from GitHub', contact: c.contactName, domain: c.name, versions: [],
      github: { repo: c.repo, branch: c.branch, autoPublish: false },
    };
    await store.put('site', c.id, site, meta.site(site));
    const snap = snapshots[c.repo];
    if (snap) await syncSiteFromGitHub(store, { ...services, fetchSite: snap }, c.id).catch(() => null);
    await starterNote(store, c.id);
  }
  for (const c of STARTER_CLIENTS) await store.put('setting', `starter:${c.slug}`, { at: new Date().toISOString() }, {});
  const admin: UserRec = { id: agency.id, email: agency.email!, name: agency.name, isAdmin: true, createdAt: new Date().toISOString() };
  await store.put('user', admin.id, admin, meta.user(admin));
}

let seeded: Promise<void> | null = null;

/** The preview's agency login, shown on its sign-in page. Live, it's ADMIN_EMAILS with ADMIN_PASSWORD. */
export const DEMO_AGENCY = { email: 'agency@reps.preview', password: 'preview-agency' };
const agency: ViewerRec = { id: 'reps', name: 'REPS team', email: DEMO_AGENCY.email, isAdmin: true };

// Who is signed in to the preview. Kept in memory, so a reload signs out (and resets the data).
let current: ViewerRec | null = null;

const base = createBackend(store, services, async () => {
  await (seeded ??= seedExample());
  return current;
}, 'demo');

export const demoBackend: Backend = {
  ...base,
  async signIn(email, password) {
    await (seeded ??= seedExample());
    const e = email.trim().toLowerCase();
    if (e === DEMO_AGENCY.email && password === DEMO_AGENCY.password) current = agency;
    else {
      const u = await checkLogin(store, e, password);
      if (!u) { await new Promise((r) => setTimeout(r, 400)); throw new Error('That email and password don’t match.'); }
      current = { id: u.id, name: u.name, email: u.email, isAdmin: Boolean(u.isAdmin) };
    }
    return { name: current.name, email: current.email, isAdmin: current.isAdmin };
  },
  async signOut() { current = null; },
};
export type { OnboardingAnswers };
