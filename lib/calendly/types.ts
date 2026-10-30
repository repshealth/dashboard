/** A client's Calendly connection. The token and signing key never leave the server. */
export interface CalendlySettings {
  clientId: string;
  /** Personal access token from the client's Calendly (Integrations, API and webhooks). */
  token: string;
  /** Used to check each booking update really came from Calendly. */
  signingKey: string;
  webhookUri?: string;
  userUri: string;
  orgUri: string;
  userName?: string;
  userEmail?: string;
  timezone?: string;
  /** Their call types, as Calendly names them. */
  eventTypes: { uri: string; name: string; active: boolean }[];
  /** Only bookings of these call types count. Empty means all of them. */
  only: string[];
  connectedAt: string;
  lastEventAt?: string;
  lastNote?: string;
}

/** What the agency screen sees of a Calendly connection. */
export interface CalendlyPublic {
  clientId: string;
  connected: boolean;
  webhook: boolean;
  userName?: string;
  userEmail?: string;
  eventTypes: { uri: string; name: string; active: boolean }[];
  only: string[];
  connectedAt?: string;
  lastEventAt?: string;
  lastNote?: string;
}

/** A lead's latest Calendly booking. */
export interface LeadBooking {
  /** The call type, e.g. "Discovery Call". */
  name: string;
  start: string; // ISO
  status: 'booked' | 'cancelled' | 'no-show' | 'past';
  inviteeUri: string;
  eventUri: string;
  rescheduleUrl?: string;
  cancelUrl?: string;
  cancelReason?: string;
}

/** "Tue 4 Nov, 2:00pm" in the client's time zone (UK by default). */
export function fmtCall(iso: string, timeZone = 'Europe/London') {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true }).formatToParts(d);
    const g = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    return `${g('weekday')} ${g('day')} ${g('month')}, ${g('hour')}:${g('minute')}${g('dayPeriod').toLowerCase().replace(/\s/g, '')}`;
  } catch {
    return d.toUTCString();
  }
}
