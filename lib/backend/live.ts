import type { Backend } from './types';

/** Calls the server (app/api/rpc) for every dashboard action. */
async function rpc(method: string, args: unknown[]) {
  const res = await fetch('/api/rpc', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ method, args }),
  });
  const out = await res.json().catch(() => ({}));
  if (res.status === 401 && method !== 'getViewer') {
    window.location.href = '/login';
    throw new Error('Please sign in again.');
  }
  if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
  return out.result;
}

export const liveBackend = new Proxy({ mode: 'live' } as Backend, {
  get(target, prop: string) {
    if (prop === 'mode') return 'live';
    if (prop === 'signOut') return async () => { await fetch('/api/auth/signout', { method: 'POST' }); };
    if (prop === 'signIn') return async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify({ email, password }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || 'Something went wrong. Please try again.');
      const v = await rpc('getViewer', []);
      if (!v) throw new Error('Signed in, but the session didn’t stick. Check cookies are allowed for this site.');
      return v;
    };
    if (prop === 'getViewer') return async () => rpc('getViewer', []).catch(() => null);
    if (prop === 'then') return undefined;
    return (...args: unknown[]) => rpc(prop, args);
  },
});
