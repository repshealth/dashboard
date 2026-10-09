'use client';

import SourceTag from './SourceTag';
import { SOURCES, SOURCE_IDS, STAGES, STAGE_NAME, STAGE_ORDER } from '@/lib/constants';
import { gbp, pct, timeAgo } from '@/lib/format';
import type { Lead, SourceId } from '@/lib/types';

/** Shared pieces of the client Leads screen and the agency Overview. */

export const headline = (l: Lead) => l.headline || timeAgo(l.firstSeen);
export const detail = (l: Lead) => l.detail || l.page || '';
const bookedCall = (l: Lead) => ['call', 'showed', 'purchased'].includes(l.stage) || (l.stage === 'lost' && !!l.attended);
const callPassed = (l: Lead) => ['showed', 'purchased'].includes(l.stage) || (l.stage === 'lost' && !!l.attended);

export function leadStats(leads: Lead[]) {
  const booked = leads.filter(bookedCall).length;
  const past = leads.filter(callPassed);
  const attended = past.filter((l) => l.attended).length;
  const bought = leads.filter((l) => l.stage === 'purchased');
  const revenue = bought.reduce((a, l) => a + l.value, 0);
  const week = leads.filter((l) => Date.now() - new Date(l.firstSeen).getTime() < 7 * 86400000).length;
  return { total: leads.length, booked, past: past.length, attended, bought: bought.length, revenue, week };
}

export function Kpis({ leads, growthNote, revenueNote }: { leads: Lead[]; growthNote?: string; revenueNote?: string }) {
  const s = leadStats(leads);
  const list = [
    { l: 'NEW LEADS', v: String(s.total), s: growthNote ?? `${s.week} in the last 7 days` },
    { l: 'CALLS BOOKED', v: String(s.booked), s: `${pct(s.booked, s.total)} of leads` },
    { l: 'SHOW RATE', v: pct(s.attended, s.past), s: `${s.attended} of ${s.past}` },
    { l: 'PURCHASED', v: String(s.bought), s: `${pct(s.bought, s.booked)} of calls` },
    { l: 'REVENUE', v: gbp(s.revenue), s: revenueNote ?? 'From Stripe payments' },
  ];
  return (
    <section className="kpis" aria-label="Key numbers">
      {list.map((k) => (
        <div className="kpi" key={k.l}><div className="l">{k.l}</div><div className="v">{k.v}</div><div className="s">{k.s}</div></div>
      ))}
    </section>
  );
}

export function SourcePills({ value, onChange }: { value: 'all' | SourceId; onChange: (v: 'all' | SourceId) => void }) {
  return (
    <>
      {(['all', ...SOURCE_IDS] as const).map((id) => (
        <button key={id} type="button" className={`pill${value === id ? ' on' : ''}`} onClick={() => onChange(id)}>
          {id === 'all' ? 'All sources' : SOURCES[id].label}
        </button>
      ))}
    </>
  );
}

/** Pipeline columns. Pass clientNames to show which client each lead belongs to (agency view). */
export function LeadBoard({ leads, selectedId, onSelect, clientNames }: {
  leads: Lead[]; selectedId?: string; onSelect: (id: string) => void; clientNames?: Record<string, string>;
}) {
  return (
    <div className="board">
      {STAGES.map((s) => {
        const col = leads.filter((l) => l.stage === s.id);
        return (
          <div className="col" key={s.id}>
            <div className="colh"><span>{s.label}</span><span className="count">{col.length}</span></div>
            <div className="hint">{s.hint}</div>
            {col.length ? col.map((l) => (
              <button key={l.id} type="button" className={`lcard${selectedId === l.id ? ' on' : ''}`} onClick={() => onSelect(l.id)}>
                {clientNames && <div className="lc-client">{clientNames[l.clientId]}</div>}
                <div className="n">{l.name}</div>
                <div className="r"><SourceTag source={l.source} /><span className="b">{headline(l)}</span></div>
                <div className="m">{detail(l)}</div>
              </button>
            )) : <div className="empty">No leads here</div>}
          </div>
        );
      })}
    </div>
  );
}

export function LeadTable({ leads, selectedId, onSelect, clientNames }: {
  leads: Lead[]; selectedId?: string; onSelect: (id: string) => void; clientNames?: Record<string, string>;
}) {
  const cols = clientNames ? 7 : 6;
  return (
    <div className="list">
      <table>
        <thead>
          <tr>
            <th>NAME</th>{clientNames && <th>CLIENT</th>}<th>SOURCE</th><th>STAGE</th><th>LAST ACTIVITY</th><th>DETAIL</th><th>VALUE</th>
          </tr>
        </thead>
        <tbody>
          {[...leads].sort((a, b) => STAGE_ORDER[a.stage] - STAGE_ORDER[b.stage]).map((l) => (
            <tr key={l.id} className={`row${selectedId === l.id ? ' on' : ''}`}>
              <td>
                <button type="button" className="namebtn" onClick={() => onSelect(l.id)}>{l.name}</button>
                <div className="email">{l.email}</div>
              </td>
              {clientNames && <td>{clientNames[l.clientId]}</td>}
              <td><SourceTag source={l.source} /></td>
              <td style={{ color: 'var(--accent)', fontWeight: 600 }}>{STAGE_NAME[l.stage]}</td>
              <td>{headline(l)}</td>
              <td style={{ color: 'var(--muted)' }}>{detail(l)}</td>
              <td style={{ fontWeight: 600 }}>{l.value ? gbp(l.value) : ''}</td>
            </tr>
          ))}
          {!leads.length && (
            <tr><td colSpan={cols} style={{ textAlign: 'center', color: 'var(--dim)', padding: 24 }}>No leads match</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
