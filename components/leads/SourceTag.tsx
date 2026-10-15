import { SOURCES } from '@/lib/constants';
import type { Lead } from '@/lib/types';

/**
 * The name a lead's origin goes by on screen.
 *
 * A lead carries the form it came through, e.g. "Homepage form", which is what
 * the client recognises. The generic source name is only the fallback, for
 * leads captured before the form name was recorded.
 */
export const sourceLabel = (lead: Pick<Lead, 'source' | 'form'>) =>
  (lead.form || '').trim() || (SOURCES[lead.source] ?? SOURCES.magnet).label;

/**
 * Every form a lead has come through, newest first: the answers kept per form, the form they
 * first arrived on, and older "Submitted …" timeline entries from before answers were kept per form.
 */
export function leadForms(lead: Pick<Lead, 'source' | 'form' | 'submissions' | 'events'>) {
  const names = [
    ...(lead.submissions ?? []).map((s) => s.form),
    ...(lead.events ?? []).filter((e) => e.source === 'Website' && /^Submitted /.test(e.label) && !/^Submitted (a form on|a website form)/.test(e.label)).map((e) => e.label.slice(10)),
    lead.form ?? '',
  ].map((n) => n.trim()).filter(Boolean);
  const out = [...new Set(names)];
  return out.length ? out : [sourceLabel(lead)];
}

export default function SourceTag({ lead }: { lead: Pick<Lead, 'source' | 'form'> }) {
  const s = SOURCES[lead.source] ?? SOURCES.magnet;
  const label = sourceLabel(lead);
  return (
    <span
      className="tag"
      style={{ color: s.text, background: `rgba(${s.rgb},.06)`, borderColor: `rgba(${s.rgb},.22)` }}
      title={label === s.label ? undefined : s.label}
    >
      {label}
    </span>
  );
}
