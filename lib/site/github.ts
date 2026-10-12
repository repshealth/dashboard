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

/** "index.html" -> "Homepage"; otherwise the page's <title>, or a name made from the file. */
export function pageName(path: string, html: string) {
  if (/^index\.html?$/i.test(path)) return 'Homepage';
  const t = html.match(/<title[^>]*>([^<]{1,80})<\/title>/i)?.[1]?.trim();
  if (t) return t.split(/\s[|·-]\s/)[0].trim();
  const base = path.split('/').pop()!.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ');
  return base.charAt(0).toUpperCase() + base.slice(1);
}
