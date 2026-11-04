'use client';

import { useRef, useState, type FormEvent } from 'react';
import { useData } from '../DataProvider';
import { AssignButtons } from './parts';
import { backend } from '@/lib/backend';
import { uploadTaskFile } from '@/lib/uploads';
import { ASSIGNEE_NAME, type Assignee, type Task, type TaskFile } from '@/lib/tasks/types';

const today = () => new Date().toISOString().slice(0, 10);
const size = (n?: number) => (!n ? '' : n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`);

interface Draft { client: string; title: string; detail: string; assignee: Assignee | null; due: string; assignedOn: string; files: TaskFile[] }

/**
 * Agency only: add a task, or edit one. The client can be picked from the dashboard or typed
 * in for someone not on it yet. Assigned and due dates, a description and files.
 */
export default function TaskForm({ task, clientId, onClose }: { task?: Task; clientId?: string; onClose: () => void }) {
  const { clients, refreshTasks, toast } = useData();
  const nameOf = (id: string) => clients.find((c) => c.id === id)?.name ?? '';
  const [d, setD] = useState<Draft>(() => ({
    client: task ? (task.clientId ? nameOf(task.clientId) : task.clientName ?? '') : clientId ? nameOf(clientId) : '',
    title: task?.title ?? '', detail: task?.detail ?? '', assignee: task?.assignee ?? null,
    due: task?.due ?? '', assignedOn: task?.assignedOn ?? (task?.assignedAt ? task.assignedAt.slice(0, 10) : today()), files: task?.files ?? [],
  }));
  const [uploading, setUploading] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // A typed name that matches a client on the dashboard links to that client.
  const match = clients.find((c) => c.name.trim().toLowerCase() === d.client.trim().toLowerCase());
  const isNew = Boolean(d.client.trim()) && !match;

  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    setErr('');
    const files = [...list];
    setUploading((n) => n + files.length);
    for (const f of files) {
      try {
        const up = await uploadTaskFile(f);
        setD((x) => ({ ...x, files: [...x.files, up] }));
      } catch (e) { setErr(e instanceof Error ? e.message : `Could not upload ${f.name}.`); }
      finally { setUploading((n) => n - 1); }
    }
    if (fileRef.current) fileRef.current.value = '';
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!d.client.trim()) { setErr('Pick a client or type their name.'); return; }
    if (uploading) { setErr('Wait for the files to finish uploading.'); return; }
    if (d.due && d.assignedOn && d.due < d.assignedOn) { setErr('The due date is before the assigned date.'); return; }
    setBusy(true); setErr('');
    const who = match ? { clientId: match.id, clientName: '' } : { clientId: '', clientName: d.client.trim() };
    try {
      if (task) {
        await backend.updateTask(task.id, { ...who, title: d.title, detail: d.detail, due: d.due, assignedOn: d.assignedOn, files: d.files, ...(d.assignee !== task.assignee && d.assignee ? { assignee: d.assignee } : {}) });
        toast('Task saved.');
      } else {
        await backend.addTask(who.clientId, { title: d.title, detail: d.detail, assignee: d.assignee, due: d.due, assignedOn: d.assignedOn, clientName: who.clientName, files: d.files });
        toast(d.assignee ? `Task added for ${ASSIGNEE_NAME[d.assignee]}.` : 'Task added to To review.');
      }
      await refreshTasks();
      onClose();
    } catch (x) { setErr(x instanceof Error ? x.message : 'Could not save it.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal mt-add tk-form" role="dialog" aria-modal="true" aria-labelledby="task-form-t" onSubmit={save}>
        <div id="task-form-t" className="m-t">{task ? 'Edit task' : 'Add a task'}</div>

        <label className="ae-f"><span>Client</span>
          <input className="ob-input" list="tk-client-list" required placeholder="Pick one, or type a name if they’re not on the dashboard yet" value={d.client} onChange={(e) => setD({ ...d, client: e.target.value })} />
          <datalist id="tk-client-list">{clients.map((c) => <option key={c.id} value={c.name} />)}</datalist>
          {isNew && <span className="ap-hint tk-new">Not on the dashboard yet. The task is saved under this name and only the REPS team sees it.</span>}
        </label>

        <label className="ae-f"><span>Task</span><input className="ob-input" required placeholder="e.g. Send the beach shoot photos" value={d.title} onChange={(e) => setD({ ...d, title: e.target.value })} /></label>

        <div className="mt-add-row">
          <label className="ae-f"><span>Assigned date</span><input className="ob-input" type="date" value={d.assignedOn} onChange={(e) => setD({ ...d, assignedOn: e.target.value })} /></label>
          <label className="ae-f"><span>Due date</span><input className="ob-input" type="date" min={d.assignedOn || undefined} value={d.due} onChange={(e) => setD({ ...d, due: e.target.value })} /></label>
        </div>

        <label className="ae-f"><span>Description</span>
          <textarea className="ob-input" rows={5} placeholder="What needs doing, links, anything useful" value={d.detail} onChange={(e) => setD({ ...d, detail: e.target.value })} />
        </label>

        <div className="ae-f"><span>Files</span>
          {d.files.length > 0 && (
            <ul className="tk-files">
              {d.files.map((f, i) => (
                <li key={f.url + i}>
                  <a href={f.url} target="_blank" rel="noreferrer">{f.name}</a>
                  {f.size ? <small>{size(f.size)}</small> : null}
                  <button type="button" className="tk-file-x" aria-label={`Remove ${f.name}`} onClick={() => setD({ ...d, files: d.files.filter((_, j) => j !== i) })}>×</button>
                </li>
              ))}
            </ul>
          )}
          <input ref={fileRef} type="file" multiple hidden onChange={(e) => attach(e.target.files)} />
          <button type="button" className="btn tk-attach" onClick={() => fileRef.current?.click()} disabled={uploading > 0}>
            {uploading ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}…` : '+ Attach files'}
          </button>
          <span className="ap-hint">PDFs, images, documents or zips, up to 20 MB each.</span>
        </div>

        <div className="ae-f"><span>Assign to</span><AssignButtons value={d.assignee} onPick={(a) => setD({ ...d, assignee: d.assignee === a && !task ? null : a })} /></div>
        {isNew && d.assignee === 'client' && <p className="ap-hint">They don’t have a dashboard account yet, so they won’t see this task until they’re added.</p>}

        {err && <div className="form-msg err" role="alert">{err}</div>}
        <div className="cp-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn gold" disabled={busy || uploading > 0}>{busy ? 'Saving…' : task ? 'Save' : 'Add task'}</button>
        </div>
      </form>
    </div>
  );
}

/** A task's files as small links. */
export function TaskFiles({ files }: { files?: TaskFile[] }) {
  if (!files?.length) return null;
  return (
    <div className="tk-filelinks">
      {files.map((f, i) => <a key={f.url + i} href={f.url} target="_blank" rel="noreferrer" className="tk-filelink">📎 {f.name}</a>)}
    </div>
  );
}
