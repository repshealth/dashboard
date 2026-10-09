'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { MeetingDetail, MeetingItem, VoiceCard, meetingMatches } from '../meetings/parts';
import { backend } from '@/lib/backend';

/** Every client call, matched to accounts automatically. Assign stragglers, hide internal calls, keep each client's voice. */
export default function AgencyMeetings() {
  const router = useRouter();
  const { viewer, clients, allMeetings, refreshMeetings, toast } = useData();
  const [filter, setFilter] = useState<string>('all'); // all | unassigned | client id
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ clientId: '', title: '', date: '', text: '' });

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  useEffect(() => { refreshMeetings().catch(() => {}); }, [refreshMeetings]);

  const list = allMeetings ?? [];
  const inFilter = (clientId: string | null) => filter === 'all' || (filter === 'unassigned' ? !clientId : clientId === filter);
  const shown = useMemo(() => list.filter((m) => inFilter(m.clientId) && meetingMatches(m, q)), [list, filter, q]); // eslint-disable-line react-hooks/exhaustive-deps
  const current = shown.find((m) => m.id === sel) ?? shown[0];
  const name = (id: string | null) => (id ? clients.find((c) => c.id === id)?.name ?? 'Client' : 'Not matched');
  const count = (id: string | null | 'all') => list.filter((m) => (id === 'all' ? true : m.clientId === id)).length;
  const withCalls = clients.filter((c) => count(c.id));

  if (!viewer?.isAdmin) return null;

  const act = async (fn: () => Promise<unknown>, msg: string) => {
    setBusy(true);
    try { await fn(); await refreshMeetings(); toast(msg); }
    catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="view">
      <header>
        <div>
          <h1>Meetings</h1>
          <p className="sub">Every Google Meet call with clients, from Gemini notes and transcripts. Clients see their own calls in their account.</p>
        </div>
        <div className="actions">
          <button type="button" className="btn gold" onClick={() => { setForm({ clientId: filter !== 'all' && filter !== 'unassigned' ? filter : '', title: '', date: '', text: '' }); setAdding(true); }}>+ Add a call</button>
        </div>
      </header>

      <div className="filters">
        <button type="button" className={`pill${filter === 'all' ? ' on' : ''}`} onClick={() => { setFilter('all'); setSel(null); }}>All calls<span className="pill-n">{count('all')}</span></button>
        <button type="button" className={`pill${filter === 'unassigned' ? ' on' : ''}`} onClick={() => { setFilter('unassigned'); setSel(null); }}>Not matched<span className="pill-n">{count(null)}</span></button>
        {withCalls.map((c) => (
          <button key={c.id} type="button" className={`pill${filter === c.id ? ' on' : ''}`} onClick={() => { setFilter(c.id); setSel(null); }}>{c.name}<span className="pill-n">{count(c.id)}</span></button>
        ))}
      </div>

      {allMeetings === null ? <div className="loading">Loading meetings…</div> : (
        <div className="mt-agency">
          <div className="ap-grid mt-grid">
            <div className="ap-list">
              <label className="search oa-search">
                <span className="sr">Search calls</span>
                <input type="search" placeholder="Search every transcript..." value={q} onChange={(e) => setQ(e.target.value)} />
              </label>
              {filter !== 'all' && filter !== 'unassigned' && (
                <VoiceCard clientId={filter} name={name(filter)} compact />
              )}
              {shown.map((m) => (
                <MeetingItem key={m.id} m={m} on={current?.id === m.id} onClick={() => setSel(m.id)}
                  tag={<>
                    <span className={`stbadge sm ${m.clientId ? 'st-review' : 'st-changes'}`}>{name(m.clientId)}</span>
                    {!m.visibleToClient && <span className="stbadge sm st-build">Hidden from client</span>}
                  </>} />
              ))}
              {!shown.length && <p className="cm-none">{list.length ? 'No calls match.' : 'No calls yet. Set up the Google Meet sync, or add one by hand.'}</p>}
            </div>

            {current && (
              <MeetingDetail m={current} q={q} tools={
                <>
                  <label className="vsel">
                    <span className="sr">Client</span>
                    <select value={current.clientId ?? ''} disabled={busy} onChange={(e) => act(() => backend.updateMeeting(current.id, { clientId: e.target.value || null }), e.target.value ? `Moved to ${name(e.target.value)}. Their future calls will match too.` : 'Unlinked from the client.')}>
                      <option value="">Not matched to a client</option>
                      {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </label>
                  {current.clientId && (
                    <button type="button" className="btn" disabled={busy} onClick={() => act(() => backend.updateMeeting(current.id, { visibleToClient: !current.visibleToClient }), current.visibleToClient ? 'Hidden from the client.' : 'The client can see this call now.')}>
                      {current.visibleToClient ? 'Hide from client' : 'Show to client'}
                    </button>
                  )}
                  <button type="button" className="btn" disabled={busy} onClick={() => { if (confirm(`Delete "${current.title}" from the CRM? The Google Doc is not touched.`)) act(() => backend.deleteMeeting(current.id), 'Call deleted.'); }}>Delete</button>
                </>
              } />
            )}
          </div>
        </div>
      )}

      {adding && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setAdding(false); }}>
          <form className="modal mt-add" role="dialog" aria-modal="true" aria-labelledby="add-call-t" onSubmit={(e) => {
            e.preventDefault();
            act(async () => { await backend.addMeeting({ clientId: form.clientId || null, title: form.title, date: form.date, text: form.text }); setAdding(false); }, 'Call added.');
          }}>
            <div id="add-call-t" className="m-t">Add a call</div>
            <p>Paste the Gemini notes or transcript from Google Docs. Lines like <i>Name: what they said</i> become the transcript.</p>
            <div className="mt-add-row">
              <label className="ae-f"><span>Client</span>
                <select className="ob-input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
                  <option value="">Not matched yet</option>
                  {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </label>
              <label className="ae-f"><span>When</span><input className="ob-input" type="datetime-local" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} /></label>
            </div>
            <label className="ae-f"><span>Call name</span><input className="ob-input" required placeholder="e.g. Website review" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <label className="ae-f"><span>Notes or transcript</span><textarea className="ob-input" required rows={10} value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })}
              placeholder={'Summary\nWhat the call covered...\n\nSuggested next steps\n[ ] Send the draft\n\nTranscript\n00:00:00\nJames: Morning!\nDani: Hiya!'} /></label>
            <div className="cp-a">
              <button type="button" className="btn" onClick={() => setAdding(false)}>Cancel</button>
              <button type="submit" className="btn gold" disabled={busy}>Add call</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
