'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { LAUNCH_STEPS, type Draft } from '../onboarding/steps';
import { backend, type Submission } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import { exampleAnswers, launchFrom, withLaunch, type LaunchDoc } from '@/lib/site/onboarding';

type Row = { sub: Submission; doc: LaunchDoc | null; state: 'todo' | 'saved' | 'built' };
const STATE = {
  todo: { label: 'To complete', cls: 'st-changes' },
  saved: { label: 'Saved, not built', cls: 'st-build' },
  built: { label: 'Built', cls: 'st-approved' },
} as const;

/** Clients whose intake form is in, waiting for the REPS team to fill in their launch. */
export default function LaunchSetupPage() {
  const router = useRouter();
  const { viewer, mode, toast, refreshAgency, refreshLaunch, refreshSite, setClientId } = useData();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [docs, setDocs] = useState<LaunchDoc[]>([]);
  const [sel, setSel] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState<'save' | 'build' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  const load = useCallback(async () => {
    const [s, d] = await Promise.all([backend.listSubmissions(), backend.listLaunchSetups()]);
    setSubs(s); setDocs(d);
  }, []);
  useEffect(() => { load().catch(() => setSubs([])); }, [load]);

  const rows: Row[] = useMemo(() => {
    // One row per client: their latest intake form.
    const seen = new Set<string>();
    return (subs ?? []).filter((x) => x.clientId && !seen.has(x.clientId) && seen.add(x.clientId)).map((sub) => {
      const doc = docs.find((d) => d.clientId === sub.clientId) ?? null;
      const state: Row['state'] = !doc ? 'todo' : doc.builtAt && doc.builtAt >= doc.savedAt ? 'built' : 'saved';
      return { sub, doc, state };
    }).sort((a, b) => (a.state === b.state ? b.sub.submittedAt.localeCompare(a.sub.submittedAt) : a.state === 'todo' ? -1 : b.state === 'todo' ? 1 : a.state === 'saved' ? -1 : 1));
  }, [subs, docs]);
  const current = rows.find((r) => r.sub.clientId === sel) ?? rows[0];

  // The form edits the client's answers with the launch setup on top.
  useEffect(() => {
    if (!current) { setDraft(null); return; }
    const a = withLaunch(current.sub.answers, current.doc?.setup);
    if (!a.launch.websiteUrl && a.domain.name) a.launch.websiteUrl = a.domain.name;
    setDraft(JSON.parse(JSON.stringify(a)));
    setError(null);
  }, [current?.sub.id, current?.doc?.savedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setNotes([]); }, [current?.sub.id]);

  if (!viewer?.isAdmin) return null;

  const set = (fn: (d: Draft) => void) => setDraft((d) => { if (!d) return d; const next = JSON.parse(JSON.stringify(d)) as Draft; fn(next); return next; });

  const save = async (build: boolean) => {
    if (!draft || !current?.sub.clientId) return;
    if (build) {
      for (const s of LAUNCH_STEPS) {
        const msg = s.check?.(draft);
        if (msg) { setError(`${s.title}: ${msg}`); return; }
      }
    }
    setBusy(build ? 'build' : 'save'); setError(null);
    try {
      const r = await backend.saveLaunchSetup(current.sub.clientId, launchFrom(draft), build);
      setNotes(r.built ? r.notes : []);
      toast(r.built ? 'Launch built.' : 'Launch setup saved.');
      await load();
      refreshLaunch().catch(() => {});
      if (r.built) { refreshAgency().catch(() => {}); refreshSite(current.sub.clientId).catch(() => {}); }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save. Please try again.');
    } finally { setBusy(null); }
  };

  const open = (to: '/website' | '/emails') => { if (current?.sub.clientId) { setClientId(current.sub.clientId); router.push(to); } };
  const a = current?.sub.answers;

  return (
    <div className="view">
      <header>
        <div>
          <h1>Launch setup</h1>
          <p className="sub">Each client fills in the intake form about them and their brand. Then fill in their launch here: the offer, pricing, programmes and launch dates. Building it finishes the website, makes the pre-registration page and writes the launch emails.</p>
        </div>
      </header>

      {subs === null ? <div className="loading">Loading…</div> : !rows.length ? (
        <div className="sv-empty">
          <span className="stbadge st-build">None yet</span>
          <div className="sv-et">No intake forms yet</div>
          <p>Send a new client the intake form. Their account appears here as soon as they submit it.</p>
        </div>
      ) : (
        <div className="ap-grid">
          <div className="ap-list">
            {rows.map((r) => {
              const on = current?.sub.id === r.sub.id;
              return (
                <button key={r.sub.id} type="button" className={`ap-item${on ? ' on' : ''}`} onClick={() => setSel(r.sub.clientId)} aria-current={on ? 'true' : undefined}>
                  <div className="ap-item-h"><b>{r.sub.answers.business.brandName}</b><span className="cm-t">{fmtWhen(r.sub.submittedAt)}</span></div>
                  <div className="ap-item-v">{r.sub.answers.contact.name}</div>
                  <div className="ap-item-tags"><span className={`stbadge sm ${STATE[r.state].cls}`}>{STATE[r.state].label}</span></div>
                </button>
              );
            })}
          </div>

          {current && draft && a && (
            <section className="ap-detail" aria-label={`${a.business.brandName} launch setup`}>
              <div className="ap-head">
                <div>
                  <div className="ap-eyebrow">{STATE[current.state].label}{current.doc ? ` · saved ${fmtWhen(current.doc.savedAt)} by ${current.doc.savedBy}` : ''}</div>
                  <h2>{a.business.brandName}</h2>
                  <p className="sub">
                    {a.contact.name} · {a.contact.email}{a.contact.timezone ? ` · ${a.contact.timezone.replace('_', ' ')}` : ''}
                    {a.domain?.name ? ` · ${a.domain.name}` : a.domain?.has === 'no' ? ' · needs a domain' : ''}
                  </p>
                </div>
                <div className="actions">
                  <button type="button" className="btn" onClick={() => open('/website')}>Website</button>
                  {current.state === 'built' && <button type="button" className="btn" onClick={() => open('/emails')}>Emails</button>}
                  {mode === 'demo' && current.state === 'todo' && (
                    <button type="button" className="btn" onClick={() => { const e = exampleAnswers(); set((d) => { d.offer = e.offer; d.leadMagnet = e.leadMagnet; d.launch = { ...e.launch, websiteUrl: d.launch.websiteUrl || e.launch.websiteUrl }; }); }}>Fill with example</button>
                  )}
                </div>
              </div>

              {LAUNCH_STEPS.map((s, i) => (
                <div key={s.title} className="detail ls-sec">
                  <h3 className="ls-h"><span>{i + 1}</span>{s.title}</h3>
                  <p className="sub ls-intro">{s.intro}</p>
                  {s.body(draft, set)}
                </div>
              ))}

              {error && <div className="form-msg err" role="alert">{error}</div>}
              {notes.length > 0 && (
                <div className="sv-lock ls-notes">
                  <b>Built.</b>
                  <ul>{notes.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              )}
              <div className="ls-bar">
                <span className="ap-hint">{current.state === 'built' ? 'Building again updates drafts in place. Anything the client has already seen gets a new version for you to approve.' : 'Save as you go. Build when the offer, pricing and launch date are in.'}</span>
                <div className="actions">
                  <button type="button" className="btn" disabled={!!busy} onClick={() => save(false)}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
                  <button type="button" className="btn gold" disabled={!!busy} onClick={() => save(true)}>{busy === 'build' ? 'Building… (up to a couple of minutes)' : current.state === 'built' ? 'Save and rebuild' : 'Save and build launch'}</button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
