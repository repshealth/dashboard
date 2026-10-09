import { cf } from '@/lib/server/env';

const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/svg+xml': 'svg' };
const MAX = 8 * 1024 * 1024;

/**
 * POST /api/upload  (multipart, field "file")
 * Logos and photos from the onboarding form go into the R2 bucket. Images are already
 * shrunk in the browser before upload. Replies { url } for the answers.
 */
export async function POST(req: Request) {
  const bucket = cf().UPLOADS;
  if (!bucket) return Response.json({ error: 'Uploads aren’t connected yet.' }, { status: 503 });
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!file || typeof file === 'string') return Response.json({ error: 'No file.' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return Response.json({ error: 'Please upload a JPG, PNG, WebP, GIF or SVG image.' }, { status: 400 });
  if (file.size > MAX) return Response.json({ error: 'That image is too big (8 MB max).' }, { status: 400 });
  const key = `onboarding/${crypto.randomUUID()}.${ext}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return Response.json({ url: `/api/files/${key}` });
}
