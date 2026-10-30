'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import type { CalendlyPublic } from '@/lib/calendly/types';
import type { Client } from '@/lib/types';

/**
 * REPS only: connect a client's Calendly. Paste their personal access token and the dashboard
 * sets up booking updates itself. Choose which call types count, and import recent bookings.
 */
export default function CalendlyConnect({ client, onImported }: { client: Client; onImported?: () => void }) {
  const { viewer, toast } = useData();
  const [s, setS] = useState<CalendlyPublic | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [only, setOnly] = useState<string[]>([]);
  const [busy, setBusy] = useState<'save' | 'types' | 'import' | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => backend.getCalendly(client.id).then((r) => { setS(r); setOnly(r?.only.length ? r.only : r?.eventTypes.map((e) => e.uri) ?? []); }).catch(() => setS(null)), [client.id]);
  useEffect(() => { if (viewer?.isAdmin) load(); }, [load, viewer?.isAdmin]);
  if (!viewer?.isAdmin) return null;

  const run = async (what: 'save' | 'types' | 'import', fn: () => Promise<void>) => {
    setBusy(what); setErr('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(null); }
  };
  const connect = () => run('save', async () => {
    const r = await backend.saveCalendly(client.id, { token });
    setS(r); setToken(''); setOnly(r?.only.length ? r.only : r?.eventTypes.map((e) => e.uri) ?? []);
    toast('Calendly connected. New bookings will come through on their own.');
  });
  const saveTypes = () => run('types', async () => {
    if (!only.length) throw new Error('Tick at least one call type.');
    setS(await backend.saveCalendly(client.id, { only })); toast('Call types saved.');
  });
  const doImport = () => run('import', async () => {
    const r = await backend.importCalendly(client.id);
    toast(r.note); await load(); onImported?.();
  });
  const types = s?.eventTypes ?? [];
  const typesChanged = s && JSON.stringify([...only].sort()) !== JSON.stringify([...(s.only.length ? s.only : types.map((e) => e.uri))].sort());

  return (
    <>
      <button type="button" className="btn sp-btn" onClick={() => { setOpen(true); setErr(''); }}>
        <span className={`sp-dot${s?.connected ? ' on' : ''}`} aria-hidden="true" />Calendly{s?.connected ? '' : ': connect'}
      </button>
      {open && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="cal-t">
            <div id="cal-t" className="m-t">Calendly for {client.name}</div>
            <p className="sub">Booked calls move leads to Call booked, cancellations back to Nurturing, and no-shows to Showed / No-show, matched by email. Needs a paid Calendly plan.</p>

            {s?.connected && (
              <p className="sp-status">
                Connected to <b>{s.userName || 'their Calendly'}</b>{s.userEmail ? ` (${s.userEmail})` : ''}.{' '}
                {s.lastEventAt ? <>Last update {fmtWhen(s.lastEventAt)}{s.lastNote ? `: ${s.lastNote}` : ''}</> : s.lastNote}
              </p>
            )}

            <label className="ae-f">
              <span>{s?.connected ? 'Replace the token (optional)' : 'Calendly personal access token'} {s?.connected && <em className="sp-ok">saved</em>}</span>
              <input className="ob-input sp-mono" type="password" autoComplete="off" placeholder={s?.connected ? 'Saved. Paste a new one to replace it' : 'eyJ…'} value={token} onChange={(e) => setToken(e.target.value)} />
              <span className="ap-hint">In their Calendly: Integrations &amp; apps, API and webhooks, Personal access tokens, Generate new token.</span>
            </label>

            {s?.connected && types.length > 0 && (
              <div className="ae-f">
                <span>Bookings that count</span>
                <div className="lg-pick">
                  {types.map((t) => {
                    const on = only.includes(t.uri);
                    return (
                      <label key={t.uri} className={`lg-opt${on ? ' on' : ''}`}>
                        <input type="checkbox" checked={on} onChange={() => setOnly(on ? only.filter((x) => x !== t.uri) : [...only, t.uri])} />
                        {t.name}{t.active ? '' : ' (off)'}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {err && <div className="form-msg err" role="alert">{err}</div>}

            <div className="cp-a">
              {s?.connected && <button type="button" className="ob-link sp-disc" onClick={() => run('save', async () => { await backend.saveCalendly(client.id, { disconnect: true }); setS(null); toast('Calendly disconnected.'); })}>Disconnect</button>}
              {s?.connected && <button type="button" className="btn" disabled={!!busy} onClick={doImport}>{busy === 'import' ? 'Importing…' : 'Import recent bookings'}</button>}
              {s?.connected && typesChanged && <button type="button" className="btn" disabled={!!busy} onClick={saveTypes}>{busy === 'types' ? 'Saving…' : 'Save call types'}</button>}
              <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
              <button type="button" className="btn gold" disabled={!!busy || !token.trim()} onClick={connect}>{busy === 'save' ? 'Connecting…' : s?.connected ? 'Replace token' : 'Connect'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
