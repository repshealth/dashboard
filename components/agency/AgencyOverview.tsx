'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import LeadDetail from '../leads/LeadDetail';
import { Kpis, LeadBoard, LeadTable, leadStats } from '../leads/parts';
import { SITE_STATUS, SOURCES, STAGE_NAME } from '@/lib/constants';
import { downloadCsv, fmtDate, gbp, pct } from '@/lib/format';
import { pendingVersion } from '@/lib/site/versions';
import type { Site } from '@/lib/types';

/** Website status as the agency sees it: an amend waiting for approval comes first. */
function siteBadge(s?: Site) {
  if (!s) return { label: 'No website yet', cls: 'st-build' };
  if (pendingVersion(s)) return { label: 'Amend to approve', cls: 'st-review' };
  return SITE_STATUS[s.status];
}

export default function AgencyOverview() {
  const router = useRouter();
  const { viewer, clients, allLeads, allSites, approvalsCount, refreshAgency, setClientId } = useData();
  const [clientFilter, setClientFilter] = useState<string>('all');
  const [view, setView] = useState<'board' | 'list'>('board');
  const [q, setQ] = useState('');
  const [selId, setSelId] = useState<string | null>(null);

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  useEffect(() => { refreshAgency().catch(() => {}); }, [refreshAgency]);

  const names = useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.name])), [clients]);
  const sites = useMemo(() => Object.fromEntries((allSites ?? []).map((s) => [s.clientId, s])), [allSites]);
  const leads = allLeads ?? [];
  const forClient = useMemo(() => leads.filter((l) => clientFilter === 'all' || l.clientId === clientFilter), [leads, clientFilter]);
  const bySource = forClient;
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return bySource.filter((l) => !s || l.name.toLowerCase().includes(s) || l.email.toLowerCase().includes(s));
  }, [bySource, q]);
  const selected = shown.find((l) => l.id === selId) ?? null;
  const oneClient = clientFilter !== 'all' ? clients.find((c) => c.id === clientFilter) : null;

  const rows = useMemo(() => clients.map((c) => {
    const l = leads.filter((x) => x.clientId === c.id);
    return { client: c, stats: leadStats(l), badge: siteBadge(sites[c.id]) };
  }).sort((a, b) => b.stats.total - a.stats.total || a.client.name.localeCompare(b.client.name)), [clients, leads, sites]);

  const openAccount = (id: string, to: '/leads' | '/website' | '/emails' | '/meetings') => { setClientId(id); router.push(to); };
  const pick = (id: string) => { setClientFilter(id); setSelId(null); };

  const exportCsv = () =>
    downloadCsv(`reps-${oneClient?.slug || 'all-clients'}-leads.csv`, [
      ['Client', 'Name', 'Email', 'Phone', 'Source', 'Stage', 'Page', 'UTM', 'First seen', 'Value'],
      ...shown.map((l) => [names[l.clientId] ?? '', l.name, l.email, l.phone ?? '', SOURCES[l.source].label, STAGE_NAME[l.stage], l.page ?? '', l.utm ?? '', fmtDate(l.firstSeen), l.value]),
    ]);

  if (!viewer?.isAdmin) return null;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Agency overview</h1>
          <p className="sub">{oneClient ? `Showing ${oneClient.name} only` : 'Every client’s leads and websites in one place'}</p>
        </div>
        <div className="actions">
          <button className="btn" type="button" onClick={exportCsv}>Export CSV</button>
        </div>
      </header>

      {approvalsCount > 0 && (
        <Link href="/agency/approvals" className="ag-alert">
          <span className="ag-alert-n">{approvalsCount}</span>
          <span><b>{approvalsCount === 1 ? '1 website needs' : `${approvalsCount} websites need`} you.</b> Amends waiting for approval or changes to make.</span>
          <span className="ag-alert-go">Open Approvals →</span>
        </Link>
      )}

      {allLeads === null ? <div className="loading">Loading every client&apos;s numbers…</div> : (
        <>
          <Kpis leads={bySource} growthNote={`${leadStats(bySource).week} in the last 7 days`} revenueNote={oneClient ? undefined : `Across ${clients.length} clients`} />

          {clientFilter === 'all' && (
            <section className="list ag-clients" aria-label="Clients">
              <table>
                <thead>
                  <tr><th>CLIENT</th><th>WEBSITE</th><th>LEADS</th><th>CALLS BOOKED</th><th>SHOW RATE</th><th>PURCHASED</th><th>REVENUE</th><th>ACCOUNT</th></tr>
                </thead>
                <tbody>
                  {rows.map(({ client: c, stats: s, badge }) => (
                    <tr key={c.id} className="row">
                      <td><button type="button" className="namebtn" onClick={() => pick(c.id)} title="Show only this client">{c.name}</button></td>
                      <td><span className={`stbadge sm ${badge.cls}`}>{badge.label}</span></td>
                      <td className="num">{s.total}</td>
                      <td className="num">{s.booked}</td>
                      <td className="num">{s.past ? pct(s.attended, s.past) : '–'}</td>
                      <td className="num">{s.bought}</td>
                      <td className="num">{s.revenue ? gbp(s.revenue) : '–'}</td>
                      <td>
                        <span className="ag-open">
                          <button type="button" className="ob-link" onClick={() => openAccount(c.id, '/leads')}>Leads</button>
                          <button type="button" className="ob-link" onClick={() => openAccount(c.id, '/website')}>Website</button>
                          <button type="button" className="ob-link" onClick={() => openAccount(c.id, '/emails')}>Emails</button>
                          <button type="button" className="ob-link" onClick={() => openAccount(c.id, '/meetings')}>Meetings</button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          <div className="filters">
            {/* Filter by client. Each card's tag still shows where the lead came from. */}
            <button type="button" className={`pill${clientFilter === 'all' ? ' on' : ''}`} onClick={() => pick('all')}>
              All clients<span className="pill-n">{leads.length}</span>
            </button>
            {rows.map(({ client: c, stats: s }) => (
              <button key={c.id} type="button" className={`pill${clientFilter === c.id ? ' on' : ''}`} onClick={() => pick(c.id)}>
                {c.name}<span className="pill-n">{s.total}</span>
              </button>
            ))}
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
              {view === 'board'
                ? <LeadBoard leads={shown} selectedId={selected?.id} onSelect={setSelId} clientNames={clientFilter === 'all' ? names : undefined} />
                : <LeadTable leads={shown} selectedId={selected?.id} onSelect={setSelId} clientNames={clientFilter === 'all' ? names : undefined} />}
            </div>
            {selected ? (
              <LeadDetail lead={selected} clientName={names[selected.clientId] ?? ''} showClient />
            ) : (
              <aside className="detail" aria-label="Lead detail">
                <h2>Pick a lead</h2>
                <p className="contact" style={{ lineHeight: 1.55, marginTop: 8 }}>
                  Click any card to see the lead&apos;s details and timeline. Use the client buttons above to show one client\u2019s leads.
                </p>
              </aside>
            )}
          </div>
        </>
      )}
    </div>
  );
}
