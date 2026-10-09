import { setting } from './env';
import type { AnySpec } from '../site/prereg';
import type { SiteComment, UnresolvedComment } from '../types';
import { flattenSpec } from '../site/edits';
import { amendWithRules } from '../site/amend-rules';

const SYSTEM = `You update a page of a fitness coach's website (the main site or the app pre-registration page) from their review comments, in British English.
You are given every editable piece of text on the site as "path: current text", and a numbered list of comments.
Each comment says which section and which words the client pinned it to.
For each comment, make the smallest set of text edits that does what it asks, keeping the site's tone.
Only change text a comment asks about. Never invent facts, prices, numbers, reviews or results.
You cannot change photos, logos, layout or add new sections: list those comments as unresolved with a short reason.
If a comment is unclear, list it as unresolved rather than guessing.
Colours are hex codes on brand.primary and brand.secondary. brand.font is one of bold, modern, elegant.
No em dashes. No emoji.`;

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string', description: 'One sentence for the REPS team on what was changed' },
    edits: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Exact path from the list' },
          value: { type: 'string', description: 'The full new text for that path' },
          comment: { type: 'integer', description: 'Number of the comment this edit answers' },
        },
        required: ['path', 'value', 'comment'],
      },
    },
    unresolved: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        properties: {
          comment: { type: 'integer', description: 'Number of the comment' },
          reason: { type: 'string', description: 'Short reason a person needs to handle it' },
        },
        required: ['comment', 'reason'],
      },
    },
  },
  required: ['summary', 'edits', 'unresolved'],
} as const;

/**
 * Works out text edits for a site from the client's open comments, using Claude.
 * Falls back to the simple rule-based amend without an API key or if the call fails.
 */
export async function amendWithClaude(spec: AnySpec, comments: SiteComment[]): Promise<{
  edits: { path: string; value: string; commentId: string }[];
  unresolved: UnresolvedComment[];
  summary: string;
  by: 'claude' | 'rules';
}> {
  const key = setting('ANTHROPIC_API_KEY');
  if (!key || !comments.length) return { ...amendWithRules(spec, comments), by: 'rules' };

  const fields = flattenSpec(spec);
  const content = [
    'SITE TEXT',
    ...Object.entries(fields).map(([p, v]) => `${p}: ${v}`),
    '',
    'COMMENTS',
    ...comments.map((c, i) => `${i + 1}. [${c.target?.section ?? 'Unknown section'}${c.target?.text ? `, pinned on: "${c.target.text}"` : ''}] ${c.text}`),
  ].join('\n');

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: setting('ANTHROPIC_MODEL') || 'claude-sonnet-5-5',
        max_tokens: 4000,
        system: SYSTEM,
        messages: [{ role: 'user', content }],
        output_config: { format: { type: 'json_schema', schema: SCHEMA } },
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `Claude API returned ${res.status}`);
    if (data.stop_reason !== 'end_turn') throw new Error(`Claude stopped early (${data.stop_reason})`);
    const out = JSON.parse(data.content.find((b: { type: string }) => b.type === 'text').text) as {
      summary: string;
      edits: { path: string; value: string; comment: number }[];
      unresolved: { comment: number; reason: string }[];
    };
    const byNumber = (n: number) => comments[n - 1];
    return {
      summary: out.summary,
      edits: out.edits.filter((e) => e.path in fields && byNumber(e.comment)).map((e) => ({ path: e.path, value: e.value, commentId: byNumber(e.comment).id })),
      unresolved: out.unresolved.filter((u) => byNumber(u.comment)).map((u) => ({ commentId: byNumber(u.comment).id, text: byNumber(u.comment).text, reason: u.reason })),
      by: 'claude',
    };
  } catch (e) {
    console.error('amendWithClaude failed, using rules:', e);
    return { ...amendWithRules(spec, comments), by: 'rules' };
  }
}
