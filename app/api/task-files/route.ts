import { context, errorReply } from '@/lib/server/backend';
import { cf } from '@/lib/server/env';

const MAX = 20 * 1024 * 1024;
/** Files the team can attach to a task. Anything that could run in a browser is refused. */
const BLOCKED = /\.(html?|svg|js|mjs|xhtml|xml|exe|bat|cmd|sh|msi|apk|dmg)$/i;
const SHOWN = /^(image\/(jpeg|png|webp|gif)|application\/pdf)$/;

/**
 * POST /api/task-files  (multipart, field "file")  Agency only.
 * Stores a file attached to a task (a brief, photos, a contract...) and replies with its link.
 * Images and PDFs open in the browser; everything else downloads.
 */
export async function POST(req: Request) {
  try {
    const { who } = context(req);
    const v = await who();
    if (!v?.isAdmin) return Response.json({ error: 'Only the REPS team can attach files to tasks.' }, { status: 403 });
    const bucket = cf().UPLOADS;
    if (!bucket) return Response.json({ error: 'File storage isn’t connected yet.' }, { status: 503 });
    const form = await req.formData().catch(() => null);
    const file = form?.get('file');
    if (!file || typeof file === 'string') return Response.json({ error: 'No file.' }, { status: 400 });
    if (file.size > MAX) return Response.json({ error: `${file.name} is over 20 MB. Please share a link to it in the description instead.` }, { status: 400 });
    if (BLOCKED.test(file.name)) return Response.json({ error: `${file.name} can’t be attached. Try a PDF, image, document or zip.` }, { status: 400 });
    const safe = file.name.replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '-').slice(-80) || 'file';
    const key = `tasks/${crypto.randomUUID()}-${safe}`;
    const type = file.type || 'application/octet-stream';
    await bucket.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: SHOWN.test(type) ? type : 'application/octet-stream', ...(SHOWN.test(type) ? {} : { contentDisposition: `attachment; filename="${safe}"` }) },
    });
    return Response.json({ url: `/api/files/${key}`, name: file.name.slice(0, 160), size: file.size, type });
  } catch (e) {
    return errorReply(e);
  }
}
