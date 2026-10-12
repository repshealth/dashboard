import { context, errorReply } from '@/lib/server/backend';
import { syncSiteFromGitHub } from '@/lib/backend/core';
import { setting } from '@/lib/server/env';
import type { Site } from '@/lib/types';

export const maxDuration = 60;

/** Checks GitHub's signature on the delivery, so only GitHub can trigger an update. */
async function signed(req: Request, body: string) {
  const secret = setting('GITHUB_WEBHOOK_SECRET');
  const sig = req.headers.get('x-hub-signature-256') || '';
  if (!secret || !sig.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  const hex = [...mac].map((b) => b.toString(16).padStart(2, '0')).join('');
  const got = sig.slice(7);
  if (got.length !== hex.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

/**
 * POST /api/github  GitHub webhook (push events) from a client's website repo.
 * Each push to the connected branch adds a new version to that client's Website section.
 */
export async function POST(req: Request) {
  const body = await req.text();
  if (!(await signed(req, body))) return Response.json({ error: 'Bad signature.' }, { status: 401 });
  const event = req.headers.get('x-github-event');
  if (event === 'ping') return Response.json({ ok: true });
  if (event !== 'push') return Response.json({ ok: true, ignored: event });
  try {
    const p = JSON.parse(body) as { ref?: string; repository?: { full_name?: string } };
    const repo = (p.repository?.full_name || '').toLowerCase();
    const { store, services } = context(req);
    const sites = (await store.list<Site>('site')).filter((s) => s.github?.repo.toLowerCase() === repo);
    const results = [];
    for (const s of sites) {
      if (p.ref !== `refs/heads/${s.github!.branch || 'main'}`) continue;
      results.push(await syncSiteFromGitHub(store, services, s.clientId).catch((e) => ({ added: false, note: String(e?.message || e) })));
    }
    return Response.json({ ok: true, results });
  } catch (e) {
    return errorReply(e);
  }
}
