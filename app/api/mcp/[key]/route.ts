import { createBackend } from '@/lib/backend/core';
import type { ClientRec, ViewerRec } from '@/lib/backend/core';
import { context, errorReply } from '@/lib/server/backend';
import { sha256 } from '@/lib/server/auth';
import { setting } from '@/lib/server/env';
import { handleMcp } from '@/lib/server/tasks-mcp';

/**
 * The Tasks connector for Claude (claude.ai custom connector).
 *
 *   https://<dashboard>/api/mcp/<TASKS_CONNECTOR_KEY>
 *
 * claude.ai connectors can't send custom headers, so the key is part of the address.
 * Treat the whole URL like a password. Without TASKS_CONNECTOR_KEY set, it's switched off.
 */

/** Claude acts as the REPS team, so tasks it marks done show "REPS team". */
const CLAUDE: ViewerRec = { id: 'claude-connector', name: 'REPS team', email: '', isAdmin: true };

async function allowed(key: string) {
  const want = setting('TASKS_CONNECTOR_KEY');
  if (!want || want.length < 24) return false;
  // Compare hashes so the check takes the same time whatever was sent.
  const [a, b] = await Promise.all([sha256(key), sha256(want)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const NO = () => Response.json({ error: 'Not found.' }, { status: 404 });

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(await allowed(decodeURIComponent(key)))) return NO();
  const body = await req.json().catch(() => undefined);
  if (body === undefined) return Response.json({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, { status: 400 });
  try {
    const { store, services } = context(req);
    const backend = createBackend(store, services, async () => CLAUDE, 'live');
    const clients = async () => (await store.list<ClientRec>('client')).map((c) => ({ id: c.id, slug: c.slug, name: c.name }));
    const msgs = Array.isArray(body) ? body : [body];
    const out = (await Promise.all(msgs.map((m) => handleMcp(backend, m, clients)))).filter(Boolean);
    if (!out.length) return new Response(null, { status: 202 });
    return Response.json(Array.isArray(body) ? out : out[0]);
  } catch (e) {
    return errorReply(e);
  }
}

/** No server-to-client stream; replies come back on each POST. */
export async function GET(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(await allowed(decodeURIComponent(key)))) return NO();
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!(await allowed(decodeURIComponent(key)))) return NO();
  return new Response(null, { status: 405, headers: { Allow: 'POST' } });
}
