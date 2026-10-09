import type { AnySpec } from './prereg';
import type { SiteComment, UnresolvedComment } from '../types';
import { flattenSpec } from './edits';

/**
 * A simple, rule-based amend used in preview mode and as a fallback when Claude is not
 * connected. It handles comments that say exactly what the new words should be, e.g.
 *   Change this to "Home & gym plans"
 * and colour changes with a hex code. Everything else is passed to the REPS team.
 */
export function amendWithRules(spec: AnySpec, comments: SiteComment[]) {
  const fields = flattenSpec(spec);
  const edits: { path: string; value: string; commentId: string }[] = [];
  const unresolved: UnresolvedComment[] = [];

  for (const c of comments) {
    const quoted = c.text.match(/[“"]([^”"]{2,300})[”"]/);
    const hex = c.text.match(/#[0-9a-f]{6}\b/i);
    const target = c.target?.text?.trim();

    if (hex && /colou?r/i.test(c.text)) {
      edits.push({ path: /second/i.test(c.text) ? 'brand.secondary' : 'brand.primary', value: hex[0], commentId: c.id });
      continue;
    }
    if (quoted && target) {
      const norm = (s: string) => s.replace(/\s+/g, ' ').trim().toLowerCase();
      const t = norm(target);
      // A pin on a two-line headline: the new words replace both lines.
      const squash = (s: string) => s.replace(/\s+/g, '').toLowerCase();
      const headline = Object.keys(fields).find((p) => p.endsWith('.headline.light')
        && squash(`${fields[p]}${fields[p.replace(/light$/, 'bold')] ?? ''}`) === squash(target));
      if (headline) {
        edits.push({ path: headline, value: '', commentId: c.id }, { path: headline.replace(/light$/, 'bold'), value: quoted[1], commentId: c.id });
        continue;
      }
      // Otherwise the field whose words sit under the pin: exact match first, then the closest containing one.
      const path = Object.keys(fields).find((p) => norm(fields[p]) === t)
        ?? Object.keys(fields).filter((p) => t.includes(norm(fields[p])) && fields[p].length > 3).sort((a, b) => fields[b].length - fields[a].length)[0]
        ?? Object.keys(fields).find((p) => norm(fields[p]).includes(t));
      if (path) {
        edits.push({ path, value: quoted[1], commentId: c.id });
        continue;
      }
    }
    const photo = /photo|image|picture|pic\b|logo/i.test(c.text);
    unresolved.push({
      commentId: c.id,
      text: c.text,
      reason: photo
        ? 'Needs a new photo or logo, which has to be added by the REPS team.'
        : 'Needs the REPS team. The comment does not give the exact new wording.',
    });
  }
  return { edits, unresolved, summary: `${edits.length} change${edits.length === 1 ? '' : 's'} made from ${comments.length} comment${comments.length === 1 ? '' : 's'}.` };
}
