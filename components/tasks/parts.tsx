'use client';

import { ASSIGNEES, ASSIGNEE_NAME, type Assignee, type Task } from '@/lib/tasks/types';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-12" -> "12 Oct". */
export const fmtDay = (iso?: string) => {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MON[+m[2] - 1]}` : '';
};
export const overdue = (t: Task) => Boolean(t.due && t.status === 'open' && t.due < new Date().toISOString().slice(0, 10));

/** One coloured chip per person, so it's easy to scan who owns what. */
export function Who({ a }: { a: Assignee | null }) {
  if (!a) return <span className="tk-who none">Unassigned</span>;
  return <span className={`tk-who w-${a}`}>{ASSIGNEE_NAME[a]}</span>;
}

/** The five assign buttons. The likely person from the notes is outlined. */
export function AssignButtons({ value, hint, onPick, disabled }: { value: Assignee | null; hint?: Assignee | null; onPick: (a: Assignee) => void; disabled?: boolean }) {
  return (
    <div className="tk-assign" role="group" aria-label="Assign to">
      {ASSIGNEES.map((a) => (
        <button key={a.id} type="button" disabled={disabled}
          className={`tk-btn w-${a.id}${value === a.id ? ' on' : ''}${!value && hint === a.id ? ' hint' : ''}`}
          title={!value && hint === a.id ? 'Suggested from the call' : `Assign to ${a.label}`}
          onClick={() => onPick(a.id)}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** A tick box for done / not done. */
export function Tick({ done, onToggle, label, disabled }: { done: boolean; onToggle: () => void; label: string; disabled?: boolean }) {
  return (
    <button type="button" className={`tk-tick${done ? ' on' : ''}`} role="checkbox" aria-checked={done} aria-label={label} disabled={disabled} onClick={onToggle}>
      {done && <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.4l3 3 6-6.3" stroke="currentColor" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}
