'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import type { LoginInfo } from '@/lib/backend/types';
import { makePassword, passwordProblem } from '@/lib/backend/password';
import { fmtWhen } from '@/lib/format';

type Form = { id?: string; name: string; email: string; password: string; clientIds: string[] };
const blank: Form = { name: '', email: '', password: '', clientIds: [] };

/** Agency only: who can sign in, and which client accounts each login can open. */
export default function LoginsPage() {
  const router = useRouter();
  const { viewer, clients, toast } = useData();
  const [logins, setLogins] = useState<LoginInfo[] | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [made, setMade] = useState<{ name: string; email: string; password: string } | null>(null);
  const [removing, setRemoving] = useState<LoginInfo | null>(null);

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  const load = useCallback(() => backend.listLogins().then(setLogins).catch((e) => toast(e.message)), [toast]);
  useEffect(() => { load(); }, [load]);

  if (!viewer?.isAdmin) return null;
  const name = (id: string) => clients.find((c) => c.id === id)?.name ?? 'Removed account';
  const url = typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? window.location.origin : 'the dashboard link';

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    const isNew = !form.id;
    if (form.password || isNew) { const p = passwordProblem(form.password); if (p) { setError(p); return; } }
    if (!form.clientIds.length) { setError('Pick at least one client account they can open.'); return; }
    setBusy(true); setError('');
    try {
      await backend.saveLogin({ id: form.id, name: form.name, email: form.email, password: form.password || undefined, clientIds: form.clientIds });
      await load();
      if (form.password) setMade({ name: form.name, email: form.email.trim().toLowerCase(), password: form.password });
      else toast('Saved.');
      setForm(null);
    } catch (x) {
      setError(x instanceof Error ? x.message : 'Could not save. Please try again.');
    } finally { setBusy(false); }
  };

  const details = made && `Hi ${made.name.split(' ')[0]}, here's your login for the REPS dashboard.\n\nLink: ${url}\nEmail: ${made.email}\nPassword: ${made.password}`;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Logins</h1>
          <p className="sub">Give clients their own login and choose which accounts they can see. A client login only ever sees the accounts ticked here.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn gold" onClick={() => { setForm({ ...blank, password: makePassword(), clientIds: clients.length === 1 ? [clients[0].id] : [] }); setError(''); }}>+ Add login</button>
        </div>
      </header>

      {logins === null ? <div className="loading">Loading logins…</div> : (
        <section className="list lg-list" aria-label="Logins">
          <table>
            <thead><tr><th>NAME</th><th>EMAIL</th><th>CAN SEE</th><th>LAST SIGNED IN</th><th /></tr></thead>
            <tbody>
              {logins.map((l) => (
                <tr key={l.id} className="row">
                  <td><b>{l.name}</b>{l.email === viewer.email ? <span className="lg-you"> (you)</span> : null}</td>
                  <td>{l.email}</td>
                  <td>
                    {l.isAdmin ? <span className="stbadge sm st-approved">Agency · every account</span>
                      : l.clientIds.length ? <span className="lg-chips">{l.clientIds.map((id) => <span key={id} className="lg-chip">{name(id)}</span>)}</span>
                      : <span className="lg-none">No accounts</span>}
                    {!l.isAdmin && !l.hasPassword && <span className="lg-warn">No password yet</span>}
                  </td>
                  <td className="lg-when">{l.lastSignIn ? fmtWhen(l.lastSignIn) : 'Never'}</td>
                  <td className="lg-act">
                    {l.isAdmin ? <span className="lg-note">Set in Cloudflare</span> : (
                      <>
                        <button type="button" className="ob-link" onClick={() => { setForm({ id: l.id, name: l.name, email: l.email, password: '', clientIds: l.clientIds }); setError(''); }}>Edit</button>
                        <button type="button" className="ob-link" onClick={() => setRemoving(l)}>Remove</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
              {!logins.some((l) => !l.isAdmin) && (
                <tr><td colSpan={5} className="lg-empty">No client logins yet. Press <b>Add login</b> to give a client access to their account.</td></tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {form && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setForm(null); }}>
          <form className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="lg-t" onSubmit={save}>
            <div id="lg-t" className="m-t">{form.id ? `Edit ${form.name}` : 'Add a login'}</div>
            <div className="mt-add-row">
              <label className="ae-f"><span>Name</span><input className="ob-input" required value={form.name} placeholder="e.g. Kate Dailey" onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
              <label className="ae-f"><span>Email (they sign in with this)</span><input className="ob-input" type="email" required value={form.email} placeholder="kate@example.com" onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            </div>
            <label className="ae-f">
              <span>{form.id ? 'New password (leave empty to keep the current one)' : 'Password'}</span>
              <span className="lg-pw">
                <input className="ob-input" value={form.password} autoComplete="new-password" placeholder={form.id ? 'Unchanged' : ''} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                <button type="button" className="btn" onClick={() => setForm({ ...form, password: makePassword() })}>Make one</button>
              </span>
            </label>
            <div className="ae-f">
              <span>Client accounts they can see</span>
              <div className="lg-pick">
                {clients.map((c) => {
                  const on = form.clientIds.includes(c.id);
                  return (
                    <label key={c.id} className={`lg-opt${on ? ' on' : ''}`}>
                      <input type="checkbox" checked={on} onChange={() => setForm({ ...form, clientIds: on ? form.clientIds.filter((x) => x !== c.id) : [...form.clientIds, c.id] })} />
                      {c.name}
                    </label>
                  );
                })}
              </div>
            </div>
            {error && <div className="form-msg err" role="alert">{error}</div>}
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setForm(null)}>Cancel</button>
              <button type="submit" className="btn gold" disabled={busy}>{busy ? 'Saving…' : form.id ? 'Save' : 'Add login'}</button>
            </div>
          </form>
        </div>
      )}

      {made && details && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setMade(null); }}>
          <div className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="lg-made">
            <div id="lg-made" className="m-t">Login ready for {made.name}</div>
            <p className="sub">Send them these details. The password isn&apos;t shown again, but you can always set a new one.</p>
            <textarea className="ob-input lg-details" readOnly rows={6} value={details} onFocus={(e) => e.target.select()} />
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setMade(null)}>Done</button>
              <button type="button" className="btn gold" onClick={async () => {
                try { await navigator.clipboard.writeText(details); toast('Login details copied.'); } catch { toast('Select the text and copy it.'); }
              }}>Copy details</button>
            </div>
          </div>
        </div>
      )}

      {removing && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setRemoving(null); }}>
          <div className="modal" role="dialog" aria-modal="true" aria-labelledby="lg-rm">
            <div id="lg-rm" className="m-t">Remove {removing.name}&apos;s login?</div>
            <p className="sub">They won&apos;t be able to sign in any more. Their comments and approvals stay.</p>
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setRemoving(null)}>Cancel</button>
              <button type="button" className="btn gold" onClick={async () => {
                try { await backend.removeLogin(removing.id); await load(); toast('Login removed.'); }
                catch (x) { toast(x instanceof Error ? x.message : 'Could not remove it.'); }
                setRemoving(null);
              }}>Remove login</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
