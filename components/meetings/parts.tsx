'use client';

import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import { fmtDuration, type Meeting, type VoiceProfile } from '@/lib/meetings/types';

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-10-08T17:30" -> "Thu 8 Oct 2026, 5:30pm". */
export function fmtCall(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const h = d.getHours();
  return `${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}, ${h % 12 || 12}${d.getMinutes() ? `:${String(d.getMinutes()).padStart(2, '0')}` : ''}${h < 12 ? 'am' : 'pm'}`;
}

/** Wraps matches of `q` in <mark>. */
function Hi({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'ig'));
  return <>{parts.map((p, i) => (i % 2 ? <mark key={i}>{p}</mark> : <Fragment key={i}>{p}</Fragment>))}</>;
}

/** Does a call mention `q` anywhere? */
export const meetingMatches = (m: Meeting, q: string) => {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return [m.title, m.summary, ...m.details, ...m.nextSteps, ...m.transcript.map((l) => `${l.speaker} ${l.text}`)].some((x) => x.toLowerCase().includes(s));
};

/** One call: summary, details, next steps and the full transcript. */
export function MeetingDetail({ m, q = '', tools }: { m: Meeting; q?: string; tools?: ReactNode }) {
  const [find, setFind] = useState(q);
  useEffect(() => setFind(q), [q, m.id]);
  const speakers = useMemo(() => [...new Set(m.transcript.map((l) => l.speaker))], [m]);
  const lines = m.transcript.filter((l) => !find.trim() || `${l.speaker} ${l.text}`.toLowerCase().includes(find.trim().toLowerCase()));

  return (
    <section className="mt-detail" aria-label={m.title}>
      <div className="ap-head">
        <div>
          <div className="ap-eyebrow">{m.source === 'gemini' ? 'Google Meet · Gemini notes' : 'Added by the REPS team'}</div>
          <h2>{m.title}</h2>
          <p className="sub">{fmtCall(m.startedAt)}{m.durationMins ? ` · ${fmtDuration(m.durationMins)}` : ''}{speakers.length ? ` · ${speakers.join(', ')}` : ''}</p>
        </div>
        <div className="actions">
          {m.docUrl && <a className="btn" href={m.docUrl} target="_blank" rel="noreferrer">Open in Google Docs</a>}
          {tools}
        </div>
      </div>

      <div className="mt-cols">
        <div className="detail mt-notes">
          <div className="lbl" style={{ marginTop: 0 }}>SUMMARY</div>
          <p className="mt-sum">{m.summary ? <Hi text={m.summary} q={find} /> : <span className="cm-none">No summary for this call.</span>}</p>
          {m.details.length > 0 && (
            <>
              <div className="lbl">DETAILS</div>
              <ul className="mt-list">{m.details.map((d, i) => <li key={i}><Hi text={d} q={find} /></li>)}</ul>
            </>
          )}
          {m.nextSteps.length > 0 && (
            <>
              <div className="lbl">NEXT STEPS</div>
              <ul className="mt-list mt-steps">{m.nextSteps.map((d, i) => <li key={i}><Hi text={d} q={find} /></li>)}</ul>
            </>
          )}
        </div>

        <div className="detail mt-transcript">
          <div className="mt-th">
            <div className="lbl" style={{ marginTop: 0 }}>TRANSCRIPT</div>
            <label className="search mt-find">
              <span className="sr">Search this transcript</span>
              <input type="search" placeholder="Search this call..." value={find} onChange={(e) => setFind(e.target.value)} />
            </label>
          </div>
          {!m.transcript.length ? <p className="cm-none">No transcript for this call, only notes.</p> : (
            <div className="mt-lines">
              {lines.map((l, i) => (
                <div key={i} className="mt-line">
                  <span className={`mt-who s${speakers.indexOf(l.speaker) % 4}`}>{l.speaker}</span>
                  {l.at && <span className="mt-at">{l.at.replace(/^00:/, '')}</span>}
                  <p><Hi text={l.text} q={find} /></p>
                </div>
              ))}
              {!lines.length && <p className="cm-none">Nothing in this call matches &ldquo;{find}&rdquo;.</p>}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** A call in a list. */
export function MeetingItem({ m, on, onClick, tag }: { m: Meeting; on: boolean; onClick: () => void; tag?: ReactNode }) {
  return (
    <button type="button" className={`ap-item${on ? ' on' : ''}`} onClick={onClick} aria-current={on ? 'true' : undefined}>
      <div className="ap-item-h"><b>{m.title}</b></div>
      <div className="ap-item-v">{fmtCall(m.startedAt)}{m.durationMins ? ` · ${fmtDuration(m.durationMins)}` : ''}</div>
      {m.summary && <div className="mt-item-s">{m.summary}</div>}
      {tag && <div className="ap-item-tags">{tag}</div>}
    </button>
  );
}

/** How a client talks, from their calls. REPS can rebuild it from the calls or edit it by hand. */
export function VoiceCard({ clientId, name, compact, onRewrite, rewriteBusy }: {
  clientId: string; name: string; compact?: boolean; onRewrite?: () => void; rewriteBusy?: boolean;
}) {
  const [v, setV] = useState<VoiceProfile | null | undefined>(undefined);
  const [edit, setEdit] = useState<VoiceProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    setV(undefined); setEdit(null); setErr(null);
    backend.getVoice(clientId).then(setV).catch(() => setV(null));
  }, [clientId]);

  const rebuild = async () => {
    setBusy(true); setErr(null);
    try { setV(await backend.refreshVoice(clientId)); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not rebuild it.'); }
    finally { setBusy(false); }
  };
  const lines = (s: string) => s.split('\n').map((x) => x.trim()).filter(Boolean);

  return (
    <div className="detail ae-card mt-voice">
      <div className="mt-vh">
        <div className="lbl" style={{ marginTop: 0 }}>{name.toUpperCase()}&apos;S VOICE</div>
        {v && !edit && <button type="button" className="ob-link" onClick={() => setEdit(v)}>Edit</button>}
      </div>
      {v === undefined ? <p className="cm-none">Loading…</p> : edit ? (
        <form className="mt-vedit" onSubmit={async (e) => {
          e.preventDefault(); setBusy(true);
          try { await backend.saveVoice(edit); setV({ ...edit, by: 'reps', updatedAt: new Date().toISOString() }); setEdit(null); }
          catch (x) { setErr(x instanceof Error ? x.message : 'Could not save.'); } finally { setBusy(false); }
        }}>
          <label className="ae-f"><span>How they talk</span><textarea className="ob-input" rows={4} value={edit.summary} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></label>
          <label className="ae-f"><span>Traits (one per line)</span><textarea className="ob-input" rows={4} value={edit.traits.join('\n')} onChange={(e) => setEdit({ ...edit, traits: lines(e.target.value) })} /></label>
          <label className="ae-f"><span>Phrases they use (one per line)</span><textarea className="ob-input" rows={4} value={edit.phrases.join('\n')} onChange={(e) => setEdit({ ...edit, phrases: lines(e.target.value) })} /></label>
          <label className="ae-f"><span>Avoid (one per line)</span><textarea className="ob-input" rows={3} value={edit.avoid.join('\n')} onChange={(e) => setEdit({ ...edit, avoid: lines(e.target.value) })} /></label>
          <div className="cp-a"><button type="button" className="btn" onClick={() => setEdit(null)}>Cancel</button><button type="submit" className="btn gold" disabled={busy}>Save</button></div>
        </form>
      ) : !v ? (
        <>
          <p className="cm-none">No voice profile yet. It&apos;s built from {name}&apos;s call transcripts.</p>
          <button type="button" className="btn" disabled={busy} onClick={rebuild}>{busy ? 'Building…' : 'Build from their calls'}</button>
        </>
      ) : (
        <>
          <p className="mt-vsum">{v.summary}</p>
          {!compact && v.traits.length > 0 && <ul className="mt-list">{v.traits.map((t) => <li key={t}>{t}</li>)}</ul>}
          {v.phrases.length > 0 && <div className="mt-chips" aria-label="Phrases they use">{v.phrases.map((p) => <span key={p}>&ldquo;{p}&rdquo;</span>)}</div>}
          {!compact && v.avoid.length > 0 && <p className="mt-avoid"><b>Avoid:</b> {v.avoid.join('; ')}</p>}
          <p className="ap-hint">From {v.meetingsUsed} call{v.meetingsUsed === 1 ? '' : 's'} · {v.by === 'reps' ? 'edited by REPS' : v.by === 'claude' ? 'by Claude' : 'simple rules (connect Claude for more)'} · {fmtWhen(v.updatedAt)}</p>
          <div className="mt-vbtns">
            <button type="button" className="btn" disabled={busy} onClick={rebuild}>{busy ? 'Rebuilding…' : 'Rebuild from calls'}</button>
            {onRewrite && <button type="button" className="btn gold" disabled={rewriteBusy} onClick={onRewrite}>{rewriteBusy ? 'Rewriting…' : 'Rewrite emails in this voice'}</button>}
          </div>
        </>
      )}
      {err && <p className="mt-err">{err}</p>}
    </div>
  );
}
