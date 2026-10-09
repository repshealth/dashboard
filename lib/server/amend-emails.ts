import { claudeJson } from './claude';
import { amendEmailsWithRules, emailPathLabel, flattenEmails, type EmailAmendFn } from '../emails/amend';

const SYSTEM = `You update a fitness coach's launch emails from their review comments, in British English.
You get every editable piece of text as "path: current text", then a numbered list of comments.
Each comment says which email and which part of it the client left it on, and the words there.
For each comment, make the smallest set of edits that does what it asks, in the coach's own tone of voice.
Only change text a comment asks about. Never invent facts, prices, discounts, numbers or results.
Emails to the general list never mention a discount. A body paragraph or P.S. set to an empty string is removed.
If a comment is unclear, or asks for something you cannot do (new emails, images, send times), list it as unresolved with a short reason.
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
        properties: { path: { type: 'string' }, value: { type: 'string' }, comment: { type: 'integer' } },
        required: ['path', 'value', 'comment'],
      },
    },
    unresolved: {
      type: 'array',
      items: { type: 'object', additionalProperties: false, properties: { comment: { type: 'integer' }, reason: { type: 'string' } }, required: ['comment', 'reason'] },
    },
  },
  required: ['summary', 'edits', 'unresolved'],
} as const;

/** Amends emails from comments with Claude, falling back to the rules. */
export const amendEmailsWithClaude = (voice = ''): EmailAmendFn => async (emails, comments) => {
  const fields = flattenEmails(emails);
  const content = [
    ...(voice ? [voice, ''] : []),
    'EMAIL TEXT',
    ...Object.entries(fields).map(([p, v]) => `${p}: ${v}`),
    '',
    'COMMENTS',
    ...comments.map((c, i) => `${i + 1}. [${emailPathLabel(emails, `${c.emailId}.${c.field}`)}, path ${c.emailId}.${c.field}, on: "${c.quote}"] ${c.text}`),
  ].join('\n');
  try {
    const out = await claudeJson<{ summary: string; edits: { path: string; value: string; comment: number }[]; unresolved: { comment: number; reason: string }[] }>(SYSTEM, content, SCHEMA, 6000);
    if (!out) return { ...amendEmailsWithRules(emails, comments), by: 'rules' };
    const byN = (n: number) => comments[n - 1];
    return {
      summary: out.summary,
      edits: out.edits.filter((e) => e.path in fields && byN(e.comment)).map((e) => ({ path: e.path, value: e.value, commentId: byN(e.comment).id })),
      unresolved: out.unresolved.filter((u) => byN(u.comment)).map((u) => ({ commentId: byN(u.comment).id, text: byN(u.comment).text, reason: u.reason })),
      by: 'claude',
    };
  } catch (e) {
    console.error('amendEmailsWithClaude failed, using rules:', e);
    return { ...amendEmailsWithRules(emails, comments), by: 'rules' };
  }
};
