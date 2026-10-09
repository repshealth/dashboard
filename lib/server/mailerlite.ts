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
