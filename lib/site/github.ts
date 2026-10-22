/**
 * Reads a client's website from their GitHub repo. The repo holds the site as plain,
 * self-contained HTML files (index.html is the homepage). Each push becomes a new
 * version in the client's Website section.
 */
export interface FetchedSite {
  sha: string;
  message: string;
  url: string; // link to the commit on GitHub
  files: { path: string; html: string }[];
}

const MAX_PAGES = 12;

export async function fetchSiteFromGitHub(repo: string, branch: string, token?: string): Promise<FetchedSite> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new Error('The repo should look like owner/name, e.g. repshealth/physique-x-site.');
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json', 'User-Agent': 'reps-scaling-os' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const api = async (path: string) => {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, { headers });
    if (res.status === 404) throw new Error(`Couldn't find ${repo} on GitHub. If the repo is private, add a GitHub token (see README).`);
    if ((res.status === 403 || res.status === 429) && !token) {
      throw new Error('GitHub is limiting checks from the dashboard. Add a GITHUB_TOKEN in Cloudflare (Settings, Variables and Secrets) and try again.');
    }
    if (res.status === 403 || res.status === 429) throw new Error('GitHub is limiting checks right now, or the GITHUB_TOKEN can’t read this repo. Try again in a few minutes.');
    if (res.status === 401) throw new Error('The GITHUB_TOKEN in Cloudflare isn’t valid any more. Make a new one and replace it.');
    if (!res.ok) throw new Error(`GitHub returned ${res.status}.`);
    return res.json();
  };
  const commit = await api(`/commits/${encodeURIComponent(branch || 'main')}`);
  const sha: string = commit.sha;
  const tree = await api(`/git/trees/${sha}?recursive=1`);
  const paths = (tree.tree as { path: string; type: string }[])
    .filter((x) => x.type === 'blob' && /\.html?$/i.test(x.path) && !/(^|\/)(node_modules|\.|_)/.test(x.path))
    .map((x) => x.path)
    .sort((a, b) => (a === 'index.html' ? -1 : b === 'index.html' ? 1 : a.localeCompare(b)))
    .slice(0, MAX_PAGES);
  if (!paths.length) throw new Error(`No .html files found in ${repo}.`);
  const files = await Promise.all(paths.map(async (path) => {
    const res = await fetch(`https://raw.githubusercontent.com/${repo}/${sha}/${path.split('/').map(encodeURIComponent).join('/')}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new Error(`Couldn't read ${path} from GitHub (${res.status}).`);
    return { path, html: await res.text() };
  }));
  return { sha, message: String(commit.commit?.message || '').split('\n')[0], url: commit.html_url, files };
}

/** The repo's GitHub Pages address, e.g. repshealth/joshbell -> https://repshealth.github.io/joshbell/ */
export function githubPagesUrl(repo: string) {
  const [owner, name] = repo.split('/');
  if (!owner || !name) return '';
  const host = `${owner.toLowerCase()}.github.io`;
  return name.toLowerCase() === host ? `https://${host}/` : `https://${host}/${name}/`;
}

/**
 * Where a page of a GitHub site can be seen online: the live address set for the site, or its
 * GitHub Pages address, plus the page's file ("index.html" is the address itself).
 */
export function livePageUrl(src: { repo: string; liveUrl?: string }, pageKey: string) {
  const set = src.liveUrl?.trim();
  let base = set ? (/^https?:\/\//i.test(set) ? set : `https://${set}`) : githubPagesUrl(src.repo);
  if (!base) return '';
  if (!base.endsWith('/')) base += '/';
  const path = pageKey.replace(/^\/+/, '').replace(/(^|\/)index\.html?$/i, '$1');
  return base + path.split('/').map(encodeURIComponent).join('/');
}

/** "index.html" -> "Homepage"; otherwise the page's <title>, or a name made from the file. */
export function pageName(path: string, html: string) {
  if (/^index\.html?$/i.test(path)) return 'Homepage';
  const t = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  if (t) return t.split(/\s[|·-]\s/)[0].trim();
  const base = path.split('/').pop()!.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}

/**
 * Points a page's relative images, styles and scripts (e.g. "images/hero.webp") at that exact
 * commit on jsDelivr, so the page shows properly in the dashboard preview. Links to other pages
 * are left alone. Only works for public repos; private ones keep their paths as they are.
 */
export function absoluteAssets(html: string, repo: string, sha: string, path: string) {
  const dir = path.includes('/') ? path.slice(0, path.lastIndexOf('/') + 1) : '';
  const base = `https://cdn.jsdelivr.net/gh/${repo}@${sha}/`;
  const rel = (u: string) => !/^([a-z][a-z0-9+.-]*:|\/\/|#|\/|\{|\$)/i.test(u) && !/\.html?([?#]|$)/i.test(u) && u.trim() !== '';
  const abs = (u: string) => {
    const parts = (dir + u.replace(/^\.\//, '')).split('/');
    const out: string[] = [];
    for (const p of parts) { if (p === '..') out.pop(); else if (p !== '.') out.push(p); }
    return base + out.join('/');
  };
  return html
    .replace(/(\s(?:src|poster|data-src)=)(["'])([^"']+)\2/gi, (m, a, q, u) => (rel(u) ? `${a}${q}${abs(u)}${q}` : m))
    .replace(/(\shref=)(["'])([^"']+\.(?:css|ico|png|jpe?g|webp|svg|gif|woff2?|pdf|mp4|webm))(["'])/gi, (m, a, q, u, q2) => (rel(u) ? `${a}${q}${abs(u)}${q2}` : m))
    .replace(/(\ssrcset=)(["'])([^"']+)\2/gi, (m, a, q, list: string) => `${a}${q}${list.split(',').map((part) => {
      const [u, ...rest] = part.trim().split(/\s+/);
      return [rel(u) ? abs(u) : u, ...rest].join(' ');
    }).join(', ')}${q}`)
    .replace(/url\((["']?)([^"')]+)\1\)/gi, (m, q, u) => (rel(u) ? `url(${q}${abs(u)}${q})` : m))
    // Image and video paths written as plain strings, e.g. a script's list of screenshots.
    .replace(/(['"`])((?:\.{1,2}\/)?[\w-]+(?:\/[\w.-]+)*\.(?:webp|png|jpe?g|gif|svg|avif|mp4|webm))\1/gi, (m, q, u) => `${q}${abs(u)}${q}`);
}
