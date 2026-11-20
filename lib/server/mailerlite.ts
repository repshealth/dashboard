import type { EmailCampaign, LaunchEmail, MailerLiteSettings, MailerLiteState } from '../emails/types';
import { sendAt } from '../emails/schedule';
import { emailHtml } from '../emails/html';

/**
 * MailerLite (connect.mailerlite.com, API v2). Each client has their own MailerLite
 * account; its key and ids are saved per client from Agency · Emails and are never
 * sent to the browser.
 *
 * Not yet tested against a real account. Things to know:
 *  - Custom HTML content needs MailerLite's Advanced plan. On other plans leave
 *    "Send our design" off: the campaigns are created with the subject only, for the
 *    team to paste the content into MailerLite's editor.
 *  - The "from" address must be verified in that MailerLite account.
 *  - The general list must exclude pre-registered people. MailerLite can't exclude a
 *    group from a campaign, so create a segment ("in general group, not in pre-reg
 *    group") and use its id. Without it the general group is used.
 */
const API = 'https://connect.mailerlite.com/api';

async function ml(key: string, path: string, body: object) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const out = (await res.json().catch(() => ({}))) as { message?: string; data?: { id?: string } };
  if (!res.ok) throw new Error(out?.message || `MailerLite returned ${res.status}`);
  return out;
}

/** Any MailerLite call. Waits and retries once if MailerLite says to slow down (120 requests a minute). */
async function mlCall<T = Record<string, unknown>>(key: string, method: string, path: string, body?: object): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: { Authorization: `Bearer ${key}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (res.status === 429 && attempt < 2) {
      const wait = Math.min(30, Number(res.headers.get('retry-after')) || 10);
      await new Promise((r) => setTimeout(r, wait * 1000));
      continue;
    }
    if (res.status === 204) return {} as T;
    const out = (await res.json().catch(() => ({}))) as { message?: string; errors?: Record<string, string[]> };
    if (!res.ok) {
      const detail = out.errors ? Object.entries(out.errors).map(([k, v]) => `${k}: ${[v].flat().join(' ')}`).join('; ') : '';
      throw new Error(`${out.message || `MailerLite returned ${res.status}`}${detail && !String(out.message).includes(detail) ? ` (${detail})` : ''}`);
    }
    return out as T;
  }
}

type Node = { type: 'text'; text: string; marks?: { type: string; attrs?: Record<string, string> }[] };
/** Text with [link text](https://...) turned into MailerLite text nodes with a link mark. */
function textNodes(s: string): Node[] {
  const out: Node[] = [];
  const re = /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g;
  let last = 0; let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    if (m.index > last) out.push({ type: 'text', text: s.slice(last, m.index) });
    out.push({ type: 'text', text: m[1], marks: [{ type: 'link', attrs: { href: m[2] } }] });
    last = m.index + m[0].length;
  }
  if (last < s.length) out.push({ type: 'text', text: s.slice(last) });
  return out.filter((n) => n.text);
}

/** A template name MailerLite accepts: no links, no {{ }} and no HTML. */
const templateName = (s: string) => s.replace(/https?:\/\/\S+/g, '').replace(/[{}<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 250);

/**
 * Saves one email as a template in the client's MailerLite. MailerLite can only save a campaign
 * email as a template, so this builds a draft campaign in the simple (drag and drop) editor, adds
 * the email block by block (works on every plan, unlike custom HTML), saves it as a template,
 * then deletes the draft campaign.
 */
export async function saveEmailTemplate(s: MailerLiteSettings | null, c: EmailCampaign, e: LaunchEmail, label: string): Promise<{ templateId: string; name: string }> {
  if (!s?.apiKey) throw new Error('MailerLite isn’t connected for this client. Add their API key in MailerLite details.');
  if (!s.fromEmail) throw new Error('Add the sender email (verified in their MailerLite) in MailerLite details.');
  const name = templateName(`${label} · ${e.n}. ${e.subject}`);
  const created = await mlCall<{ data: { id: string; emails: { id: string }[] } }>(s.apiKey, 'POST', '/campaigns', {
    name: templateName(`Template draft · ${name}`), type: 'regular',
    emails: [{ subject: e.subject.slice(0, 255), from_name: s.fromName || c.brand.name, from: s.fromEmail, editor: 'simple' }],
  });
  const campaignId = created.data.id;
  const emailId = created.data.emails?.[0]?.id;
  try {
    if (!emailId) throw new Error('MailerLite didn’t return the new email.');
    const got = await mlCall<{ etag: string; data: { blocks?: { id: string }[] } }>(s.apiKey, 'GET', `/emails/${emailId}`);
    let etag = String(got.etag);
    // Start from an empty email: clear any blocks MailerLite's blank template adds.
    for (const b of got.data.blocks ?? []) {
      try { const r = await mlCall<{ etag?: string }>(s.apiKey, 'DELETE', `/emails/${emailId}/blocks/${b.id}`, { etag }); if (r.etag) etag = String(r.etag); }
      catch { const again = await mlCall<{ etag: string }>(s.apiKey, 'GET', `/emails/${emailId}`); etag = String(again.etag); }
    }
    const add = async (type: string, editor_content: object) => {
      const r = await mlCall<{ etag: string }>(s.apiKey, 'POST', `/emails/${emailId}/blocks`, { etag, type, editor_content });
      etag = String(r.etag);
    };
    const para = (t: string) => add('paragraph', { content: textNodes(t) });
    if (e.heading?.trim()) await add('heading', { attrs: { level: 1, textAlign: 'left' }, content: textNodes(e.heading.trim()) });
    for (const p of e.body) if (p.trim()) await para(p.trim());
    if (e.button?.trim() && e.link) await add('button', { attrs: { url: e.link }, content: [{ type: 'text', text: e.button.trim() }] });
    if (e.ps?.trim()) await para(/^p\.?s\.?/i.test(e.ps.trim()) ? e.ps.trim() : `P.S. ${e.ps.trim()}`);
    const t = await mlCall<{ data: { id: string; name: string } }>(s.apiKey, 'POST', `/emails/${emailId}/templates`, { name });
    return { templateId: String(t.data.id), name: t.data.name ?? name };
  } finally {
    // The draft campaign was only a way in; the template stays after it's deleted.
    await mlCall(s.apiKey, 'DELETE', `/campaigns/${campaignId}`).catch(() => {});
  }
}

/** Adds (or updates) a pre-registered person in the client's pre-reg group. */
export async function addSubscriber(s: MailerLiteSettings | null, p: { email: string; name?: string; phone?: string }) {
  if (!s?.apiKey || !s.preregGroupId) return false;
  try {
    await ml(s.apiKey, '/subscribers', {
      email: p.email,
      fields: { ...(p.name ? { name: p.name } : {}), ...(p.phone ? { phone: p.phone } : {}) },
      groups: [s.preregGroupId],
    });
    return true;
  } catch (e) {
    console.error('MailerLite addSubscriber failed:', e);
    return false;
  }
}

/**
 * Creates the 12 launch emails as MailerLite campaigns and schedules each one.
 * Stops at the first error and records how far it got, so a retry never sends one twice.
 */
export async function scheduleLaunch(s: MailerLiteSettings | null, c: EmailCampaign, emails: LaunchEmail[]): Promise<MailerLiteState> {
  if (!s?.apiKey || !s.fromEmail) {
    return { state: 'not_connected', note: 'MailerLite is not connected for this client yet. Add their details in Agency · Emails, then press Schedule in MailerLite.' };
  }
  if (!c.launchDate) return { state: 'failed', note: 'Add a launch date before scheduling.' };

  const ids = [...(c.mailerlite.campaignIds ?? [])];
  const done = new Set(ids.map((x) => x.split(':')[0]));
  try {
    for (const e of emails) {
      if (done.has(e.id)) continue;
      const when = sendAt(c.launchDate, e.offset, e.time); // "2026-10-26T09:00"
      if (new Date(`${when}:00`).getTime() < Date.now()) throw new Error(`${e.id} would send in the past (${when}). Move the launch date first.`);
      const audience = e.list === 'prereg'
        ? { groups: [s.preregGroupId] }
        : s.publicSegmentId ? { segments: [s.publicSegmentId] } : { groups: [s.publicGroupId] };
      if (!(audience.groups?.[0] || audience.segments?.[0])) throw new Error(`No MailerLite ${e.list === 'prereg' ? 'pre-reg group' : 'general list group or segment'} set.`);
      const created = await ml(s.apiKey, '/campaigns', {
        name: `${c.brand.name} launch · ${e.list === 'prereg' ? 'Pre-reg' : 'General'} ${e.n}`,
        type: 'regular',
        emails: [{ subject: e.subject, from_name: s.fromName || c.brand.name, from: s.fromEmail, ...(s.useHtml ? { content: emailHtml(c, e) } : {}) }],
        ...audience,
      });
      const id = created?.data?.id;
      if (!id) throw new Error('MailerLite did not return a campaign id.');
      const [date, time] = when.split('T');
      await ml(s.apiKey, `/campaigns/${id}/schedule`, { delivery: 'scheduled', schedule: { date, hours: time.slice(0, 2), minutes: time.slice(3, 5) } });
      ids.push(`${e.id}:${id}`);
    }
    return { state: 'scheduled', note: `${ids.length} emails scheduled in MailerLite`, at: new Date().toISOString(), campaignIds: ids };
  } catch (e) {
    return { state: 'failed', note: `Stopped after ${ids.length} of ${emails.length}: ${e instanceof Error ? e.message : String(e)}`, at: new Date().toISOString(), campaignIds: ids };
  }
}
