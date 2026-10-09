'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '../DataProvider';
import { MeetingDetail, MeetingItem, meetingMatches } from './parts';
import { backend } from '@/lib/backend';
import type { Meeting } from '@/lib/meetings/types';

/** Every call with the REPS team: summaries, next steps and full transcripts. */
export default function MeetingsView() {
  const { client, viewer } = useData();
  const [list, setList] = useState<Meeting[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!client) return;
    setList(null); setSel(null); setQ('');
    backend.listMeetings(client.id).then(setList).catch(() => setList([]));
  }, [client]);

  const shown = useMemo(() => (list ?? []).filter((m) => meetingMatches(m, q)), [list, q]);
  const current = shown.find((m) => m.id === sel) ?? shown[0];
  const admin = Boolean(viewer?.isAdmin);

  if (!client) return <div className="loading">No clients on this account yet.</div>;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Meetings</h1>
          <p className="sub">Every call with the REPS team, with notes, next steps and the full transcript</p>
        </div>
      </header>

      {list === null ? <div className="loading">Loading meetings…</div> : !list.length ? (
        <div className="sv-empty">
          <span className="stbadge st-build">No calls yet</span>
          <div className="sv-et">Your calls with REPS will appear here</div>
          <p>After each Google Meet call, the notes and transcript are added automatically.</p>
        </div>
      ) : (
        <div className="ap-grid mt-grid">
          <div className="ap-list">
            <label className="search oa-search">
              <span className="sr">Search all calls</span>
              <input type="search" placeholder="Search all calls..." value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <div className="mt-count">{shown.length} call{shown.length === 1 ? '' : 's'}{q ? ` mention “${q}”` : ''}</div>
            {shown.map((m) => (
              <MeetingItem key={m.id} m={m} on={current?.id === m.id} onClick={() => setSel(m.id)}
                tag={admin && !m.visibleToClient ? <span className="stbadge sm st-changes">Hidden from client</span> : undefined} />
            ))}
            {!shown.length && <p className="cm-none">No calls match.</p>}
          </div>
          {current && <MeetingDetail m={current} q={q} />}
        </div>
      )}
    </div>
  );
}
