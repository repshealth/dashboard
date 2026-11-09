'use client';

import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import { money } from '@/lib/stripe/types';
import { leadForms } from '../leads/SourceTag';
import { FUNNEL_KINDS, FUNNEL_KIND_NAME, funnelState, type Funnel, type FunnelInput, type FunnelStats } from '@/lib/funnels/types';
import { trackingSnippet } from '@/lib/funnels/snippet';

type Range = '7' | '30' | 'campaign' | 'all';
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (d?: string) => (d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}` : '');
const pct = (x: number | null | undefined, dp = 1) => (x == null || !isFinite(x) ? '–' : `${(x * 100).toFixed(dp)}%`);
const host = (u: string) => { try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, ''); } catch { return u; } };
const STATE: Record<string, { label: string; cls: string }> = {
  live: { label: 'Live', cls: 'st-approved' }, draft: { label: 'Draft', cls: 'st-build' }, ended: { label: 'Ended', cls: 'st-review' },
};

function rangeDates(r: Range, f: Funnel): [string, string] {
  if (r === '7') return [daysAgo(6), today()];
  if (r === '30') return [daysAgo(29), today()];
  if (r === 'campaign') return [f.startsOn ?? f.createdAt.slice(0, 10), f.endsOn && f.endsOn < today() ? f.endsOn : today()];
  return [f.createdAt.slice(0, 10) < (f.startsOn ?? '9999') ? f.createdAt.slice(0, 10) : f.startsOn!, today()];
}

/**
 * Funnels: single campaign pages (an app launch, a challenge, a waitlist) that sit apart from
 * the main website, each with its own visitors, sign-ups, calls booked and purchases.
 */
export default function FunnelsView() {
  const { client, viewer, toast } = useData();
  const admin = Boolean(viewer?.isAdmin);
  const [funnels, setFunnels] = useState<Funnel[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<FunnelInput | null>(null);
  const [code, setCode] = useState<Funnel | null>(null);

  const load = useCallback(async () => {
    if (!client) return;
    setFunnels(await backend.listFunnels(client.id).catch(() => []));
  }, [client]);
  useEffect(() => { setFunnels(null); setSel(null); load(); }, [load]);

  if (!client) return <div className="loading">Loading…</div>;
  const open = funnels?.find((f) => f.id === sel) ?? null;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Funnels</h1>
          <p className="sub">Single pages for campaigns, like app launches, challenges and waitlists. Separate from {client.name}&apos;s main website, each with its own views and conversions.</p>
        </div>
        {admin && (
          <div className="actions">
            <button type="button" className="btn gold" onClick={() => setForm({ name: '', kind: 'launch', url: '', forms: [], status: 'live', startsOn: today() })}>+ Add funnel</button>
          </div>
        )}
      </header>

      {funnels === null ? <div className="loading">Loading funnels…</div> : open ? (
        <FunnelDetail f={open} admin={admin} onBack={() => setSel(null)} onEdit={() => setForm({ ...open })} onCode={() => setCode(open)}
          onDelete={async () => {
            if (!window.confirm(`Delete the ${open.name} funnel? Its stats are removed from the dashboard. The page itself stays live.`)) return;
            try { await backend.removeFunnel(open.id); setSel(null); await load(); toast('Funnel deleted.'); } catch (e) { toast(e instanceof Error ? e.message : 'Could not delete it.'); }
          }} />
      ) : !funnels.length ? (
        <div className="sv-empty">
          <span className="stbadge st-build">No funnels yet</span>
          <div className="sv-et">Campaign pages will show here</div>
          <p>{admin ? 'Add a funnel for each campaign page, like an app launch or a challenge, then put its tracking code on the page to see visitors and sign-ups.' : 'When the REPS team sets up a campaign page for you, its visitors and sign-ups show here.'}</p>
        </div>
      ) : (
        <div className="fn-grid">
          {funnels.map((f) => <FunnelCard key={f.id} f={f} onOpen={() => setSel(f.id)} />)}
        </div>
      )}

      {form && <FunnelForm init={form} onClose={() => setForm(null)} onSaved={async (f, isNew) => {
        setForm(null); await load(); setSel(f.id);
        if (isNew) setCode(f);
        toast(isNew ? 'Funnel added. Put the tracking code on the page to start counting views.' : 'Funnel saved.');
      }} />}
      {code && <TrackingCode f={code} onClose={() => setCode(null)} />}
    </div>
  );
}

/** A funnel in the list: what it is, whether it's live, and its last 30 days at a glance. */
function FunnelCard({ f, onOpen }: { f: Funnel; onOpen: () => void }) {
  const [s, setS] = useState<FunnelStats | null>(null);
  useEffect(() => { backend.getFunnelStats(f.id, daysAgo(29), today()).then(setS).catch(() => {}); }, [f.id]);
  const st = STATE[funnelState(f)];
  return (
    <button type="button" className="fn-card" onClick={onOpen}>
      <div className="fn-card-h">
        <span className="fn-tag">Funnel page · {FUNNEL_KIND_NAME[f.kind]}</span>
        <span className={`stbadge sm ${st.cls}`}>{st.label}</span>
      </div>
      <div className="fn-card-name">{f.name}</div>
      <div className="fn-card-url">{f.url ? host(f.url) : 'No page address yet'}</div>
      {(f.startsOn || f.endsOn) && <div className="fn-card-dates">{fmtDay(f.startsOn) || 'Now'} to {fmtDay(f.endsOn) || 'ongoing'}</div>}
      <div className="fn-card-stats" aria-label="Last 30 days">
        <span><b>{s ? s.visitors.toLocaleString('en-GB') : '…'}</b>visitors</span>
        <span><b>{s ? s.signups.toLocaleString('en-GB') : '…'}</b>sign-ups</span>
        <span><b>{s ? pct(s.conversion) : '…'}</b>conversion</span>
      </div>
      <div className="fn-card-foot">{f.lastViewAt ? `Last view ${fmtWhen(f.lastViewAt)}` : 'Waiting for the first view'} · last 30 days</div>
    </button>
  );
}

function FunnelDetail({ f, admin, onBack, onEdit, onCode, onDelete }: { f: Funnel; admin: boolean; onBack: () => void; onEdit: () => void; onCode: () => void; onDelete: () => void }) {
  const [range, setRange] = useState<Range>(f.startsOn ? 'campaign' : '30');
  const [s, setS] = useState<FunnelStats | null>(null);
  const [err, setErr] = useState('');
  const [table, setTable] = useState(false);
  const [from, to] = rangeDates(range, f);
  useEffect(() => {
    setS(null); setErr('');
    backend.getFunnelStats(f.id, from, to).then(setS).catch((e) => setErr(e instanceof Error ? e.message : 'Could not load the stats.'));
  }, [f.id, from, to]);
  const st = STATE[funnelState(f)];

  return (
    <div className="fn-detail">
      <button type="button" className="ob-link" onClick={onBack}>← All funnels</button>
      <div className="ap-head fn-head">
        <div>
          <div className="ap-eyebrow"><span className="fn-tag">Funnel page · {FUNNEL_KIND_NAME[f.kind]}</span> <span className={`stbadge sm ${st.cls}`}>{st.label}</span></div>
          <h2>{f.name}</h2>
          <p className="sub">
            {f.url ? <a href={f.url} target="_blank" rel="noreferrer">{host(f.url)}</a> : 'No page address yet'}
            {(f.startsOn || f.endsOn) && <> · {fmtDay(f.startsOn) || 'Now'} to {fmtDay(f.endsOn) || 'ongoing'}</>}
            {f.forms.length > 0 && <> · counts sign-ups from {f.forms.join(', ')}</>}
          </p>
        </div>
        <div className="actions">
          {f.url && <a className="btn" href={f.url} target="_blank" rel="noreferrer">Open page</a>}
          {admin && <button type="button" className="btn" onClick={onCode}>Tracking code</button>}
          {admin && <button type="button" className="btn" onClick={onEdit}>Edit</button>}
          {admin && <button type="button" className="ob-link fn-del" onClick={onDelete}>Delete</button>}
        </div>
      </div>

      {admin && (
        !f.lastViewAt ? (
          <div className="fn-warn">No views have come in yet. Put the <button type="button" className="ob-link" onClick={onCode}>tracking code</button> on the page so visitors are counted.</div>
        ) : null
      )}
      {!f.forms.length && admin && <div className="fn-warn">No forms are linked, so sign-ups can&apos;t be counted. <button type="button" className="ob-link" onClick={onEdit}>Choose the page&apos;s form</button>.</div>}

      <div className="tk-bar">
        <div className="seg" role="tablist" aria-label="Date range">
          {([['7', '7 days'], ['30', '30 days'], ...(f.startsOn ? [['campaign', 'Campaign']] : []), ['all', 'All time']] as [Range, string][]).map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={range === k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>
          ))}
        </div>
        <span className="fn-range">{fmtDay(from)} to {fmtDay(to)}{f.lastViewAt ? ` · last view ${fmtWhen(f.lastViewAt)}` : ''}</span>
      </div>

      {err ? <div className="form-msg err">{err}</div> : !s ? <div className="loading">Loading stats…</div> : (
        <>
          <div className="kpis">
            <div className="kpi"><div className="l">VISITORS</div><div className="v">{s.visitors.toLocaleString('en-GB')}</div><div className="fn-k-s">{s.views.toLocaleString('en-GB')} page views</div></div>
            <div className="kpi"><div className="l">SIGN-UPS</div><div className="v">{s.signups.toLocaleString('en-GB')}</div></div>
            <div className="kpi"><div className="l">CONVERSION</div><div className="v">{pct(s.conversion)}</div><div className="fn-k-s">visitors who signed up</div></div>
            <div className="kpi"><div className="l">CALLS BOOKED</div><div className="v">{s.booked}</div></div>
            <div className="kpi"><div className="l">PURCHASES</div><div className="v">{s.purchased}</div></div>
            <div className="kpi"><div className="l">REVENUE</div><div className="v">{money(s.revenue)}</div><div className="fn-k-s">from sign-ups who bought</div></div>
          </div>

          <div className="fn-cols">
            <section className="fn-panel" aria-label="Funnel steps">
              <div className="fn-ph">Funnel</div>
              <Steps s={s} />
            </section>
            <section className="fn-panel" aria-label="Where visitors came from">
              <div className="fn-ph">Where visitors came from</div>
              {!s.sources.length ? <p className="cm-none">No visitors in this range yet.</p> : (
                <div className="fn-src">
                  {s.sources.map((x) => (
                    <div key={x.name} className="fn-src-row" title={`${x.name}: ${x.visitors} visitor${x.visitors === 1 ? '' : 's'}`}>
                      <span className="fn-src-n">{x.name}</span>
                      <span className="fn-src-bar"><i style={{ width: `${Math.max(4, (x.visitors / s.sources[0].visitors) * 100)}%` }} /></span>
                      <span className="fn-src-v">{x.visitors}</span>
                    </div>
                  ))}
                  {s.mobileShare != null && <p className="fn-note">{pct(s.mobileShare, 0)} of visitors were on a phone.</p>}
                </div>
              )}
            </section>
          </div>

          <section className="fn-panel" aria-label="Visitors by day">
            <div className="fn-ph">
              Visitors by day
              <button type="button" className="ob-link" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show as table'}</button>
            </div>
            {table ? <DayTable s={s} /> : <DayChart s={s} />}
          </section>

          <section className="fn-panel" aria-label="Latest sign-ups">
            <div className="fn-ph">Latest sign-ups</div>
            {!s.recent.length ? <p className="cm-none">{f.forms.length ? 'No sign-ups in this range yet.' : 'Link the page’s form to count sign-ups.'}</p> : (
              <ul className="fn-recent">
                {s.recent.map((r) => <li key={r.id}><b>{r.name}</b><span>{fmtWhen(r.at)}</span><span className="fn-stage">{r.stage === 'call' ? 'Call booked' : r.stage === 'purchased' ? 'Purchased' : r.stage === 'showed' ? 'Showed' : r.stage === 'lost' ? 'Lost' : 'Signed up'}</span></li>)}
              </ul>
            )}
          </section>
        </>
      )}

      {f.url && (
        <section className="fn-panel" aria-label="The page">
          <div className="fn-ph">The page <a className="ob-link" href={f.url} target="_blank" rel="noreferrer">Open in a new tab</a></div>
          <div className="fn-frame"><iframe title={`${f.name} page`} src={f.url} loading="lazy" sandbox="allow-scripts allow-same-origin allow-popups" /></div>
        </section>
      )}
      {f.notes && <p className="ap-hint">Notes: {f.notes}</p>}
    </div>
  );
}

/** Visitors → sign-ups → calls booked → purchased, each with its rate from the step before. */
function Steps({ s }: { s: FunnelStats }) {
  const steps = [['Visitors', s.visitors], ['Signed up', s.signups], ['Booked a call', s.booked], ['Purchased', s.purchased]] as const;
  const top = Math.max(1, s.visitors, s.signups);
  return (
    <div className="fn-steps">
      {steps.map(([label, n], i) => {
        const prev = i ? steps[i - 1][1] : null;
        return (
          <div key={label} className="fn-step" title={`${label}: ${n}${prev != null ? ` (${pct(prev ? n / prev : null)} of the step before)` : ''}`}>
            <div className="fn-step-h"><span>{label}</span><b>{n.toLocaleString('en-GB')}</b>{prev != null && <em>{pct(prev ? n / prev : null)}</em>}</div>
            <div className="fn-step-bar"><i style={{ width: `${n ? Math.max(1.5, (n / top) * 100) : 0}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

/** One bar per day for unique visitors, with sign-ups in the hover card. */
function DayChart({ s }: { s: FunnelStats }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...s.days.map((d) => d.visitors));
  const H = 150;
  const ticks = useMemo(() => { const t = Math.ceil(max / 4) || 1; return [0, t, t * 2, t * 3, t * 4].filter((x) => x <= max + t); }, [max]);
  const top = ticks[ticks.length - 1] || 1;
  const n = s.days.length;
  const label = (i: number) => n <= 10 || i === 0 || i === n - 1 || i % Math.ceil(n / 7) === 0;
  const d = hover != null ? s.days[hover] : null;
  return (
    <div className="fn-chart" onMouseLeave={() => setHover(null)}>
      <div className="fn-axis" aria-hidden="true">{[...ticks].reverse().map((t) => <span key={t}>{t}</span>)}</div>
      <div className="fn-plot" style={{ height: H }}>
        {ticks.map((t) => <div key={t} className="fn-grid-l" style={{ bottom: `${(t / top) * 100}%` }} />)}
        <div className="fn-bars" role="img" aria-label={`Visitors per day from ${fmtDay(s.from)} to ${fmtDay(s.to)}`}>
          {s.days.map((x, i) => (
            <div key={x.date} className={`fn-col${hover === i ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
              aria-label={`${fmtDay(x.date)}: ${x.visitors} visitors, ${x.signups} sign-ups`}>
              <i style={{ height: `${(x.visitors / top) * 100}%` }} />
            </div>
          ))}
        </div>
        {d && hover != null && (
          <div className="fn-tip" style={{ left: `${((hover + 0.5) / n) * 100}%` }}>
            <b>{fmtDay(d.date)}</b>
            <span>{d.visitors} visitor{d.visitors === 1 ? '' : 's'} · {d.views} view{d.views === 1 ? '' : 's'}</span>
            <span>{d.signups} sign-up{d.signups === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>
      <div className="fn-xl" aria-hidden="true">{s.days.map((x, i) => <span key={x.date}>{label(i) ? fmtDay(x.date) : ''}</span>)}</div>
    </div>
  );
}

function DayTable({ s }: { s: FunnelStats }) {
  return (
    <div className="list fn-table">
      <table>
        <thead><tr><th>DAY</th><th className="num">VISITORS</th><th className="num">VIEWS</th><th className="num">SIGN-UPS</th><th className="num">CONVERSION</th></tr></thead>
        <tbody>
          {[...s.days].reverse().map((d) => (
            <tr key={d.date} className="row"><td>{fmtDay(d.date)}</td><td className="num">{d.visitors}</td><td className="num">{d.views}</td><td className="num">{d.signups}</td><td className="num">{pct(d.visitors ? d.signups / d.visitors : null)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Add or edit a funnel (REPS only). */
function FunnelForm({ init, onClose, onSaved }: { init: FunnelInput; onClose: () => void; onSaved: (f: Funnel, isNew: boolean) => void }) {
  const { client, leads, site } = useData();
  const [x, setX] = useState<FunnelInput>(init);
  const [formText, setFormText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  // Forms the dashboard has seen for this client, so the right one can be ticked.
  const known = useMemo(() => {
    const names = new Set<string>();
    for (const l of leads ?? []) for (const n of leadForms(l)) names.add(n);
    for (const n of site?.forms ?? []) names.add(n.name);
    return [...names].filter(Boolean).sort();
  }, [leads, site]);
  const toggle = (n: string) => setX({ ...x, forms: x.forms.includes(n) ? x.forms.filter((y) => y !== n) : [...x.forms, n] });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!client) return;
    setBusy(true); setErr('');
    try {
      const forms = formText.trim() && !x.forms.includes(formText.trim()) ? [...x.forms, formText.trim()] : x.forms;
      const f = await backend.saveFunnel(client.id, { ...x, forms });
      onSaved(f, !init.id);
    } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not save it.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal mt-add tk-form" role="dialog" aria-modal="true" aria-labelledby="fn-form-t" onSubmit={save}>
        <div id="fn-form-t" className="m-t">{init.id ? 'Edit funnel' : 'Add a funnel'}</div>
        <div className="mt-add-row">
          <label className="ae-f"><span>Name</span><input className="ob-input" required placeholder="e.g. 30 Day Bring It Home Challenge" value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} /></label>
          <label className="ae-f"><span>Type</span>
            <select className="ob-input" value={x.kind} onChange={(e) => setX({ ...x, kind: e.target.value as FunnelInput['kind'] })}>
              {FUNNEL_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
            </select>
          </label>
        </div>
        <label className="ae-f"><span>Page address</span><input className="ob-input" placeholder="https://www.example.com/challenge" value={x.url} onChange={(e) => setX({ ...x, url: e.target.value })} /></label>
        <div className="ae-f"><span>Form that counts as a sign-up</span>
          {known.length > 0 && (
            <div className="lg-pick">
              {known.map((n) => (
                <label key={n} className={`lg-opt${x.forms.includes(n) ? ' on' : ''}`}><input type="checkbox" checked={x.forms.includes(n)} onChange={() => toggle(n)} />{n}</label>
              ))}
              {x.forms.filter((n) => !known.includes(n)).map((n) => (
                <label key={n} className="lg-opt on"><input type="checkbox" checked onChange={() => toggle(n)} />{n}</label>
              ))}
            </div>
          )}
          <input className="ob-input" placeholder={known.length ? 'Or type a form name that hasn’t had a sign-up yet' : 'The form’s name, e.g. Bring It Home waitlist'} value={formText} onChange={(e) => setFormText(e.target.value)} />
          <span className="ap-hint">Sign-ups from these forms count for this funnel. Calls booked and purchases are counted from those same people.</span>
        </div>
        <div className="mt-add-row">
          <label className="ae-f"><span>Campaign starts</span><input className="ob-input" type="date" value={x.startsOn ?? ''} onChange={(e) => setX({ ...x, startsOn: e.target.value })} /></label>
          <label className="ae-f"><span>Campaign ends (optional)</span><input className="ob-input" type="date" min={x.startsOn || undefined} value={x.endsOn ?? ''} onChange={(e) => setX({ ...x, endsOn: e.target.value })} /></label>
        </div>
        <div className="ae-f"><span>Status</span>
          <div className="seg fn-seg" role="radiogroup" aria-label="Status">
            {(['draft', 'live', 'ended'] as const).map((k) => <button key={k} type="button" role="radio" aria-checked={x.status === k} className={x.status === k ? 'on' : ''} onClick={() => setX({ ...x, status: k })}>{STATE[k].label}</button>)}
          </div>
          <span className="ap-hint">Views aren&apos;t counted while a funnel is a draft.</span>
        </div>
        <label className="ae-f"><span>Notes (optional)</span><textarea className="ob-input" rows={2} value={x.notes ?? ''} onChange={(e) => setX({ ...x, notes: e.target.value })} /></label>
        {err && <div className="form-msg err" role="alert">{err}</div>}
        <div className="cp-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn gold" disabled={busy}>{busy ? 'Saving…' : init.id ? 'Save' : 'Add funnel'}</button>
        </div>
      </form>
    </div>
  );
}

/** The tracking snippet to paste into the funnel page (REPS only). */
function TrackingCode({ f, onClose }: { f: Funnel; onClose: () => void }) {
  const { toast } = useData();
  const [base, setBase] = useState(typeof window !== 'undefined' && window.location.protocol.startsWith('http') ? window.location.origin : 'https://YOUR-DASHBOARD');
  useEffect(() => { backend.getAppUrl().then((u) => { if (u) setBase(u); }).catch(() => {}); }, []);
  const snippet = trackingSnippet(base, f.id);
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="fn-code-t">
        <div id="fn-code-t" className="m-t">Tracking code for {f.name}</div>
        <p className="sub">Paste this into the page&apos;s HTML, just before <code>&lt;/head&gt;</code>, then commit it. It counts each visit without slowing the page down or using cookies.</p>
        <textarea className="ob-input lg-details sp-mono" readOnly rows={6} value={snippet} onFocus={(e) => e.target.select()} />
        <p className="ap-hint">Sign-ups are counted from the page&apos;s form{f.forms.length ? ` (${f.forms.join(', ')})` : ''}, which already sends leads to the dashboard. {f.lastViewAt ? `Working: last view ${fmtWhen(f.lastViewAt)}.` : 'Once it’s on the page, the first view shows here within a minute.'}</p>
        <div className="cp-a">
          <button type="button" className="btn" onClick={onClose}>Done</button>
          <button type="button" className="btn gold" onClick={async () => { try { await navigator.clipboard.writeText(snippet); toast('Tracking code copied.'); } catch { toast('Select the code and copy it.'); } }}>Copy code</button>
        </div>
      </div>
    </div>
  );
}
