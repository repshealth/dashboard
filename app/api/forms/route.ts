import { context, errorReply } from '@/lib/server/backend';
import { captureLead } from '@/lib/backend/core';
import type { SourceId } from '@/lib/types';

/**
 * Website forms post leads here.
 *
 *   POST /api/forms
 *   { "client": "physique-x", "email": "...", "name": "...", "source": "magnet",
 *     "form": "Starter guide", "page": "/", "utm_campaign": "...", "answers": { "Main goal": "..." } }
 *
 * JSON or a normal form post both work. A new email creates a lead in New lead.
 * A returning email adds a timeline entry instead of creating a duplicate.
 */

const SOURCES = ['quiz', 'magnet', 'survey', 'ads', 'news', 'prereg'] as const;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};
const reply = (status: number, body: object) => Response.json(body, { status, headers: cors });

export function OPTIONS() {
  return new Response(null, { status: 204, headers: cors });
}

const str = (v: unknown, max = 300) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

export async function POST(req: Request) {
  // Accept JSON or a regular HTML form post.
  let body: Record<string, unknown> = {};
  try {
    const type = req.headers.get('content-type') || '';
    if (type.includes('application/json')) body = await req.json();
    else {
      const fd = await req.formData();
      const answers: Record<string, string> = {};
      fd.forEach((v, k) => {
        if (k.startsWith('answers[') && typeof v === 'string') answers[k.slice(8, -1)] = v;
        else body[k] = v;
      });
      if (Object.keys(answers).length) body.answers = answers;
    }
  } catch {
    return reply(400, { ok: false, error: 'Could not read the form.' });
  }

  // Honeypot: a hidden field real visitors never fill in.
  if (str(body._gotcha)) return reply(200, { ok: true });

  const slug = str(body.client, 80);
  const email = str(body.email, 200).toLowerCase();
  if (!slug) return reply(400, { ok: false, error: 'Missing client.' });
  if (!EMAIL.test(email)) return reply(400, { ok: false, error: 'Please enter a valid email.' });

  const source = ((SOURCES as readonly string[]).includes(str(body.source)) ? str(body.source) : 'magnet') as SourceId;
  const rawAnswers = body.answers && typeof body.answers === 'object' ? (body.answers as Record<string, unknown>) : {};
  try {
    const { store, services } = context(req);
    await captureLead(store, services, {
      slug, email, source,
      name: str(body.name, 120) || [str(body.first_name, 60), str(body.last_name, 60)].filter(Boolean).join(' '),
      phone: str(body.phone, 40),
      form: str(body.form, 120),
      page: str(body.page, 200),
      utm: str(body.utm_campaign, 120) || str(body.utm, 120),
      answers: Object.entries(rawAnswers).slice(0, 20).map(([k, v]) => [str(k, 80), str(String(v ?? ''), 300)] as [string, string]),
    });
  } catch (e) {
    return errorReply(e, cors);
  }

  // A normal (non-JS) form post gets sent back to a thank-you page when one is given.
  const redirect = str(body._redirect, 300);
  if (redirect && /^https?:\/\//.test(redirect)) return Response.redirect(redirect, 303);

  return reply(200, { ok: true });
}
