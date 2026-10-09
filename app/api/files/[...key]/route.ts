import { cf } from '@/lib/server/env';

/**
 * GET /api/files/<key>  Serves an uploaded image from R2.
 * File names are random, but anyone with a link can view that image,
 * so don't upload anything confidential.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const bucket = cf().UPLOADS;
  if (!bucket) return new Response('Not found', { status: 404 });
  const { key } = await params;
  const obj = await bucket.get(key.join('/'));
  if (!obj) return new Response('Not found', { status: 404 });
  return new Response(obj.body, {
    headers: {
      'Content-Type': obj.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      // SVGs can hold scripts: never run them when opened directly.
      'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    },
  });
}
