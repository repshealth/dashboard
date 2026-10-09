'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { Tick, fmtDay, overdue } from './parts';
import { fmtCall } from '../meetings/parts';
import { backend } from '@/lib/backend';
import type { Task } from '@/lib/tasks/types';

/** The client's to-dos from their calls with REPS. */
export default function TasksView() {
  const { client, viewer, toast, refreshTasks } = useData();
  const [list, setList] = useState<Task[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    const all = await backend.listTasks(client.id);
    // REPS sees the client's whole list here, exactly as the client does.
    setList(all.filter((t) => t.assignee === 'client' && (t.status === 'open' || t.status === 'done')));
  }, [client]);
  useEffect(() => { setList(null); load().catch(() => setList([])); }, [load]);

  if (!client) return <div className="loading">No clients on this account yet.</div>;

  const open = (list ?? []).filter((t) => t.status === 'open').sort((a, b) => (a.due ?? '9999').localeCompare(b.due ?? '9999'));
  const done = (list ?? []).filter((t) => t.status === 'done').sort((a, b) => ((a.doneAt ?? '') < (b.doneAt ?? '') ? 1 : -1));

  const toggle = async (t: Task) => {
    setBusy(t.id);
    try {
      await backend.updateTask(t.id, { status: t.status === 'done' ? 'open' : 'done' });
      await load();
      if (viewer?.isAdmin) refreshTasks().catch(() => {});
      if (t.status !== 'done') toast(viewer?.isAdmin ? 'Marked done.' : 'Nice one, the REPS team can see that’s done.');
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(null); }
  };

  const row = (t: Task) => (
    <div key={t.id} className={`tk-row${t.status === 'done' ? ' done' : ''}`}>
      <Tick done={t.status === 'done'} disabled={busy === t.id} label={`Mark "${t.title}" ${t.status === 'done' ? 'not done' : 'done'}`} onToggle={() => toggle(t)} />
      <div className="tk-main">
        <div className="tk-title">{t.title}</div>
        {t.detail && <div className="tk-detail">{t.detail}</div>}
        <div className="tk-meta">
          {t.meetingTitle && <span>From our call: {t.meetingTitle}{t.meetingAt ? `, ${fmtCall(t.meetingAt).replace(/, \d.*$/, '')}` : ''}</span>}
          {t.status === 'done' && t.doneAt && <span>Done {fmtDay(t.doneAt)}</span>}
        </div>
      </div>
      {t.status === 'open' && t.due && <span className={`tk-duechip${overdue(t) ? ' late' : ''}`}>{overdue(t) ? 'Overdue · ' : 'Due '}{fmtDay(t.due)}</span>}
    </div>
  );

  return (
    <div className="view">
      <header>
        <div>
          <h1>Tasks</h1>
          <p className="sub">Your to-dos from our calls. Tick them off as you go and the REPS team will see.</p>
        </div>
      </header>
      {list === null ? <div className="loading">Loading tasks…</div> : !list.length ? (
        <div className="sv-empty">
          <span className="stbadge st-approved">All clear</span>
          <div className="sv-et">Nothing on your list</div>
          <p>Anything we agree you&apos;ll do on a call will appear here.</p>
        </div>
      ) : (
        <>
          <section className="list tk-list" aria-label="To do">
            <div className="tk-lh">TO DO ({open.length})</div>
            {open.length ? open.map(row) : <p className="cm-none tk-none">All done. Nice work.</p>}
          </section>
          {done.length > 0 && (
            <section className="list tk-list" aria-label="Done">
              <div className="tk-lh">DONE ({done.length})</div>
              {done.map(row)}
            </section>
          )}
        </>
      )}
    </div>
  );
}
