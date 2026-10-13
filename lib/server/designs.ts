import { cf, setting } from './env';

/**
 * Generated website pages, saved for the REPS team to review in the "CRM - Website Designs"
 * Claude Project. Each file is stored in R2 (for the Download button) and, when DESIGNS_REPO
 * and GITHUB_TOKEN are set, committed to that repo, which the Project syncs from.
 */

const b64 = (text: string) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

async function commitToRepo(repo: string, token: string, path: string, html: string, message: string) {
  const headers = { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'User-Agent': 'reps-scaling-os', 'Content-Type': 'application/json' };
  const branch = setting('DESIGNS_BRANCH') || 'main';
  const url = `https://api.github.com/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
  // Updating a file needs the current version's sha.
  const now = await fetch(`${url}?ref=${encodeURIComponent(branch)}`, { headers });
  const sha = now.ok ? ((await now.json()) as { sha?: string }).sha : undefined;
  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify({ message, content: b64(html), branch, ...(sha ? { sha } : {}) }) });
  if (!res.ok) throw new Error(`GitHub returned ${res.status} saving ${path}.`);
  const out = (await res.json()) as { content?: { html_url?: string } };
  return out.content?.html_url ?? `https://github.com/${repo}/blob/${branch}/${encodeURIComponent(path)}`;
}

export async function saveDesign(clientId: string, file: string, html: string) {
  const bucket = cf().UPLOADS;
  if (!bucket) throw new Error('File storage (R2) isn’t connected.');
  // A plain key for storage; the download keeps the real file name.
  const key = `designs/${clientId}/${Date.now().toString(36)}-${file.toLowerCase().replace(/\.html$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}.html`;
  await bucket.put(key, new TextEncoder().encode(html).buffer as ArrayBuffer, { httpMetadata: { contentType: 'text/html; charset=utf-8', contentDisposition: `attachment; filename="${file.replace(/"/g, '')}"` } });
  const url = `/api/files/${key}`;

  const repo = setting('DESIGNS_REPO');
  const token = setting('GITHUB_TOKEN');
  if (!repo || !token) return { url, note: 'Download it and add it to the Claude Project (set DESIGNS_REPO to have it committed automatically).' };
  try {
    const repoUrl = await commitToRepo(repo, token, file, html, `Website design: ${file.replace(/\.html$/, '')}`);
    return { url, repoUrl, note: `Committed to ${repo}.` };
  } catch (e) {
    return { url, note: `Couldn't commit it to ${repo} (${e instanceof Error ? e.message : e}). Download it instead.` };
  }
}

/** The repo a client's finished site goes in: <owner>/<slug>-site. */
export const siteRepoFor = (slug: string) => `${setting('SITES_GITHUB_OWNER') || 'repshealth'}/${slug}-site`;
