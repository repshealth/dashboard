import { createBackend, AccessError } from '../backend/core';
import { D1Store } from './d1-store';
import { liveServices } from './services';
import { viewerFrom } from './auth';
import { cf, list } from './env';

/** The data store, services and signed-in viewer for one request. */
export function context(req: Request) {
  const db = cf().DB;
  if (!db) throw new AccessError('The database isn’t connected yet. Add the D1 binding (see README).', 503);
  const store = new D1Store(db);
  const origin = new URL(req.url).origin;
  const services = liveServices(store, origin);
  let viewer: ReturnType<typeof viewerFrom> | null = null;
  const who = () => (viewer ??= viewerFrom(store, req));
  return { store, services, who, backend: createBackend(store, services, who, 'live'), ownDomains: list('REPS_EMAIL_DOMAINS') };
}

/** Turns an error into a JSON reply. Access and validation errors keep their message. */
export function errorReply(e: unknown, headers?: HeadersInit) {
  if (e instanceof AccessError) return Response.json({ error: e.message }, { status: e.status, headers });
  console.error(e);
  const msg = e instanceof Error && /someone else at the same time/.test(e.message) ? e.message : 'Something went wrong. Please try again.';
  return Response.json({ error: msg }, { status: 500, headers });
}
