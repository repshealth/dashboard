'use client';

import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { SOURCES, STAGES, STAGE_NAME } from '@/lib/constants';
import { fmtDate } from '@/lib/format';
import type { Lead } from '@/lib/types';

export default function LeadDetail({ lead, clientName, showClient }: { lead: Lead | null; clientName: string; showClient?: boolean }) {
  const { moveLead, saveNotes } = useData();
  const [note, setNote] = useState(lead?.notes ?? '');
  const [saving, setSaving] = useState(false);
  useEffect(() => setNote(lead?.notes ?? ''), [lead?.id, lead?.notes]);

  if (!lead) {
    return (
      <aside className="detail" aria-label="Lead detail">
        <h2>No leads yet</h2>
        <p className="contact" style={{ lineHeight: 1.55, marginTop: 8 }}>
          Once {clientName}&apos;s website is live, every form submission lands here as a new lead, then moves along the
          board as they book and buy.
        </p>
      </aside>
    );
  }

  const facts: [string, string | undefined][] = [
    ['Source', SOURCES[lead.source]?.label],
    ['Page', lead.page],
    ['Campaign (UTM)', lead.utm],
    ['First seen', fmtDate(lead.firstSeen)],
    ['MailerLite', lead.mailerlite || 'Not connected'],
    ['Calendly', lead.calendly || 'Not booked'],
    ['Stripe', lead.stripe || 'No purchase yet'],
  ];
  const dirty = note !== (lead.notes ?? '');

  return (
    <aside className="detail" aria-label="Lead detail">
      {showClient && <div className="lc-client">{clientName}</div>}
      <h2>{lead.name}</h2>
      <div className="contact">{[lead.email, lead.phone].filter(Boolean).join(' · ')}</div>
      <div className="stagebadge">{STAGE_NAME[lead.stage]}</div>

      <div className="lbl sm">MOVE MANUALLY</div>
      <div className="moves">
        {STAGES.map((s) => (
          <button key={s.id} type="button" className={lead.stage === s.id ? 'on' : ''} onClick={() => moveLead(lead.id, s.id)}>
            {s.name}
          </button>
        ))}
      </div>

      <dl style={{ marginTop: 20 }}>
        {facts.map(([k, v]) => (
          <div key={k}><dt>{k}</dt><dd>{v || '–'}</dd></div>
        ))}
      </dl>

      {lead.answers.length > 0 && (
        <>
          <div className="lbl">{lead.answersTitle || 'FORM ANSWERS'}</div>
          <dl>
            {lead.answers.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
            ))}
          </dl>
        </>
      )}

      <div className="lbl">TIMELINE</div>
      <ol>
        {lead.events.map((e) => (
          <li key={e.id}>
            <span className="dot" />
            <div>
              <div className="w">{e.label}</div>
              <div className="h">{[e.source, fmtDate(e.at)].filter(Boolean).join(' · ')}</div>
            </div>
          </li>
        ))}
      </ol>

      <label style={{ display: 'block' }}>
        <span className="lbl" style={{ display: 'block' }}>NOTES</span>
        <textarea rows={3} placeholder="Add a note..." value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {dirty && (
        <div className="note-save">
          <button
            type="button"
            className="btn gold"
            disabled={saving}
            onClick={async () => { setSaving(true); try { await saveNotes(lead.id, note); } finally { setSaving(false); } }}
          >
            {saving ? 'Saving…' : 'Save note'}
          </button>
        </div>
      )}
    </aside>
  );
}
