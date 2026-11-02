import type { Site, SiteVersion } from '../types';

/** Versions the client can see, newest first. */
export const publishedVersions = (s: Site | null | undefined): SiteVersion[] =>
  (s?.versions ?? []).filter((v) => !v.state || v.state === 'published');

/** The newest version the client can see. */
export const latestPublished = (s: Site | null | undefined) => publishedVersions(s)[0];

/** An amended version waiting for REPS approval, if there is one. */
export const pendingVersion = (s: Site | null | undefined) => (s?.versions ?? []).find((v) => v.state === 'pending');

/** "v3" after "v2". */
export const nextVersionName = (s: Site) => {
  const n = Math.max(0, ...s.versions.map((v) => parseInt(v.version.replace(/\D/g, ''), 10) || 0));
  return `v${n + 1}`;
};

/**
 * Copies a version's open comments onto a newer version, so a client's requests aren't lost
 * when an update arrives from GitHub. Each comment moves to the same page in the new version.
 */
export function carryOpenComments(from: SiteVersion | undefined, to: SiteVersion) {
  if (!from || from.id === to.id) return 0;
  const pageKey = (p: { key?: string; name: string }) => p.key ?? p.name;
  const newPage = new Map(to.pages.map((p) => [pageKey(p), p.id]));
  const oldKey = new Map(from.pages.map((p) => [p.id, pageKey(p)]));
  let n = 0;
  for (const c of from.comments) {
    if (c.resolved || to.comments.some((x) => x.id === c.id)) continue;
    to.comments.push({ ...c, pageId: newPage.get(oldKey.get(c.pageId) ?? '') ?? to.pages[0]?.id ?? c.pageId });
    n++;
  }
  return n;
}

/** Open comments on the version the client sees: what the REPS team still needs to look at. */
export const openComments = (s: Site | null | undefined) => (latestPublished(s)?.comments ?? []).filter((c) => !c.resolved);

/** Whether a site has client comments the REPS team hasn't dealt with yet. */
export const needsComments = (s: Site) => {
  const open = openComments(s);
  return open.length > 0 && (s.status === 'changes' || open.some((c) => c.role === 'client'));
};
