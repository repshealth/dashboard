'use client';

import { useEffect, useMemo, useState } from 'react';
import { useData } from '../DataProvider';
import LeadDetail from './LeadDetail';
import { Kpis, LeadBoard, LeadTable, SourcePills } from './parts';
import { AUTO_MOVES, SOURCES, STAGE_NAME } from '@/lib/constants';
import { downloadCsv, fmtDate } from '@/lib/format';
import type { SourceId } from '@/lib/types';

type View = 'board' | 'list';

const Arrow = () => (
  <svg width="12" height="8" viewBox="0 0 16 10" fill="none" stroke="#B4AECB" strokeWidth="1.6" aria-hidden="true"><path d="M1 5h13M10 1l4 4-4 4" /></svg>
);


export default function LeadsView() {
  const { client, leads } = useData();
  const [source, setSource] = useState<'all' | SourceId>('all');
  const [view, setView] = useState<View>('board');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  // Reset filters when switching client.
  useEffect(() => { setSource('all'); setQ(''); setSelId(null); }, [client?.id]);

  const all = leads ?? [];
  const bySource = useMemo(() => all.filter((l) => source === 'all' || l.source === source), [all, source]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return bySource.filter((l) => !s || l.name.toLowerCase().includes(s) || l.email.toLowerCase().includes(s));
  }, [bySource, q]);

  const selected = all.find((l) => l.id === selId) ?? all.find((l) => l.stage === 'call') ?? all[0] ?? null;

  const exportCsv = () =>
    downloadCsv(`${client?.slug || 'leads'}-leads.csv`, [
      ['Name', 'Email', 'Phone', 'Source', 'Stage', 'Page', 'UTM', 'First seen', 'Value'],
      ...shown.map((l) => [l.name, l.email, l.phone ?? '', SOURCES[l.source].label, STAGE_NAME[l.stage], l.page ?? '', l.utm ?? '', fmtDate(l.firstSeen), l.value]),
    ]);

  if (!client) return <div className="loading">No clients on this account yet.</div>;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Leads</h1>
          <p className="sub">Every website lead, where it came from and where it is now</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" title="Date filtering arrives with live data">Last 30 days ▾</button>
          <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
          <button className="btn gold" type="button" title="Manual lead entry is coming next">+ Add lead</button>
        </div>
      </header>

      <Kpis leads={bySource} growthNote={client.growthNote} revenueNote={client.revenueNote} />

      <section className="rules" aria-label="How leads move">
        <div className="t">AUTO-MOVES</div>
        {AUTO_MOVES.map(([a, b]) => (
          <div className="rule" key={a}><span>{a}</span><Arrow /><span>{b}</span></div>
        ))}
      </section>

      <div className="filters">
        <SourcePills value={source} onChange={setSource} />
        <div className="seg" role="group" aria-label="View">
          <button type="button" className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button>
          <button type="button" className={view === 'list' ? 'on' : ''} onClick={() => setView('list')}>List</button>
        </div>
        <label className="search">
          <span className="sr">Search leads</span>
          <input type="search" placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <div className="work">
        <div className="boardwrap">
          {leads === null ? (
            <div className="loading">Loading leads…</div>
          ) : view === 'board' ? (
            <LeadBoard leads={shown} selectedId={selected?.id} onSelect={setSelId} />
          ) : (
            <LeadTable leads={shown} selectedId={selected?.id} onSelect={setSelId} />
          )}
        </div>
        <LeadDetail lead={selected} clientName={client.name} />
      </div>
    </div>
  );
}
