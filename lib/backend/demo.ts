import type { Lead, Site } from '../types';
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
import { checkLogin, createBackend, meta, seedFlows, starterNote, syncSiteFromGitHub, type ClientRec, type Services, type UserRec, type ViewerRec } from './core';
import type { Backend } from './types';
import type { Funnel } from '../funnels/types';
import type { AdCampaign, AdRow, MetaAdsAccount } from '../ads/types';

/**
 * Example mode: the same backend as production (core.ts), running on example data held
 * in memory in the browser. Accounts created through the onboarding form, comments,
 * amends and approvals all work, and everything resets when the page is reloaded.
 * Claude, MailerLite and emails are stood in for by simple rules.
 */
const store = new MemoryStore();

/** A pretend Meta for the preview: three ad accounts with made-up results. */
const FAKE_TOKEN_OK = (t: string) => t.length >= 60;
async function fakeMetaGet(token: string, pathOrUrl: string): Promise<Record<string, unknown>> {
  if (!FAKE_TOKEN_OK(token)) throw new Error('Invalid OAuth access token (code 190)');
  const u = new URL(pathOrUrl.startsWith('http') ? pathOrUrl : `https://graph.facebook.com/v23.0${pathOrUrl}`);
  const path = u.pathname.replace(/^\/v[\d.]+/, '');
  if (path === '/me') return { id: '1000', name: 'REPS Ads (system user)' };
  if (path === '/me/adaccounts') return { data: [
    { account_id: '120000000000001', name: 'Dailey Demolition', currency: 'GBP', account_status: 1, business: { name: 'Kate Dailey Fitness' } },
    { account_id: '120000000000002', name: 'Physique X Ads', currency: 'GBP', account_status: 1, business: { name: 'Physique X Ltd' } },
    { account_id: '120000000000003', name: 'Lean Body Academy', currency: 'GBP', account_status: 2 },
  ] };
  const m = path.match(/^\/act_(\d+)\/(insights|campaigns)$/);
  if (!m) throw new Error('Unknown path');
  const names = ['Black Friday | Leads', 'Evergreen | App trial'];
  if (m[2] === 'campaigns') return { data: names.map((n, i) => ({ id: `${m[1]}${i}`, name: n, effective_status: i ? 'PAUSED' : 'ACTIVE', daily_budget: i ? '1500' : '4000' })) };
  const range = JSON.parse(u.searchParams.get('time_range') ?? '{}') as { since: string; until: string };
  const data: Record<string, unknown>[] = [];
  let seed = Number(m[1].slice(-3)) + 3;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let d = new Date(`${range.since}T12:00:00Z`); d.toISOString().slice(0, 10) <= range.until; d = new Date(d.getTime() + 864e5)) {
    names.forEach((campaign, ci) => ['Reel', 'Carousel'].forEach((ad) => {
      const spend = (ci ? 4 : 16) * (0.7 + rnd() * 0.6);
      const impressions = Math.round(spend * 110), clicks = Math.round(impressions * 0.014), leads = Math.round(clicks * 0.18);
      data.push({ date_start: d.toISOString().slice(0, 10), campaign_name: campaign, adset_name: 'Broad UK 25-50', ad_name: ad, spend: spend.toFixed(2), impressions: String(impressions), reach: String(Math.round(impressions * 0.82)), inline_link_clicks: String(clicks), actions: leads ? [{ action_type: 'lead', value: String(leads) }] : [] });
    }));
  }
  return { data };
}

const services: Services = {
  newId: uid,
  metaGet: fakeMetaGet,
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
    'repshealth/shapeupwithgabby': async () => (await import('../demo/shapeupwithgabby.json')).default as FetchedSite,
    'repshealth/bella': async () => (await import('../demo/bella.json')).default as FetchedSite,
    'repshealth/joshbell': async () => (await import('../demo/joshbell.json')).default as FetchedSite,
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
  await seedFlows(store, services);
  await seedExampleFunnel();
  await seedExampleAds();
  const admin: UserRec = { id: agency.id, email: agency.email!, name: agency.name, isAdmin: true, createdAt: new Date().toISOString() };
  await store.put('user', admin.id, admin, meta.user(admin));
}

/** One example funnel with made-up visits, so the Funnels screen has something to show in the preview. */
async function seedExampleFunnel() {
  const c = STARTER_CLIENTS.find((x) => x.slug === 'dailey-demolition') ?? STARTER_CLIENTS[0];
  if (!c) return;
  const now = Date.now();
  const start = new Date(now - 20 * 864e5).toISOString().slice(0, 10);
  const f: Funnel = {
    id: 'example-funnel', clientId: c.id, name: 'Bring It Home waitlist', kind: 'waitlist', url: 'https://repshealth.github.io/katedaileyprereg/',
    forms: ['Pre-registration'], startsOn: start, status: 'live', createdAt: new Date(now - 21 * 864e5).toISOString(),
    lastViewAt: new Date(now - 6 * 60e3).toISOString(), notes: 'Example data in the preview only.',
  };
  await store.put('funnel', f.id, f, meta.funnel(f));
  const srcs = ['instagram', 'instagram', 'instagram', 'tiktok', 'Direct', 'facebook', 'google'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let d = 20; d >= 0; d--) {
    const n = Math.round(18 + 30 * Math.sin((20 - d) / 6) ** 2 + rnd() * 14);
    for (let i = 0; i < n; i++) {
      const t = now - d * 864e5 - rnd() * 864e5 * (d ? 1 : 0.4);
      const v = `v${d}-${i}`;
      const hit = { t: new Date(t).toISOString(), v, s: srcs[Math.floor(rnd() * srcs.length)], d: rnd() < 0.78 ? 'mobile' : 'desktop' } as const;
      await store.put('fhit', `h${d}-${i}`, hit, { clientId: f.id, sort: hit.t });
      if (rnd() < 0.3) await store.put('fhit', `h${d}-${i}b`, { ...hit, t: new Date(t + 9e4).toISOString() }, { clientId: f.id, sort: hit.t });
      if (rnd() < 0.09) {
        const stage = rnd() < 0.2 ? 'call' : rnd() < 0.08 ? 'purchased' : 'new';
        const lead = {
          id: `ex-lead-${d}-${i}`, clientId: c.id, name: ['Sophie', 'Hannah', 'Megan', 'Laura', 'Chloe', 'Emma', 'Jess'][i % 7] + ' ' + 'ABCDEFGHJKLMNPRSTW'[(d + i) % 18] + '.',
          email: `example${d}${i}@example.com`, stage, source: 'website', form: 'Pre-registration', firstSeen: new Date(t + 6e4).toISOString(),
          ...(['instagram', 'facebook'].includes(hit.s) ? { utm: ['Bring It Home | Leads | Waitlist', 'Bring It Home | Retargeting'][i % 3 === 0 ? 1 : 0] } : {}),
          value: stage === 'purchased' ? 149 : 0, answers: [], events: [], page: f.url, detail: 'Example lead from the preview funnel',
          submissions: [{ form: 'Pre-registration', source: 'website', page: f.url, at: new Date(t + 6e4).toISOString(), answers: [] }],
        };
        await store.put('lead', lead.id, lead, meta.lead(lead as unknown as Lead));
      }
    }
  }
}

/** Example Meta ads results for the preview, matched to the example funnel's leads. */
async function seedExampleAds() {
  const c = STARTER_CLIENTS.find((x) => x.slug === 'dailey-demolition') ?? STARTER_CLIENTS[0];
  if (!c) return;
  const now = Date.now();
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const plan = [
    { campaign: 'Bring It Home | Leads | Waitlist', sets: { 'Women 25-45 UK | Fitness interests': ['Kitchen reel', 'Before and after carousel'], 'Lookalike 1% | Past buyers': ['Kitchen reel', 'Talking head: why I made this'] }, daily: 38 },
    { campaign: 'Bring It Home | Retargeting', sets: { 'Page visitors 30 days': ['Testimonial video', 'Last chance static'] }, daily: 12 },
  ];
  const at = new Date().toISOString();
  for (const p of plan) {
    const camp: AdCampaign = { id: `ex-${p.campaign.length}`, clientId: c.id, name: p.campaign, status: 'active', funnelId: 'example-funnel', dailyBudget: p.daily, createdAt: at, updatedAt: at, notes: 'Example data in the preview only.' };
    await store.put('adcampaign', camp.id, camp, { clientId: c.id, sort: at });
    for (let d = 20; d >= 0; d--) {
      const date = new Date(now - d * 864e5).toISOString().slice(0, 10);
      for (const [adset, ads] of Object.entries(p.sets)) for (const ad of ads) {
        const spend = Math.round((p.daily / (Object.keys(p.sets).length * ads.length)) * (0.75 + rnd() * 0.5) * 100) / 100;
        const impressions = Math.round(spend * (90 + rnd() * 50));
        const clicks = Math.round(impressions * (0.009 + rnd() * 0.012));
        const results = Math.round(clicks * (0.12 + rnd() * 0.1));
        const row: AdRow = { id: `ex-${date}-${p.campaign.length}-${adset.length}-${ad.length}`, clientId: c.id, date, campaign: p.campaign, adset, ad, spend, impressions, reach: Math.round(impressions * 0.8), clicks, results, resultType: 'Leads', metaLeads: results, purchases: 0, value: 0, importedAt: at };
        await store.put('adrow', row.id, row, { clientId: c.id, sort: date });
      }
    }
  }
  const range: [string, string] = [new Date(now - 20 * 864e5).toISOString().slice(0, 10), new Date(now).toISOString().slice(0, 10)];
  await store.put('metaads', c.id, { clientId: c.id, currency: 'GBP', connected: false, lastImportAt: at, lastImportName: 'example.csv', lastImportRange: range } satisfies MetaAdsAccount, { clientId: c.id });
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
