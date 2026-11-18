'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import { money } from '@/lib/stripe/types';
import { readAdsExport, type AdImport } from '@/lib/ads/csv';
import { AD_STATUS, type AdCampaignInput, type AdCampaignReport, type AdMetrics, type AdsReport, type AdStatus } from '@/lib/ads/types';
import type { Funnel } from '@/lib/funnels/types';

type Range = '7' | '30' | '90' | 'all';
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDay = (d?: string) => (d ? `${+d.slice(8, 10)} ${MON[+d.slice(5, 7) - 1]}` : '');
const int = (n: number) => Math.round(n).toLocaleString('en-GB');
const pct = (x: number | null, dp = 2) => (x == null || !isFinite(x) ? '–' : `${(x * 100).toFixed(dp)}%`);
const ST_CLS: Record<AdStatus, string> = { active: 'st-approved', paused: 'st-review', ended: 'st-build', draft: 'st-build' };

/**
 * Meta ads for one client: spend and delivery from Meta, next to the leads, calls and sales
 * those ads brought into the dashboard. Filled from an Ads Manager export until Meta is connected.
 */
export default function AdsView() {
  const { client, viewer, toast } = useData();
  const admin = Boolean(viewer?.isAdmin);
  const [range, setRange] = useState<Range>('30');
  const [r, setR] = useState<AdsReport | null>(null);
  const [err, setErr] = useState('');
  const [importing, setImporting] = useState(false);
  const [edit, setEdit] = useState<AdCampaignInput | null>(null);
  const [funnels, setFunnels] = useState<Funnel[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [table, setTable] = useState(false);
  const cur = r?.account.currency.toLowerCase() ?? 'gbp';
  const $ = (n: number | null | undefined) => (n == null || !isFinite(n) ? '–' : money(n, cur));

  const load = useCallback(async () => {
    if (!client) return;
    setErr('');
    const from = range === 'all' ? 'all' : daysAgo(Number(range) - 1);
    try { setR(await backend.getMetaAds(client.id, from, today())); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not load the ads.'); }
  }, [client, range]);
  useEffect(() => { load(); }, [load]);
  // Linked to Meta: freshen the numbers in the background when they're over 3 hours old.
  const synced = useRef<string | null>(null);
  useEffect(() => {
    const a = r?.account;
    if (!client || !a?.connected || synced.current === client.id) return;
    if (a.lastSyncAt && Date.now() - Date.parse(a.lastSyncAt) < 3 * 3600e3) return;
    synced.current = client.id;
    backend.syncMetaAds(client.id).then((x) => { if (!x.skipped) load(); }).catch(() => load());
  }, [r, client, load]);
  useEffect(() => { setR(null); setOpen(null); if (client) backend.listFunnels(client.id).then(setFunnels).catch(() => setFunnels([])); }, [client]);

  if (!client) return <div className="loading">Loading…</div>;
  const empty = r && !r.hasData && !r.campaigns.length;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Meta ads</h1>
          <p className="sub">How {client.name}&apos;s Facebook and Instagram ads are doing: what was spent, and the leads, calls and sales it turned into.</p>
        </div>
        {admin && (
          <div className="actions">
            <button type="button" className="btn" onClick={() => setEdit({ name: '', status: 'active' })}>+ Add campaign</button>
            <button type="button" className="btn gold" onClick={() => setImporting(true)}>Import from Ads Manager</button>
          </div>
        )}
      </header>

      {r && <Connection r={r} admin={admin} onSaved={load} />}

      {err ? <div className="form-msg err">{err}</div> : !r ? <div className="loading">Loading ads…</div> : empty ? (
        <div className="sv-empty">
          <span className="stbadge st-build">No ad results yet</span>
          <div className="sv-et">Ad results will show here</div>
          <p>{admin ? 'Import a report from Ads Manager to see spend, cost per lead and return on ad spend. Once Meta is connected, this fills in by itself.' : 'When your ads are running, the REPS team adds the results here.'}</p>
          {admin && <button type="button" className="btn gold" onClick={() => setImporting(true)}>Import from Ads Manager</button>}
        </div>
      ) : (
        <>
          <div className="tk-bar">
            <div className="seg" role="tablist" aria-label="Date range">
              {([['7', '7 days'], ['30', '30 days'], ['90', '90 days'], ['all', 'All time']] as [Range, string][]).map(([k, l]) => (
                <button key={k} type="button" role="tab" aria-selected={range === k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l}</button>
              ))}
            </div>
            <span className="fn-range">{fmtDay(r.from)} to {fmtDay(r.to)}</span>
          </div>

          <div className="kpis">
            <div className="kpi"><div className="l">AMOUNT SPENT</div><div className="v">{$(r.totals.spend)}</div></div>
            <div className="kpi"><div className="l">LEADS</div><div className="v">{int(r.out.leads)}</div><div className="fn-k-s">{r.totals.metaLeads ? `${int(r.totals.metaLeads)} reported by Meta` : 'in the dashboard'}</div></div>
            <div className="kpi"><div className="l">COST PER LEAD</div><div className="v">{$(r.out.cpl)}</div></div>
            <div className="kpi"><div className="l">CALLS BOOKED</div><div className="v">{int(r.out.booked)}</div><div className="fn-k-s">{r.out.costPerCall != null ? `${$(r.out.costPerCall)} per call` : ' '}</div></div>
            <div className="kpi"><div className="l">SALES</div><div className="v">{$(r.out.revenue)}</div><div className="fn-k-s">{int(r.out.bought)} purchase{r.out.bought === 1 ? '' : 's'}</div></div>
            <div className="kpi"><div className="l">RETURN ON AD SPEND</div><div className="v">{r.out.roas == null ? '–' : `${r.out.roas.toFixed(2)}x`}</div><div className="fn-k-s">sales ÷ spend</div></div>
          </div>
          <Delivery m={r.totals} cur={cur} />

          <section className="fn-panel" aria-label="Spend by day">
            <div className="fn-ph">Spend by day<button type="button" className="ob-link" onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show as table'}</button></div>
            {table ? <DayTable r={r} money={$} /> : <SpendChart r={r} money={$} />}
          </section>

          <section className="fn-panel" aria-label="Campaigns">
            <div className="fn-ph">Campaigns<span className="ad-ph-n">{r.campaigns.length}</span></div>
            <div className="ad-scroll">
              <table className="ad-table">
                <thead><tr>
                  <th>CAMPAIGN</th><th className="num">SPENT</th><th className="num">IMPR.</th><th className="num">CTR</th><th className="num">CPC</th>
                  <th className="num" title="Meta's own count for the campaign's goal">META RESULTS</th><th className="num" title="Leads in the dashboard whose utm_campaign matches">LEADS</th><th className="num">CPL</th><th className="num">CALLS</th><th className="num">SALES</th><th className="num">ROAS</th>
                </tr></thead>
                <tbody>
                  {r.campaigns.map((c) => (
                    <CampaignRows key={c.name} c={c} open={open === c.name} onToggle={() => setOpen(open === c.name ? null : c.name)} money={$} admin={admin}
                      onEdit={() => setEdit(c.settings ? { id: c.settings.id, name: c.settings.name, status: c.settings.status, funnelId: c.settings.funnelId, utm: c.settings.utm, dailyBudget: c.settings.dailyBudget, notes: c.settings.notes } : { name: c.name, status: c.status })} />
                  ))}
                </tbody>
              </table>
            </div>
            <p className="ap-hint">Leads are matched by the <code>utm_campaign</code> on the ad&apos;s link. In Ads Manager, set URL parameters to <code>utm_source=facebook&amp;utm_campaign={'{{campaign.name}}'}</code> so every lead is matched to its campaign.</p>
          </section>

          {r.recentLeads.length > 0 && (
            <section className="fn-panel" aria-label="Latest leads from ads">
              <div className="fn-ph">Latest leads from ads</div>
              <ul className="fn-recent">
                {r.recentLeads.map((l) => <li key={l.id}><b>{l.name}</b><span>{l.campaign} · {fmtWhen(l.at)}</span><span className="fn-stage">{l.stage === 'call' ? 'Call booked' : l.stage === 'purchased' ? 'Purchased' : l.stage === 'showed' ? 'Showed' : l.stage === 'lost' ? 'Lost' : 'New lead'}</span></li>)}
              </ul>
            </section>
          )}
        </>
      )}

      {importing && client && <ImportAds clientId={client.id} onClose={() => setImporting(false)} onDone={async (msg) => { setImporting(false); toast(msg); await load(); }} />}
      {edit && client && (
        <CampaignForm init={edit} funnels={funnels} clientId={client.id} onClose={() => setEdit(null)}
          onSaved={async () => { setEdit(null); toast('Campaign saved.'); await load(); }} />
      )}
    </div>
  );
}

/** Whether Meta is connected, and when the numbers were last brought in. */
function Connection({ r, admin, onSaved }: { r: AdsReport; admin: boolean; onSaved: () => void }) {
  const { client, toast } = useData();
  const [editing, setEditing] = useState(false);
  const [id, setId] = useState(r.account.adAccountId ?? '');
  const [syncing, setSyncing] = useState(false);
  const a = r.account;
  if (a.connected) {
    return (
      <div className="ad-conn">
        <span className="ad-conn-dot on" aria-hidden="true" />
        <div className="ad-conn-t">
          <b>Connected to Meta{a.accountName ? ` · ${a.accountName}` : ''}</b>
          <span>
            {a.lastSyncError ? `The last sync failed: ${a.lastSyncError}` : a.lastSyncAt ? `Results updated ${fmtWhen(a.lastSyncAt)}.` : 'Pulling in results…'}
            {' '}Pausing ads and changing budgets from here is coming next.
          </span>
        </div>
        <span className="ad-conn-a">
          <button type="button" className="ob-link" disabled={syncing} onClick={async () => {
            if (!client) return;
            setSyncing(true);
            try { const x = await backend.syncMetaAds(client.id); toast(x.skipped ? 'Already up to date.' : 'Results updated from Meta.'); onSaved(); }
            catch (e) { toast(e instanceof Error ? e.message : 'Could not reach Meta.'); onSaved(); }
            finally { setSyncing(false); }
          }}>{syncing ? 'Syncing…' : 'Sync now'}</button>
          {admin && <Link className="ob-link" href="/agency/meta">Meta connection</Link>}
        </span>
      </div>
    );
  }
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!client) return;
    try { await backend.saveMetaAccount(client.id, { adAccountId: id }); setEditing(false); toast('Ad account saved.'); onSaved(); } catch (x) { toast(x instanceof Error ? x.message : 'Could not save it.'); }
  };
  return (
    <div className="ad-conn">
      <span className="ad-conn-dot" aria-hidden="true" />
      <div className="ad-conn-t">
        <b>Not connected to Meta yet</b>
        <span>
          {a.lastImportAt ? `Numbers come from Ads Manager exports. The last one${a.lastImportRange ? ` covered ${fmtDay(a.lastImportRange[0])} to ${fmtDay(a.lastImportRange[1])} and` : ''} was imported ${fmtWhen(a.lastImportAt)}.` : 'No numbers imported yet.'}
          {a.adAccountId ? ` Ad account ${a.adAccountId}.` : ''}
          {' '}{admin ? 'Link this client on the Meta connection page to pull results in automatically.' : 'Live numbers come once the REPS team links your ad account.'}
        </span>
      </div>
      {admin && !editing && (
        <span className="ad-conn-a">
          <Link className="ob-link" href="/agency/meta">Link to Meta</Link>
          {a.lastImportAt && <button type="button" className="ob-link fn-del" onClick={async () => {
            if (!client || !window.confirm('Delete all imported ad results for this client? Campaign settings stay.')) return;
            try { await backend.clearMetaAds(client.id); toast('Imported results deleted.'); onSaved(); } catch (x) { toast(x instanceof Error ? x.message : 'Could not delete them.'); }
          }}>Delete imported results</button>}
        </span>
      )}
      {admin && editing && (
        <form className="ad-conn-f" onSubmit={save}>
          <input className="ob-input" placeholder="Ad account ID, e.g. 123456789012345" value={id} onChange={(e) => setId(e.target.value)} aria-label="Meta ad account ID" />
          <button type="submit" className="btn">Save</button>
          <button type="button" className="ob-link" onClick={() => setEditing(false)}>Cancel</button>
        </form>
      )}
    </div>
  );
}

function Delivery({ m, cur }: { m: AdMetrics; cur: string }) {
  const items: [string, string, string?][] = [
    ['Impressions', int(m.impressions)],
    ['Reach', int(m.reach), 'Added up across days and ads, so the same person can be counted more than once'],
    ['Link clicks', int(m.clicks)],
    ['CTR', pct(m.ctr), 'Link clicks ÷ impressions'],
    ['CPC', m.cpc == null ? '–' : money(m.cpc, cur), 'Cost per link click'],
    ['CPM', m.cpm == null ? '–' : money(m.cpm, cur), 'Cost per 1,000 impressions'],
  ];
  return (
    <div className="ad-deliv">
      {items.map(([l, v, t]) => <div key={l} title={t}><span>{l}</span><b>{v}</b></div>)}
    </div>
  );
}

function SpendChart({ r, money: $ }: { r: AdsReport; money: (n: number | null) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...r.days.map((d) => d.spend));
  const step = useMemo(() => { const raw = max / 4; const p = 10 ** Math.floor(Math.log10(raw)); return Math.ceil(raw / p) * p; }, [max]);
  const top = step * 4;
  const n = r.days.length;
  const label = (i: number) => n <= 10 || i === 0 || i === n - 1 || i % Math.ceil(n / 7) === 0;
  const d = hover != null ? r.days[hover] : null;
  return (
    <div className="fn-chart" onMouseLeave={() => setHover(null)}>
      <div className="fn-axis" aria-hidden="true">{[4, 3, 2, 1, 0].map((k) => <span key={k}>{$(step * k).replace(/\.00$/, '')}</span>)}</div>
      <div className="fn-plot" style={{ height: 150 }}>
        {[0, 1, 2, 3, 4].map((k) => <div key={k} className="fn-grid-l" style={{ bottom: `${k * 25}%` }} />)}
        <div className="fn-bars" role="img" aria-label={`Ad spend per day from ${fmtDay(r.from)} to ${fmtDay(r.to)}`}>
          {r.days.map((x, i) => (
            <div key={x.date} className={`fn-col${hover === i ? ' on' : ''}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0}
              aria-label={`${fmtDay(x.date)}: ${$(x.spend)} spent, ${x.leads} leads`}>
              <i style={{ height: `${(x.spend / top) * 100}%` }} />
            </div>
          ))}
        </div>
        {d && hover != null && (
          <div className="fn-tip" style={{ left: `${Math.min(88, Math.max(12, ((hover + 0.5) / n) * 100))}%` }}>
            <b>{fmtDay(d.date)}</b>
            <span>{$(d.spend)} spent · {int(d.clicks)} clicks</span>
            <span>{d.leads} lead{d.leads === 1 ? '' : 's'}</span>
          </div>
        )}
      </div>
      <div className="fn-xl" aria-hidden="true">{r.days.map((x, i) => <span key={x.date}>{label(i) ? fmtDay(x.date) : ''}</span>)}</div>
    </div>
  );
}

function DayTable({ r, money: $ }: { r: AdsReport; money: (n: number | null) => string }) {
  return (
    <div className="ad-scroll">
      <table className="ad-table">
        <thead><tr><th>DAY</th><th className="num">SPENT</th><th className="num">LINK CLICKS</th><th className="num">LEADS</th><th className="num">COST PER LEAD</th></tr></thead>
        <tbody>{[...r.days].reverse().map((d) => <tr key={d.date}><td>{fmtDay(d.date)}</td><td className="num">{$(d.spend)}</td><td className="num">{int(d.clicks)}</td><td className="num">{d.leads}</td><td className="num">{d.leads ? $(d.spend / d.leads) : '–'}</td></tr>)}</tbody>
      </table>
    </div>
  );
}

function CampaignRows({ c, open, onToggle, money: $, admin, onEdit }: { c: AdCampaignReport; open: boolean; onToggle: () => void; money: (n: number | null) => string; admin: boolean; onEdit: () => void }) {
  const m = c.m;
  return (
    <>
      <tr className={`ad-row${open ? ' on' : ''}`} onClick={onToggle}>
        <td>
          <div className="ad-name">
            <button type="button" className="ad-caret" aria-expanded={open} aria-label={`${open ? 'Hide' : 'Show'} ad sets for ${c.name}`} onClick={(e) => { e.stopPropagation(); onToggle(); }}>{open ? '▾' : '▸'}</button>
            <span className="ad-name-t">{c.name}</span>
          </div>
          <div className="ad-sub">
            <span className={`stbadge sm ${ST_CLS[c.status]}`}>{AD_STATUS[c.status]}</span>
            {c.funnelName && <span className="fn-tag">Funnel · {c.funnelName}</span>}
            {c.settings?.dailyBudget ? <span>{$(c.settings.dailyBudget)}/day</span> : null}
          </div>
        </td>
        <td className="num"><b>{$(m.spend)}</b></td>
        <td className="num">{int(m.impressions)}</td>
        <td className="num">{pct(m.ctr)}</td>
        <td className="num">{$(m.cpc)}</td>
        <td className="num">{m.results ? int(m.results) : '–'}</td>
        <td className="num"><b>{c.out.leads}</b></td>
        <td className="num">{$(c.out.cpl)}</td>
        <td className="num">{c.out.booked}</td>
        <td className="num">{c.out.revenue ? $(c.out.revenue) : '–'}</td>
        <td className="num">{c.out.roas == null ? '–' : `${c.out.roas.toFixed(2)}x`}</td>
      </tr>
      {open && (
        <tr className="ad-open"><td colSpan={11}>
          <div className="ad-detail">
            <div className="ad-detail-h">
              <span>{c.first ? `Results from ${fmtDay(c.first)} to ${fmtDay(c.last)}` : 'No results in this range'}{c.settings?.utm ? ` · matches leads tagged ${c.settings.utm}` : ''}</span>
              <span className="ad-ctl">
                <button type="button" className="btn sm" disabled title="Coming next: control from here once Meta write access is added">{c.status === 'paused' ? 'Resume' : 'Pause'}</button>
                <button type="button" className="btn sm" disabled title="Coming next: control from here once Meta write access is added">Change budget</button>
                {admin && <button type="button" className="btn sm" onClick={onEdit}>Settings</button>}
              </span>
            </div>
            {c.settings?.notes && <p className="ap-hint">{c.settings.notes}</p>}
            {!c.adsets.length ? <p className="cm-none">No ad set breakdown. Export from the Ads tab in Ads Manager to see each ad set and ad.</p> : (
              <table className="ad-table ad-inner">
                <thead><tr><th>AD SET / AD</th><th className="num">SPENT</th><th className="num">IMPR.</th><th className="num">CLICKS</th><th className="num">CTR</th><th className="num">CPC</th><th className="num">META RESULTS</th><th className="num">COST / RESULT</th></tr></thead>
                <tbody>
                  {c.adsets.map((s) => (
                    <SetRows key={s.name} s={s} money={$} />
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </td></tr>
      )}
    </>
  );
}

function SetRows({ s, money: $ }: { s: AdCampaignReport['adsets'][number]; money: (n: number | null) => string }) {
  const line = (name: string, m: AdMetrics, cls: string) => (
    <tr className={cls} key={cls + name}>
      <td>{name}</td><td className="num">{$(m.spend)}</td><td className="num">{int(m.impressions)}</td><td className="num">{int(m.clicks)}</td>
      <td className="num">{pct(m.ctr)}</td><td className="num">{$(m.cpc)}</td><td className="num">{m.results ? int(m.results) : '–'}</td><td className="num">{m.results ? $(m.spend / m.results) : '–'}</td>
    </tr>
  );
  return <>{line(s.name, s.m, 'ad-set')}{s.ads.map((a) => line(a.name, a.m, 'ad-ad'))}</>;
}

/** REPS only: read an Ads Manager CSV, show what's in it, then import. */
function ImportAds({ clientId, onClose, onDone }: { clientId: string; onClose: () => void; onDone: (msg: string) => void }) {
  const [file, setFile] = useState<{ name: string; data: AdImport } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => {
    setErr(''); setFile(null);
    if (!f) return;
    if (/\.xlsx?$/i.test(f.name)) { setErr('That’s an Excel file. In Ads Manager, choose Export table data and pick CSV.'); return; }
    try { setFile({ name: f.name, data: readAdsExport(await f.text()) }); } catch (e) { setErr(e instanceof Error ? e.message : 'Could not read that file.'); }
  };
  const go = async () => {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      const x = await backend.importMetaAds(clientId, { rows: file.data.rows, currency: file.data.currency, fileName: file.name });
      onDone(`Imported ${x.rows} row${x.rows === 1 ? '' : 's'} across ${x.campaigns} campaign${x.campaigns === 1 ? '' : 's'}, ${fmtDay(x.from)} to ${fmtDay(x.to)}.`);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not import it.'); setBusy(false); }
  };
  const d = file?.data;
  const spend = d ? d.rows.reduce((s, x) => s + x.spend, 0) : 0;
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="ad-imp-t">
        <div id="ad-imp-t" className="m-t">Import from Ads Manager</div>
        <ol className="ad-steps">
          <li>In Ads Manager, open the client&apos;s ad account and pick the dates.</li>
          <li>Go to the <b>Ads</b> tab (for every ad set and ad) and choose <b>Breakdown › By time › Day</b>.</li>
          <li>Make sure the columns include Amount spent, Impressions, Reach, Link clicks and Results.</li>
          <li>Click <b>Export › Export table data › CSV</b>, then choose the file below.</li>
        </ol>
        <input ref={ref} type="file" accept=".csv,text/csv,.tsv,.txt" hidden onChange={(e) => pick(e.target.files?.[0])} />
        <button type="button" className="btn" onClick={() => ref.current?.click()}>{file ? `Chosen: ${file.name}` : 'Choose CSV file'}</button>
        {d && (
          <div className="ad-imp-sum">
            <div><b>{d.rows.length}</b> rows</div>
            <div><b>{d.campaigns.length}</b> campaign{d.campaigns.length === 1 ? '' : 's'}</div>
            <div><b>{money(spend, d.currency.toLowerCase())}</b> spent</div>
            <div><b>{fmtDay(d.from)}</b> to <b>{fmtDay(d.to)}</b></div>
          </div>
        )}
        {d?.warnings.map((w) => <p key={w} className="ap-hint">{w}</p>)}
        {d && <p className="ap-hint">Anything already imported for these campaigns on these days is replaced, so it&apos;s safe to import overlapping dates.</p>}
        {err && <div className="form-msg err" role="alert">{err}</div>}
        <div className="cp-a">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="button" className="btn gold" disabled={!d || busy} onClick={go}>{busy ? 'Importing…' : 'Import'}</button>
        </div>
      </div>
    </div>
  );
}

/** REPS only: a campaign's settings on the dashboard. */
function CampaignForm({ init, funnels, clientId, onClose, onSaved }: { init: AdCampaignInput; funnels: Funnel[]; clientId: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useData();
  const [x, setX] = useState<AdCampaignInput>(init);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async (e: FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await backend.saveAdCampaign(clientId, x); onSaved(); } catch (e2) { setErr(e2 instanceof Error ? e2.message : 'Could not save it.'); setBusy(false); }
  };
  return (
    <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal mt-add tk-form" role="dialog" aria-modal="true" aria-labelledby="ad-c-t" onSubmit={save}>
        <div id="ad-c-t" className="m-t">{init.id || init.name ? 'Campaign settings' : 'Add a campaign'}</div>
        <label className="ae-f"><span>Campaign name (as in Ads Manager)</span><input className="ob-input" required value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} placeholder="e.g. Bring It Home | Leads | Nov" /></label>
        <div className="mt-add-row">
          <label className="ae-f"><span>Status</span>
            <select className="ob-input" value={x.status} onChange={(e) => setX({ ...x, status: e.target.value as AdStatus })}>
              {(Object.keys(AD_STATUS) as AdStatus[]).map((k) => <option key={k} value={k}>{AD_STATUS[k]}</option>)}
            </select>
          </label>
          <label className="ae-f"><span>Daily budget (optional)</span><input className="ob-input" type="number" min="0" step="0.01" value={x.dailyBudget ?? ''} onChange={(e) => setX({ ...x, dailyBudget: e.target.value ? Number(e.target.value) : undefined })} /></label>
        </div>
        <label className="ae-f"><span>Funnel it sends people to</span>
          <select className="ob-input" value={x.funnelId ?? ''} onChange={(e) => setX({ ...x, funnelId: e.target.value || undefined })}>
            <option value="">None</option>
            {funnels.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </label>
        <label className="ae-f"><span>utm_campaign on its ads (optional)</span><input className="ob-input" value={x.utm ?? ''} onChange={(e) => setX({ ...x, utm: e.target.value })} placeholder="Leave blank if it’s the campaign name" />
          <span className="ap-hint">Leads with this utm_campaign count towards this campaign.</span>
        </label>
        <label className="ae-f"><span>Notes (optional)</span><textarea className="ob-input" rows={2} value={x.notes ?? ''} onChange={(e) => setX({ ...x, notes: e.target.value })} placeholder="Audience, offer, creative angle" /></label>
        <p className="ap-hint">Status and budget here are for the team&apos;s reference. Once Meta is connected, they come from Meta and can be changed from here.</p>
        {err && <div className="form-msg err" role="alert">{err}</div>}
        <div className="cp-a">
          {x.id && <button type="button" className="ob-link fn-del" onClick={async () => { if (!window.confirm('Remove these settings? The imported results stay.')) return; try { await backend.removeAdCampaign(x.id!); onSaved(); } catch (e2) { toast(e2 instanceof Error ? e2.message : 'Could not remove it.'); } }}>Remove settings</button>}
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn gold" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </div>
  );
}
