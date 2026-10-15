/** A client's Stripe connection. The secrets never leave the server. */
export interface StripeSettings {
  clientId: string;
  /** whsec_… from the webhook in the client's Stripe account. */
  signingSecret: string;
  /** Optional read-only restricted key (rk_live_…), for importing past payments. */
  apiKey?: string;
  connectedAt: string;
  lastEventAt?: string;
  lastNote?: string;
}

/** What the agency screen sees of a Stripe connection. */
export interface StripePublic {
  clientId: string;
  connected: boolean;
  hasKey: boolean;
  connectedAt?: string;
  lastEventAt?: string;
  lastNote?: string;
}

/** Money and subscription details on a lead, from Stripe. Amounts are in pounds. */
export interface LeadPayments {
  customerId?: string;
  /** Everything they've paid, less refunds. */
  totalPaid: number;
  currency: string;
  plan?: string;
  /** active, trialing, past due, cancelled, payment failed, refunded or paid (one-off). */
  status?: string;
  /** Monthly value of their subscription, while it's active. */
  mrr?: number;
  renewsAt?: string;
  subscriptionId?: string;
  lastPaidAt?: string;
}

/** Statuses that count towards monthly recurring revenue. */
export const RECURRING = ['active', 'trialing', 'past due'];

const SYMBOL: Record<string, string> = { gbp: '£', usd: '$', eur: '€', aud: 'A$', cad: 'C$' };
export const money = (n: number, currency = 'gbp') => {
  const s = SYMBOL[currency.toLowerCase()] ?? currency.toUpperCase() + ' ';
  return s + n.toLocaleString('en-GB', { minimumFractionDigits: n % 1 ? 2 : 0, maximumFractionDigits: 2 });
};

/** One line for the lead's Stripe row, e.g. "£16.99/mo · Active · £50.97 paid". */
export function paymentsSummary(p: LeadPayments) {
  const parts = [];
  if (p.mrr && RECURRING.includes(p.status ?? '')) parts.push(`${money(p.mrr, p.currency)}/mo`);
  if (p.status) parts.push(p.status.charAt(0).toUpperCase() + p.status.slice(1));
  parts.push(`${money(p.totalPaid, p.currency)} paid`);
  return parts.join(' · ');
}
