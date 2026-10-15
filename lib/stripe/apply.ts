import type { DocStore } from '../backend/store';
import type { Lead, LeadEvent } from '../types';
import { money, paymentsSummary, type LeadPayments } from './types';

/**
 * Turns Stripe payment events into lead updates: matches the payer to a lead by email (or by
 * their Stripe customer), moves them to Purchased, and keeps their total paid, plan,
 * subscription status and monthly value up to date.
 */

type Obj = Record<string, unknown>;
const o = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && isFinite(v) ? v : 0);
const pounds = (pence: number) => Math.round(pence) / 100;
const iso = (sec: unknown) => (num(sec) ? new Date(num(sec) * 1000).toISOString() : undefined);
const idOf = (v: unknown) => (typeof v === 'string' ? v : str(o(v).id));

export interface StripeCtx {
  store: DocStore;
  clientId: string;
  newId(): string;
  /** GET from the Stripe API with the client's restricted key, or null without one. */
  get?(path: string): Promise<Obj | null>;
  meta: { lead: (l: Lead) => { clientId?: string | null; key?: string | null; sort?: string | null } };
}

const STATUS: Record<string, string> = {
  active: 'active', trialing: 'trialing', past_due: 'past due', unpaid: 'past due', canceled: 'cancelled',
  incomplete: 'payment failed', incomplete_expired: 'cancelled', paused: 'paused',
};

/** Monthly value of a subscription from its first price. */
function subscriptionMonthly(sub: Obj) {
  let total = 0;
  for (const item of (o(sub.items).data as Obj[] | undefined) ?? []) {
    const price = o(item.price);
    const rec = o(price.recurring);
    const amount = pounds(num(price.unit_amount)) * (num(item.quantity) || 1);
    const count = num(rec.interval_count) || 1;
    const per: Record<string, number> = { day: 365 / 12, week: 52 / 12, month: 1, year: 1 / 12 };
    total += amount * (per[str(rec.interval)] ?? 1) / count;
  }
  return Math.round(total * 100) / 100;
}

function planName(sub: Obj) {
  const item = ((o(sub.items).data as Obj[] | undefined) ?? [])[0];
  const price = o(item?.price);
  return str(price.nickname) || str(o(price.product).name) || undefined;
}

/** "1 × Physique X Monthly (at £16.99 / month)" -> "Physique X Monthly" */
const cleanLine = (s: string) => s.replace(/^\d+\s*[×x]\s*/, '').replace(/\s*\(at [^)]*\)\s*$/, '').trim();

function event(newId: () => string, label: string): LeadEvent {
  return { id: newId(), label, source: 'Stripe', at: new Date().toISOString() };
}

async function leadByCustomer(c: StripeCtx, customerId: string) {
  if (!customerId) return null;
  const leads = await c.store.list<Lead>('lead', { clientId: c.clientId });
  return leads.find((l) => l.payments?.customerId === customerId) ?? null;
}

/** Finds the lead for a payer, or adds them as a new one (people can pay without filling in a form). */
async function findOrCreate(c: StripeCtx, who: { email?: string; name?: string; phone?: string; customerId?: string }) {
  if (who.customerId) {
    const l = await leadByCustomer(c, who.customerId);
    if (l) return l;
  }
  let email = (who.email || '').trim().toLowerCase();
  if (!email && who.customerId && c.get) {
    const cust = await c.get(`/v1/customers/${who.customerId}`).catch(() => null);
    email = str(cust?.email).toLowerCase();
    who.name ||= str(cust?.name);
    who.phone ||= str(cust?.phone);
  }
  if (!email) return null;
  const found = await c.store.byKey<Lead>('lead', `${c.clientId}|${email}`);
  if (found) return found.doc;
  const lead: Lead = {
    id: c.newId(), clientId: c.clientId, name: who.name || email, email, phone: who.phone || undefined,
    source: 'stripe', form: 'Stripe checkout', stage: 'new', firstSeen: new Date().toISOString(), value: 0,
    answers: [], submissions: [], events: [event(c.newId, 'Became a customer in Stripe')],
  };
  await c.store.put('lead', lead.id, lead, c.meta.lead(lead));
  return lead;
}

/** Applies a change to a lead's payments and refreshes the card. */
async function update(c: StripeCtx, lead: Lead, fn: (p: LeadPayments, l: Lead) => string | null) {
  await c.store.mutate<Lead>('lead', lead.id, (l) => {
    const p: LeadPayments = { totalPaid: 0, currency: 'gbp', ...(l.payments ?? {}) };
    const label = fn(p, l);
    l.payments = p;
    l.value = Math.round(p.totalPaid * 100) / 100;
    l.stripe = paymentsSummary(p);
    if (p.totalPaid > 0 || (p.status && ['active', 'trialing'].includes(p.status))) {
      l.stage = 'purchased';
      l.headline = money(p.totalPaid, p.currency);
      l.detail = `Stripe · ${p.plan || 'Payment'}`;
    }
    if (label) l.events.unshift(event(c.newId, label));
  }, c.meta.lead);
}

/** A subscription seen before we knew who the customer was: kept until their first payment. */
const pendingKey = (c: StripeCtx, customerId: string) => `stripe-sub:${c.clientId}:${customerId}`;

function applySub(p: LeadPayments, sub: Obj) {
  const status = STATUS[str(sub.status)] ?? str(sub.status);
  p.subscriptionId = str(sub.id) || p.subscriptionId;
  p.status = status;
  p.plan = planName(sub) || p.plan;
  p.mrr = ['active', 'trialing', 'past due'].includes(status) ? subscriptionMonthly(sub) : 0;
  const item = ((o(sub.items).data as Obj[] | undefined) ?? [])[0];
  p.renewsAt = status === 'cancelled' ? undefined : iso(sub.current_period_end ?? o(item).current_period_end) ?? p.renewsAt;
  const cur = str(sub.currency);
  if (cur) p.currency = cur;
}

/** Handles one Stripe event. Returns a short note for the agency screen. */
export async function applyStripeEvent(c: StripeCtx, evt: Obj): Promise<string> {
  const type = str(evt.type);
  const obj = o(o(evt.data).object);
  const prev = o(o(evt.data).previous_attributes);

  if (type === 'checkout.session.completed') {
    const cd = o(obj.customer_details);
    const lead = await findOrCreate(c, { email: str(cd.email) || str(obj.customer_email), name: str(cd.name), phone: str(cd.phone), customerId: idOf(obj.customer) });
    if (!lead) return 'Checkout without an email, skipped';
    const oneOff = str(obj.mode) === 'payment';
    const amount = pounds(num(obj.amount_total));
    await update(c, lead, (p) => {
      if (idOf(obj.customer)) p.customerId = idOf(obj.customer);
      p.currency = str(obj.currency) || p.currency;
      // Subscriptions are counted when their invoice is paid; one-off payments here.
      if (oneOff && amount) {
        p.totalPaid += amount; p.lastPaidAt = new Date().toISOString();
        if (!p.status || p.status === 'refunded') p.status = 'paid';
        return `Paid ${money(amount, p.currency)} at checkout`;
      }
      return 'Started a subscription at checkout';
    });
    await claimPending(c, idOf(obj.customer));
    return `Checkout from ${lead.email}`;
  }

  if (type === 'invoice.paid') {
    const amount = pounds(num(obj.amount_paid));
    const lead = await findOrCreate(c, { email: str(obj.customer_email), name: str(obj.customer_name), phone: str(obj.customer_phone), customerId: idOf(obj.customer) });
    if (!lead) return 'Invoice without an email, skipped';
    const line = ((o(obj.lines).data as Obj[] | undefined) ?? [])[0];
    const plan = cleanLine(str(o(line).description));
    await update(c, lead, (p) => {
      if (idOf(obj.customer)) p.customerId = idOf(obj.customer);
      p.currency = str(obj.currency) || p.currency;
      if (plan) p.plan = plan;
      if (!amount) return null;
      p.totalPaid += amount; p.lastPaidAt = new Date().toISOString();
      if (!p.status || ['payment failed', 'past due', 'paid', 'refunded'].includes(p.status)) p.status = idOf(obj.subscription) ? 'active' : 'paid';
      return `Paid ${money(amount, p.currency)}${plan ? ` · ${plan}` : ''}`;
    });
    await claimPending(c, idOf(obj.customer));
    return `${money(amount, str(obj.currency) || 'gbp')} from ${lead.email}`;
  }

  if (type === 'invoice.payment_failed') {
    const lead = await findOrCreate(c, { email: str(obj.customer_email), customerId: idOf(obj.customer) });
    if (!lead) return 'Failed payment for an unknown customer';
    await update(c, lead, (p) => { p.status = 'payment failed'; return `Payment of ${money(pounds(num(obj.amount_due)), str(obj.currency) || p.currency)} failed`; });
    return `Failed payment from ${lead.email}`;
  }

  if (type.startsWith('customer.subscription.')) {
    const customerId = idOf(obj.customer);
    const lead = (await leadByCustomer(c, customerId)) ?? (c.get ? await findOrCreate(c, { customerId }) : null);
    if (!lead) {
      // Usually the first payment arrives a moment later and links the customer.
      await c.store.put('setting', pendingKey(c, customerId), { sub: obj, at: new Date().toISOString() }, {});
      return 'Subscription saved until the first payment arrives';
    }
    await update(c, lead, (p) => {
      const was = p.status;
      applySub(p, obj);
      if (type === 'customer.subscription.deleted') return `Subscription cancelled${p.plan ? ` · ${p.plan}` : ''}`;
      if (type === 'customer.subscription.created') return `Subscribed${p.plan ? ` · ${p.plan}` : ''}${p.mrr ? ` (${money(p.mrr, p.currency)}/mo)` : ''}`;
      if (o(prev).cancel_at_period_end === false && obj.cancel_at_period_end) return `Set to cancel at the end of the period${p.renewsAt ? ` (${p.renewsAt.slice(0, 10)})` : ''}`;
      return was !== p.status ? `Subscription now ${p.status}` : null;
    });
    return `Subscription ${str(obj.status)} for ${lead.email}`;
  }

  if (type === 'charge.refunded') {
    const delta = pounds(num(obj.amount_refunded) - num(prev.amount_refunded));
    const bd = o(obj.billing_details);
    const lead = await findOrCreate(c, { email: str(bd.email) || str(obj.receipt_email), customerId: idOf(obj.customer) });
    if (!lead || delta <= 0) return 'Refund for an unknown customer';
    await update(c, lead, (p) => {
      p.totalPaid = Math.max(0, Math.round((p.totalPaid - delta) * 100) / 100);
      if (obj.refunded && !['active', 'trialing'].includes(p.status ?? '')) p.status = 'refunded';
      return `Refunded ${money(delta, p.currency)}`;
    });
    return `Refund to ${lead.email}`;
  }

  return `Ignored ${type}`;
}

/** Applies a subscription that arrived before we knew who its customer was. */
async function claimPending(c: StripeCtx, customerId: string) {
  if (!customerId) return;
  const pending = await c.store.get<{ sub: Obj }>('setting', pendingKey(c, customerId));
  if (!pending) return;
  const lead = await leadByCustomer(c, customerId);
  if (!lead) return;
  await update(c, lead, (p) => { applySub(p, pending.sub); return null; });
  await c.store.del('setting', pendingKey(c, customerId));
}

/**
 * Imports past payments with the client's read-only key: every successful charge (less refunds)
 * and each customer's latest subscription. Totals are recalculated, so it's safe to run again.
 */
export async function importStripeHistory(c: StripeCtx) {
  if (!c.get) throw new Error('Add a restricted key to import past payments.');
  type Agg = { email: string; name?: string; phone?: string; customerId?: string; paid: number; currency: string; last?: string };
  const byEmail = new Map<string, Agg>();
  const emailOfCustomer = new Map<string, string>();
  let after = '';
  let charges = 0;
  for (let page = 0; page < 10; page++) {
    const r = await c.get(`/v1/charges?limit=100&expand[]=data.customer${after ? `&starting_after=${after}` : ''}`);
    const data = (r?.data as Obj[] | undefined) ?? [];
    for (const ch of data) {
      if (str(ch.status) !== 'succeeded' || !ch.paid) continue;
      const cust = o(ch.customer);
      const email = (str(o(ch.billing_details).email) || str(ch.receipt_email) || str(cust.email)).toLowerCase();
      if (!email) continue;
      charges++;
      const a = byEmail.get(email) ?? { email, paid: 0, currency: str(ch.currency) || 'gbp' };
      a.paid += pounds(num(ch.amount) - num(ch.amount_refunded));
      a.name ||= str(o(ch.billing_details).name) || str(cust.name);
      a.phone ||= str(o(ch.billing_details).phone) || str(cust.phone);
      a.customerId ||= idOf(ch.customer) || undefined;
      const at = iso(ch.created);
      if (at && (!a.last || at > a.last)) a.last = at;
      byEmail.set(email, a);
      if (a.customerId) emailOfCustomer.set(a.customerId, email);
    }
    if (!r?.has_more || !data.length) break;
    after = str(data[data.length - 1].id);
  }

  const subs = new Map<string, Obj>();
  after = '';
  for (let page = 0; page < 5; page++) {
    const r = await c.get(`/v1/subscriptions?status=all&limit=100&expand[]=data.items.data.price.product${after ? `&starting_after=${after}` : ''}`);
    const data = (r?.data as Obj[] | undefined) ?? [];
    for (const s of data) {
      const cid = idOf(s.customer);
      const seen = subs.get(cid);
      // Keep each customer's newest subscription.
      if (!seen || num(s.created) > num(seen.created)) subs.set(cid, s);
    }
    if (!r?.has_more || !data.length) break;
    after = str(data[data.length - 1].id);
  }

  let customers = 0;
  for (const a of byEmail.values()) {
    const lead = await findOrCreate(c, { email: a.email, name: a.name, phone: a.phone, customerId: a.customerId });
    if (!lead) continue;
    customers++;
    const sub = a.customerId ? subs.get(a.customerId) : undefined;
    await update(c, lead, (p, l) => {
      const first = !l.events.some((e) => e.label.startsWith('Imported from Stripe'));
      p.totalPaid = Math.round(a.paid * 100) / 100;
      p.currency = a.currency;
      p.customerId = a.customerId || p.customerId;
      p.lastPaidAt = a.last || p.lastPaidAt;
      if (sub) applySub(p, sub); else if (!p.status) p.status = p.totalPaid > 0 ? 'paid' : 'refunded';
      return first ? `Imported from Stripe: ${money(p.totalPaid, p.currency)} paid so far` : null;
    });
  }
  return { charges, customers, note: `Imported ${charges} payment${charges === 1 ? '' : 's'} from ${customers} customer${customers === 1 ? '' : 's'}` };
}
