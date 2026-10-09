import type { Site, SiteChange, SiteComment, SitePage, SiteVersion, UnresolvedComment } from '../types';
import type { AnySpec } from './prereg';
import { applyEdits } from './edits';
import { nextVersionName } from './versions';

export type AmendFn = (spec: AnySpec, comments: SiteComment[]) => Promise<{
  edits: { path: string; value: string; commentId: string }[];
  unresolved: UnresolvedComment[];
  summary: string;
  by: 'claude' | 'rules';
}>;

/** Whether a version's pages can be amended automatically (generated pages, not screenshots). */
export const canAutoAmend = (v: SiteVersion) => v.pages.some((p) => p.kind === 'template' && p.spec);

/**
 * Builds a revised version from a version and its open comments. The new version is
 * "pending": only the REPS team sees it until they approve it.
 */
export async function makeAmendedVersion(site: Site, base: SiteVersion, amend: AmendFn, newId: () => string): Promise<SiteVersion | null> {
  const open = base.comments.filter((c) => !c.resolved);
  if (!open.length || !canAutoAmend(base)) return null;

  const changes: SiteChange[] = [];
  const unresolved: UnresolvedComment[] = [];
  const summaries: string[] = [];
  let by: 'claude' | 'rules' = 'rules';

  const pages: SitePage[] = [];
  for (const page of base.pages) {
    const pageComments = open.filter((c) => c.pageId === page.id);
    let spec = page.spec;
    if (page.kind === 'template' && page.spec && pageComments.length) {
      const r = await amend(page.spec, pageComments);
      by = r.by;
      const applied = applyEdits(page.spec, r.edits);
      spec = applied.spec;
      changes.push(...applied.changes.map((c) => ({ ...c, label: base.pages.length > 1 ? `${page.name} · ${c.label}` : c.label })));
      unresolved.push(...r.unresolved);
      if (r.summary) summaries.push(r.summary);
      // A comment Claude said it handled but whose edit did not apply goes back to the team.
      for (const c of pageComments) {
        if (!changes.some((x) => x.commentId === c.id) && !unresolved.some((u) => u.commentId === c.id)) {
          unresolved.push({ commentId: c.id, text: c.text, reason: 'No change could be made automatically.' });
        }
      }
    } else if (pageComments.length) {
      unresolved.push(...pageComments.map((c) => ({ commentId: c.id, text: c.text, reason: 'This page has to be changed by the REPS team.' })));
    }
    pages.push({ ...page, id: newId(), spec });
  }

  const version = nextVersionName(site);
  return {
    id: newId(),
    version,
    label: `${version} · Updated from comments`,
    sentNote: `Updated from ${open.length} comment${open.length === 1 ? '' : 's'}`,
    pages,
    comments: [],
    state: 'pending',
    basedOn: base.id,
    createdAt: new Date().toISOString(),
    amendedBy: by,
    summary: summaries.join(' ') || `${changes.length} change${changes.length === 1 ? '' : 's'} made.`,
    changes,
    unresolved,
  };
}
