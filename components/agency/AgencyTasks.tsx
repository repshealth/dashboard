'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { AssignButtons, Tick, Who, fmtDay, overdue } from '../tasks/parts';
import { fmtCall } from '../meetings/parts';
import { backend } from '@/lib/backend';
import { ASSIGNEES, ASSIGNEE_NAME, type Assignee, type Task, type TaskPatch } from '@/lib/tasks/types';

type Tab = 'review' | 'open' | 'done';

/** Tasks pulled from client calls: review and assign them, then track them to done. */
export default function AgencyTasks() {
  const router = useRouter();
  const { viewer, clients, allTasks, refreshTasks, toast } = useData();
  const [tab, setTab] = useState<Tab>('review');
  const [client, setClient] = useState('all');
  const [who, setWho] = useState<Assignee | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ clientId: string; title: string; detail: string; assignee: Assignee | null; due: string }>({ clientId: '', title: '', detail: '', assignee: null, due: '' });

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  useEffect(() => { refreshTasks().catch(() => {}); }, [refreshTasks]);

  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Client';
  const all = useMemo(() => (allTasks ?? []).filter((t) => client === 'all' || t.clientId === client), [allTasks, client]);
  const review = all.filter((t) => t.status === 'suggested');
  const open = all.filter((t) => t.status === 'open');
  const done = all.filter((t) => t.status === 'done');
  const byWho = (list: Task[]) => (who === 'all' ? list : list.filter((t) => t.assignee === who));

  if (!viewer?.isAdmin) return null;

  const update = async (t: Task, patch: TaskPatch, msg?: string) => {
    setBusy(t.id);
    try { await backend.updateTask(t.id, patch); await refreshTasks(); if (msg) toast(msg); }
    catch (e) { toast(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { setBusy(null); }
  };
  const assign = (t: Task, a: Assignee) => update(t, { assignee: a },
    a === 'client' ? `Added to ${name(t.clientId)}'s task list.` : `Assigned to ${ASSIGNEE_NAME[a]}.`);

  // To review, grouped by the call each task came from.
  const groups = new Map<string, Task[]>();
  for (const t of review.slice().sort((a, b) => ((a.meetingAt ?? a.createdAt) < (b.meetingAt ?? b.createdAt) ? 1 : -1))) {
    const k = t.meetingId ?? `manual-${t.clientId}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  }
  const sortOpen = (a: Task, b: Task) => (a.due ?? '9999') .localeCompare(b.due ?? '9999') || (a.createdAt < b.createdAt ? 1 : -1);
  const shown = tab === 'open' ? byWho(open).sort(sortOpen) : byWho(done).sort((a, b) => ((a.doneAt ?? '') < (b.doneAt ?? '') ? 1 : -1));

  return (
    <div className="view">
      <header>
        <div>
          <h1>Tasks</h1>
          <p className="sub">Actions from every client call. Review each one, assign it, and anything for the client goes onto their own task list.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn gold" onClick={() => { setForm({ clientId: client !== 'all' ? client : clients[0]?.id ?? '', title: '', detail: '', assignee: null, due: '' }); setAdding(true); }}>+ Add task</button>
        </div>
      </header>

      <div className="tk-bar">
        <div className="seg" role="tablist" aria-label="Tasks">
          <button type="button" role="tab" aria-selected={tab === 'review'} className={tab === 'review' ? 'on' : ''} onClick={() => setTab('review')}>To review{review.length ? <span className="tk-n">{review.length}</span> : null}</button>
          <button type="button" role="tab" aria-selected={tab === 'open'} className={tab === 'open' ? 'on' : ''} onClick={() => setTab('open')}>Open<span className="tk-n soft">{open.length}</span></button>
          <button type="button" role="tab" aria-selected={tab === 'done'} className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Done</button>
        </div>
        <label className="vsel">
          <span className="sr">Client</span>
          <select value={client} onChange={(e) => setClient(e.target.value)}>
            <option value="all">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
      </div>

      {allTasks === null ? <div className="loading">Loading tasks…</div> : tab === 'review' ? (
        !groups.size ? (
          <div className="sv-empty">
            <span className="stbadge st-approved">All caught up</span>
            <div className="sv-et">Nothing to review</div>
            <p>After each client call, the actions from the meeting notes appear here for you to assign.</p>
          </div>
        ) : (
          <div className="tk-groups">
            {[...groups.entries()].map(([k, list]) => {
              const first = list[0];
              return (
                <section key={k} className="tk-group" aria-label={first.meetingTitle ?? 'Added by hand'}>
                  <div className="tk-gh">
                    <div>
                      <div className="ap-eyebrow">{name(first.clientId)}</div>
                      <h2>{first.meetingTitle ?? 'Added by hand'}</h2>
                      {first.meetingAt && <p className="sub">{fmtCall(first.meetingAt)} · {list.length} task{list.length === 1 ? '' : 's'} found</p>}
                    </div>
                    <button type="button" className="ob-link" onClick={async () => {
                      for (const t of list) await backend.updateTask(t.id, { status: 'dismissed' });
                      await refreshTasks(); toast('Dismissed.');
                    }}>Dismiss all</button>
                  </div>
                  {list.map((t) => (
                    <div key={t.id} className="tk-review">
                      <div className="tk-text">
                        <input className="tk-title-in" aria-label="Task" defaultValue={t.title}
                          onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== t.title) update(t, { title: v }); }}
                          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />
                        {t.detail && <p className="tk-detail">{t.detail}</p>}
                        {t.quote && <p className="tk-quote">&ldquo;{t.quote}&rdquo;</p>}
                      </div>
                      <div className="tk-act">
                        <AssignButtons value={t.assignee} hint={t.suggested} disabled={busy === t.id} onPick={(a) => assign(t, a)} />
                        <button type="button" className="ob-link tk-dismiss" disabled={busy === t.id} onClick={() => update(t, { status: 'dismissed' }, 'Dismissed.')}>Dismiss</button>
                      </div>
                    </div>
                  ))}
                </section>
              );
            })}
            <p className="ap-hint">The outlined name is who the call suggests. Click any name to assign. Tasks for the client appear in their account straight away.</p>
          </div>
        )
      ) : (
        <>
          <div className="filters">
            <button type="button" className={`pill${who === 'all' ? ' on' : ''}`} onClick={() => setWho('all')}>Everyone<span className="pill-n">{(tab === 'open' ? open : done).length}</span></button>
            {ASSIGNEES.map((a) => (
              <button key={a.id} type="button" className={`pill${who === a.id ? ' on' : ''}`} onClick={() => setWho(a.id)}>
                {a.label}<span className="pill-n">{(tab === 'open' ? open : done).filter((t) => t.assignee === a.id).length}</span>
              </button>
            ))}
          </div>
          <section className="list tk-list" aria-label={tab === 'open' ? 'Open tasks' : 'Done tasks'}>
            {!shown.length && <p className="cm-none tk-none">{tab === 'open' ? 'No open tasks here.' : 'Nothing done yet.'}</p>}
            {shown.map((t) => (
              <div key={t.id} className={`tk-row${t.status === 'done' ? ' done' : ''}`}>
                <Tick done={t.status === 'done'} label={`Mark "${t.title}" ${t.status === 'done' ? 'not done' : 'done'}`} disabled={busy === t.id}
                  onToggle={() => update(t, { status: t.status === 'done' ? 'open' : 'done' }, t.status === 'done' ? 'Moved back to open.' : 'Done.')} />
                <div className="tk-main">
                  <div className="tk-title">{t.title}</div>
                  <div className="tk-meta">
                    <span>{name(t.clientId)}</span>
                    {t.meetingTitle && <span>From: {t.meetingTitle}</span>}
                    {t.status === 'done' && t.doneAt && <span>Done {fmtDay(t.doneAt)}{t.doneBy ? ` by ${t.doneBy}` : ''}</span>}
                  </div>
                  {t.detail && <div className="tk-detail">{t.detail}</div>}
                </div>
                {t.status === 'open' ? (
                  <>
                    <label className="tk-due">
                      <span className="sr">Due date</span>
                      <input type="date" value={t.due ?? ''} className={overdue(t) ? 'late' : ''} onChange={(e) => update(t, { due: e.target.value })} />
                    </label>
                    <label className="vsel tk-reassign">
                      <span className="sr">Assigned to</span>
                      <select value={t.assignee ?? ''} disabled={busy === t.id} onChange={(e) => e.target.value && assign(t, e.target.value as Assignee)}>
                        {ASSIGNEES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
                      </select>
                    </label>
                  </>
                ) : <Who a={t.assignee} />}
              </div>
            ))}
          </section>
          {tab === 'open' && who === 'ai' && <p className="ap-hint">Tasks for AI are listed here for now. Having Claude carry them out is a next step.</p>}
        </>
      )}

      {adding && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <form className="modal mt-add" role="dialog" aria-modal="true" aria-labelledby="add-task-t" onSubmit={async (e) => {
            e.preventDefault();
            try {
              await backend.addTask(form.clientId, { title: form.title, detail: form.detail, assignee: form.assignee, due: form.due });
              await refreshTasks(); setAdding(false);
              toast(form.assignee ? `Task added for ${ASSIGNEE_NAME[form.assignee]}.` : 'Task added to To review.');
            } catch (x) { toast(x instanceof Error ? x.message : 'Could not add it.'); }
          }}>
            <div id="add-task-t" className="m-t">Add a task</div>
            <div className="mt-add-row">
              <label className="ae-f"><span>Client</span>
                <select className="ob-input" required value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="ae-f"><span>Due (optional)</span><input className="ob-input" type="date" value={form.due} onChange={(e) => setForm({ ...form, due: e.target.value })} /></label>
            </div>
            <label className="ae-f"><span>Task</span><input className="ob-input" required placeholder="e.g. Send the beach shoot photos" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="ae-f"><span>Details (optional)</span><textarea className="ob-input" rows={2} value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} /></label>
            <div className="ae-f"><span>Assign to</span><AssignButtons value={form.assignee} onPick={(a) => setForm({ ...form, assignee: form.assignee === a ? null : a })} /></div>
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn gold">Add task</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
