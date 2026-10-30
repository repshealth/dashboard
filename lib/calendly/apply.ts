import type { DocStore } from '../backend/store';
import type { Lead, LeadEvent, StageId } from '../types';
import { fmtCall, type CalendlySettings, type LeadBooking } from './types';

/**
 * Turns Calendly booking updates into lead updates: matches the person to a lead by email,
 * moves them to Call booked, back to Nurturing if they cancel, and to Showed / No-show when
 * the call is marked as a no-show (or has passed, for imported bookings).
 */

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : '');

export interface CalendlyCtx {
  store: DocStore;
  clientId: string;
  settings: CalendlySettings;
  newId(): string;
  /** Calls the Calendly API with the client's token. */
  api?(method: string, url: string, body?: unknown): Promise<Obj>;
  meta: { lead: (l: Lead) => { clientId?: string | null; key?: string | null; sort?: string | null } };
}

const event = (newId: () => string, label: string): LeadEvent => ({ id: newId(), label, source: 'Calendly', at: new Date().toISOString() });

/** Stages a booking can move someone out of. Purchased leads stay where they are. */
const MOVABLE: StageId[] = ['new', 'nurture', 'call', 'showed', 'lost'];

/** Whether this call type counts for the client. */
const counts = (s: CalendlySettings, eventTypeUri: string) => !s.only.length || s.only.includes(eventTypeUri);

async function leadByInvitee(c: CalendlyCtx, inviteeUri: string) {
  const leads = await c.store.list<Lead>('lead', { clientId: c.clientId });
  return leads.find((l) => l.booking?.inviteeUri === inviteeUri) ?? null;
}

/** Finds the lead for an email, or adds them (people can book without filling in a form). */
async function findOrCreate(c: CalendlyCtx, who: { email: string; name: string; phone?: string; eventName: string }) {
  const email = who.email.trim().toLowerCase();
  const found = await c.store.byKey<Lead>('lead', `${c.clientId}|${email}`);
  if (found) return { lead: found.doc, created: false };
  const lead: Lead = {
    id: c.newId(), clientId: c.clientId, name: who.name || email, email, phone: who.phone || undefined,
    source: 'calendly', form: `Calendly · ${who.eventName}`, stage: 'new', firstSeen: new Date().toISOString(), value: 0,
    answers: [], submissions: [], events: [],
  };
  await c.store.put('lead', lead.id, lead, c.meta.lead(lead));
  return { lead, created: true };
}

/** Records a booking on a lead and moves them to the right stage. */
async function book(c: CalendlyCtx, inv: Obj, ev: Obj, opts: { imported?: boolean } = {}) {
  const email = str(inv.email);
  if (!email) return 'Booking without an email, ignored.';
  const eventName = str(ev.name) || 'Call';
  const start = str(ev.start_time);
  const past = Boolean(start) && Date.parse(start) < Date.now();
  const noShow = Boolean(inv.no_show);
  const phone = str(inv.text_reminder_number);
  const qa = (Array.isArray(inv.questions_and_answers) ? inv.questions_and_answers : []).map((x) => [str(o(x).question), str(o(x).answer)] as [string, string]).filter(([q, a]) => q && a);
  const { lead } = await findOrCreate(c, { email, name: str(inv.name), phone, eventName });
  const when = fmtCall(start, c.settings.timezone);
  const booking: LeadBooking = {
    name: eventName, start, status: noShow ? 'no-show' : past && opts.imported ? 'past' : 'booked',
    inviteeUri: str(inv.uri), eventUri: str(ev.uri), rescheduleUrl: str(inv.reschedule_url) || undefined, cancelUrl: str(inv.cancel_url) || undefined,
  };
  const tracking = o(inv.tracking);
  await c.store.mutate<Lead>('lead', lead.id, (l) => {
    // An import never repeats a booking the lead already has.
    if (opts.imported && l.booking?.inviteeUri === booking.inviteeUri) return;
    l.booking = booking;
    l.calendly = `${eventName} · ${when}`;
    l.detail = `Calendly · ${eventName}`;
    if (!l.phone && phone) l.phone = phone;
    if (!l.utm && str(tracking.utm_campaign)) l.utm = str(tracking.utm_campaign);
    if (MOVABLE.includes(l.stage)) {
      if (noShow) { l.stage = 'showed'; l.attended = false; }
      else if (past && opts.imported) { l.stage = 'showed'; }
      else { l.stage = 'call'; l.attended = null; }
    }
    if (qa.length) {
      const form = `Calendly · ${eventName}`;
      l.submissions = [{ form, source: 'calendly', at: str(inv.created_at) || new Date().toISOString(), answers: qa }, ...(l.submissions ?? []).filter((x) => x.form !== form)];
    }
    l.events.unshift(event(c.newId, `${opts.imported ? 'Booked (imported)' : 'Booked'} ${eventName} for ${when}`));
  }, c.meta.lead);
  return `${str(inv.name) || email} booked ${eventName} for ${when}.`;
}

async function cancel(c: CalendlyCtx, inv: Obj, ev: Obj) {
  // A reschedule cancels the old booking and creates a new one straight after.
  if (inv.rescheduled) return 'Rescheduled: the new booking updates the lead.';
  const email = str(inv.email).toLowerCase();
  const found = email ? await c.store.byKey<Lead>('lead', `${c.clientId}|${email}`) : null;
  const lead = found?.doc ?? (await leadByInvitee(c, str(inv.uri)));
  if (!lead) return 'Cancellation for someone not in the CRM, ignored.';
  const reason = str(o(inv.cancellation).reason);
  const eventName = str(ev.name) || lead.booking?.name || 'Call';
  await c.store.mutate<Lead>('lead', lead.id, (l) => {
    if (l.booking && l.booking.inviteeUri && l.booking.inviteeUri !== str(inv.uri)) return; // an older booking
    l.booking = { ...(l.booking ?? { name: eventName, start: str(ev.start_time), inviteeUri: str(inv.uri), eventUri: str(ev.uri) }), status: 'cancelled', cancelReason: reason || undefined };
    l.calendly = `${eventName} · cancelled`;
    if (l.stage === 'call') l.stage = 'nurture';
    l.events.unshift(event(c.newId, `Cancelled ${eventName}${reason ? `: ${reason}` : ''}`));
  }, c.meta.lead);
  return `${lead.name} cancelled ${eventName}.`;
}

async function noShow(c: CalendlyCtx, inviteeUri: string, marked: boolean) {
  let lead = await leadByInvitee(c, inviteeUri);
  if (!lead && c.api) {
    const inv = o((await c.api('GET', inviteeUri).catch((): Obj => ({}))).resource);
    const email = str(inv.email).toLowerCase();
    lead = email ? (await c.store.byKey<Lead>('lead', `${c.clientId}|${email}`))?.doc ?? null : null;
  }
  if (!lead) return 'No-show for someone not in the CRM, ignored.';
  await c.store.mutate<Lead>('lead', lead.id, (l) => {
    if (marked) {
      if (MOVABLE.includes(l.stage)) l.stage = 'showed';
      l.attended = false;
      if (l.booking) l.booking.status = 'no-show';
      l.events.unshift(event(c.newId, `Marked as a no-show for ${l.booking?.name ?? 'their call'}`));
    } else {
      l.attended = null;
      if (l.booking?.status === 'no-show') l.booking.status = 'past';
      l.events.unshift(event(c.newId, 'No-show mark removed in Calendly'));
    }
  }, c.meta.lead);
  return marked ? `${lead.name} marked as a no-show.` : `${lead.name}'s no-show mark removed.`;
}

/** Handles one webhook from Calendly. Returns a short note for the connection status. */
export async function applyCalendlyEvent(c: CalendlyCtx, body: Obj): Promise<string> {
  const kind = str(body.event);
  const p = o(body.payload);
  if (kind === 'invitee.created' || kind === 'invitee.canceled') {
    const ev = o(p.scheduled_event);
    if (!counts(c.settings, str(ev.event_type))) return `${str(ev.name) || 'That call type'} isn't counted, ignored.`;
    return kind === 'invitee.created' ? book(c, p, ev) : cancel(c, p, ev);
  }
  if (kind === 'invitee_no_show.created') return noShow(c, str(p.invitee), true);
  if (kind === 'invitee_no_show.deleted') return noShow(c, str(p.invitee), false);
  return `${kind || 'Unknown update'} ignored.`;
}

/**
 * Pulls in bookings from the last 60 days and the future, newest first. Capped so one import
 * stays within Cloudflare's limits; run it again to continue if needed.
 */
export async function importCalendlyBookings(c: CalendlyCtx, max = 40) {
  if (!c.api) throw new Error('Calendly isn’t connected.');
  const since = new Date(Date.now() - 60 * 864e5).toISOString();
  const q = new URLSearchParams({ user: c.settings.userUri, status: 'active', min_start_time: since, count: '100', sort: 'start_time:desc' });
  const list = await c.api('GET', `/scheduled_events?${q}`);
  const events = ((list.collection as Obj[]) ?? []).filter((e) => counts(c.settings, str(e.event_type))).slice(0, max);
  let booked = 0;
  for (const ev of events) {
    const uuid = str(ev.uri).split('/').pop();
    const invs = await c.api('GET', `/scheduled_events/${uuid}/invitees?count=20&status=active`).catch(() => ({ collection: [] as Obj[] }));
    for (const inv of (invs.collection as Obj[]) ?? []) {
      await book(c, inv, ev, { imported: true });
      booked++;
    }
  }
  return { booked, note: booked ? `Imported ${booked} booking${booked === 1 ? '' : 's'} from Calendly.` : 'No bookings in the last 60 days or coming up.' };
}
