import type { SiteChange, UnresolvedComment } from '../types';
import { EMAIL_LISTS, fieldLabel, fieldText, nextEmailVersionName, type EmailCampaign, type EmailComment, type EmailVersion, type LaunchEmail } from './types';

export type EmailEdit = { path: string; value: string; commentId?: string };
export type EmailAmendFn = (emails: LaunchEmail[], comments: EmailComment[]) => Promise<{
  edits: EmailEdit[];
  unresolved: UnresolvedComment[];
  summary: string;
  by: 'claude' | 'rules';
}>;

const FIELDS = ['subject', 'preview', 'heading', 'button', 'ps'] as const;

/** Every editable piece of text, keyed "prereg-3.subject", "public-2.body.1" and so on. */
export function flattenEmails(emails: LaunchEmail[]) {
  const out: Record<string, string> = {};
  for (const e of emails) {
    for (const f of FIELDS) if (!(f === 'button' && e.stage === 'warmup')) out[`${e.id}.${f}`] = e[f];
    e.body.forEach((p, i) => (out[`${e.id}.body.${i}`] = p));
  }
  return out;
}

export const emailLabel = (e: Pick<LaunchEmail, 'list' | 'n'>) => `${EMAIL_LISTS[e.list].short} · Email ${e.n}`;

/** "prereg-3.body.1" -> "Pre-reg list · Email 3 paragraph 2". */
export function emailPathLabel(emails: LaunchEmail[], path: string) {
  const [id, ...rest] = path.split('.');
  const e = emails.find((x) => x.id === id);
  return `${e ? emailLabel(e) : id} ${fieldLabel(rest.join('.'))}`;
}

/** Applies edits to a copy of the emails. An empty paragraph or P.S. removes it. */
export function applyEmailEdits(emails: LaunchEmail[], edits: EmailEdit[]) {
  const next = JSON.parse(JSON.stringify(emails)) as LaunchEmail[];
  const editable = flattenEmails(emails);
  const changes: SiteChange[] = [];
  const removeParas = new Map<string, Set<number>>();
  for (const ed of edits) {
    if (!(ed.path in editable)) continue;
    const value = String(ed.value ?? '').replace(/—/g, ', ').trim();
    const before = editable[ed.path];
    if (value === before) continue;
    const [id, field, idx] = ed.path.split('.');
    const e = next.find((x) => x.id === id)!;
    if (field === 'body') {
      if (!value) {
        if (!removeParas.has(id)) removeParas.set(id, new Set());
        removeParas.get(id)!.add(Number(idx));
      } else e.body[Number(idx)] = value;
    } else {
      if (!value && field !== 'ps') continue; // subjects, headings and buttons can't be blank
      (e as unknown as Record<string, string>)[field] = value;
    }
    changes.push({ path: ed.path, label: emailPathLabel(emails, ed.path), before, after: value || '(removed)', commentId: ed.commentId });
  }
  for (const [id, set] of removeParas) {
    const e = next.find((x) => x.id === id)!;
    e.body = e.body.filter((_, i) => !set.has(i));
  }
  return { emails: next, changes };
}

/**
 * Rule-based amend, for preview mode and as a fallback. Every email comment is left on one
 * exact part of an email, so a comment with the new words in quotes, or asking for a line
 * to be removed, can be applied directly. Everything else goes to the REPS team.
 */
export function amendEmailsWithRules(emails: LaunchEmail[], comments: EmailComment[]) {
  const edits: EmailEdit[] = [];
  const unresolved: UnresolvedComment[] = [];
  const fields = flattenEmails(emails);
  for (const c of comments) {
    const path = `${c.emailId}.${c.field}`;
    const quoted = c.text.match(/[“"]([^”"]{1,400})[”"]/);
    if (path in fields && quoted) { edits.push({ path, value: quoted[1], commentId: c.id }); continue; }
    if (path in fields && /^\s*(please\s+)?(remove|delete|cut|drop)\b/i.test(c.text) && (c.field.startsWith('body.') || c.field === 'ps')) {
      edits.push({ path, value: '', commentId: c.id });
      continue;
    }
    unresolved.push({ commentId: c.id, text: c.text, reason: 'Needs the REPS team. The comment does not give the exact new wording.' });
  }
  return { edits, unresolved, summary: `${edits.length} change${edits.length === 1 ? '' : 's'} made from ${comments.length} comment${comments.length === 1 ? '' : 's'}.` };
}

export const rulesEmailAmend: EmailAmendFn = async (emails, comments) => ({ ...amendEmailsWithRules(emails, comments), by: 'rules' });

/** A revised version made from a version's open comments, waiting for the REPS team. */
export async function makeAmendedEmails(c: EmailCampaign, base: EmailVersion, amend: EmailAmendFn, newId: () => string): Promise<EmailVersion | null> {
  const open = base.comments.filter((x) => !x.resolved);
  if (!open.length) return null;
  const r = await amend(base.emails, open);
  const applied = applyEmailEdits(base.emails, r.edits);
  const unresolved = [...r.unresolved];
  for (const x of open) {
    if (!applied.changes.some((ch) => ch.commentId === x.id) && !unresolved.some((u) => u.commentId === x.id)) {
      unresolved.push({ commentId: x.id, text: x.text, reason: 'No change could be made automatically.' });
    }
  }
  const version = nextEmailVersionName(c);
  return {
    id: newId(), version, label: `${version} · Updated from comments`,
    sentNote: `Updated from ${open.length} comment${open.length === 1 ? '' : 's'}`,
    emails: applied.emails, comments: [], state: 'pending', basedOn: base.id, createdAt: new Date().toISOString(),
    amendedBy: r.by, summary: r.summary || `${applied.changes.length} changes made.`, changes: applied.changes, unresolved,
  };
}

/** A version holding edits the REPS team typed in themselves. */
export function makeEditedEmails(c: EmailCampaign, base: EmailVersion, emails: LaunchEmail[], newId: () => string): EmailVersion | null {
  const before = flattenEmails(base.emails);
  const after = flattenEmails(emails);
  const changes: SiteChange[] = [];
  for (const [p, v] of Object.entries(after)) if (before[p] !== v) changes.push({ path: p, label: emailPathLabel(emails, p), before: before[p] ?? '', after: v });
  for (const p of Object.keys(before)) if (!(p in after)) changes.push({ path: p, label: emailPathLabel(base.emails, p), before: before[p], after: '(removed)' });
  if (!changes.length) return null;
  const version = nextEmailVersionName(c);
  return {
    id: newId(), version, label: `${version} · Edited by REPS`, sentNote: 'Edited by the REPS team',
    emails, comments: [], state: 'pending', basedOn: base.id, createdAt: new Date().toISOString(),
    amendedBy: 'reps', summary: `${changes.length} edit${changes.length === 1 ? '' : 's'} made by the REPS team.`, changes, unresolved: [],
  };
}

/**
 * Saves emails the REPS team edited by hand. Before the client has seen them (draft) the
 * edit is made in place. Otherwise it goes into the pending version, which the team then
 * approves and sends, so the client never sees a half-finished change.
 * Returns the version that changed, or null if nothing did.
 */
export function applyRepsEdits(c: EmailCampaign, emails: LaunchEmail[], newId: () => string): EmailVersion | null {
  const pending = c.versions.find((v) => v.state === 'pending');
  const latest = c.versions.find((v) => v.state === 'published');
  if (!latest) return null;
  if (c.status === 'draft' && !pending) {
    latest.emails = emails;
    return latest;
  }
  if (pending) {
    const base = c.versions.find((v) => v.id === pending.basedOn) ?? latest;
    const diff = makeEditedEmails(c, base, emails, newId);
    const old = new Map((pending.changes ?? []).map((x) => [x.path, x.commentId]));
    pending.emails = emails;
    pending.changes = (diff?.changes ?? []).map((x) => ({ ...x, commentId: old.get(x.path) }));
    if (pending.amendedBy !== 'reps' && !/Edited by REPS/.test(pending.summary ?? '')) pending.summary = `${pending.summary ?? ''} Edited by REPS.`.trim();
    return pending;
  }
  const v = makeEditedEmails(c, latest, emails, newId);
  if (v) c.versions.unshift(v);
  return v;
}

export { fieldText };
