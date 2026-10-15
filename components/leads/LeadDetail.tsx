'use client';

import { useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { SOURCES, STAGES, STAGE_NAME } from '@/lib/constants';
import { sourceLabel } from './SourceTag';
import { fmtDate } from '@/lib/format';
import type { Lead } from '@/lib/types';

/**
 * Answers grouped by the form they came from, newest first. Leads from before answers were
 * kept per form have one set: put under the form they last submitted.
 */
function answerSets(lead: Lead): { form: string; at?: string; answers: [string, string][] }[] {
  if (lead.submissions?.length) return lead.submissions;
  if (!lead.answers.length) return [];
  const last = lead.events.find((e) => /^Submitted /.test(e.label) && !/^Submitted (a form on|a website form)/.test(e.label));
  return [{ form: last ? last.label.slice(10) : lead.form || lead.answersTitle || 'Form answers', at: last?.at, answers: lead.answers }];
}

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
    ['Source', sourceLabel(lead)],
    ['Source type', lead.form ? SOURCES[lead.source]?.label : undefined],
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

      {answerSets(lead).map((set) => (
        <div key={set.form} className="ld-set">
          <div className="lbl ld-set-h"><span>{set.form.toUpperCase()}</span>{set.at && <span className="ld-set-at">{fmtDate(set.at)}</span>}</div>
          {set.answers.length ? (
            <dl>
              {set.answers.map(([k, v]) => (
                <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
              ))}
            </dl>
          ) : <p className="ld-set-none">No answers on this form, just their details.</p>}
        </div>
      ))}

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
