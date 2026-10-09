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
