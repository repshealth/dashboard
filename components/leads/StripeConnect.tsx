'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import type { StripePublic } from '@/lib/stripe/types';
import type { Client } from '@/lib/types';

/**
 * REPS only: connect a client's Stripe account. Shows the webhook address to give them,
 * takes the signing secret they send back, and can import past payments with a read-only key.
 */
export default function StripeConnect({ client, onImported }: { client: Client; onImported?: () => void }) {
  const { viewer, mode, toast } = useData();
  const [s, setS] = useState<StripePublic | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [secret, setSecret] = useState('');
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState<'save' | 'import' | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(() => backend.getStripe(client.id).then(setS).catch(() => setS(null)), [client.id]);
  useEffect(() => { if (viewer?.isAdmin) load(); }, [load, viewer?.isAdmin]);
  if (!viewer?.isAdmin) return null;

  const origin = mode === 'live' && typeof window !== 'undefined' ? window.location.origin : 'https://YOUR-DASHBOARD';
  const endpoint = `${origin}/api/stripe/${client.slug}`;

  const save = async () => {
    setBusy('save'); setErr('');
    try {
      const r = await backend.saveStripe(client.id, { signingSecret: secret, apiKey: key });
      setS(r); setSecret(''); setKey(''); toast('Stripe connected.');
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setBusy(null); }
  };
  const doImport = async () => {
    setBusy('import'); setErr('');
    try {
      const r = await backend.importStripe(client.id);
      toast(r.note); await load(); onImported?.();
    } catch (e) { setErr(e instanceof Error ? e.message : 'Could not import.'); }
    finally { setBusy(null); }
  };

  return (
    <>
      <button type="button" className="btn sp-btn" onClick={() => { setOpen(true); setErr(''); }}>
        <span className={`sp-dot${s?.connected ? ' on' : ''}`} aria-hidden="true" />Stripe{s?.connected ? '' : ': connect'}
      </button>
      {open && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
          <div className="modal lg-modal" role="dialog" aria-modal="true" aria-labelledby="stripe-t">
            <div id="stripe-t" className="m-t">Stripe for {client.name}</div>
            <p className="sub">Payments, subscriptions and refunds move leads to Purchased and fill in their revenue, matched by email.</p>

            <div className="ae-f">
              <span>1. Webhook address to give them</span>
              <span className="lg-pw">
                <input className="ob-input sp-mono" readOnly value={endpoint} onFocus={(e) => e.target.select()} />
                <button type="button" className="btn" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); toast('Address copied.'); } catch { toast('Select it and copy.'); } }}>Copy</button>
              </span>
            </div>

            <label className="ae-f">
              <span>2. Signing secret they send back {s?.connected && <em className="sp-ok">saved</em>}</span>
              <input className="ob-input sp-mono" type="password" autoComplete="off" placeholder={s?.connected ? 'Saved. Paste a new one to replace it' : 'whsec_…'} value={secret} onChange={(e) => setSecret(e.target.value)} />
            </label>

            <label className="ae-f">
              <span>3. Read-only key, to import past payments (optional) {s?.hasKey && <em className="sp-ok">saved</em>}</span>
              <input className="ob-input sp-mono" type="password" autoComplete="off" placeholder={s?.hasKey ? 'Saved. Paste a new one to replace it' : 'rk_live_…'} value={key} onChange={(e) => setKey(e.target.value)} />
            </label>

            {s?.connected && (
              <p className="sp-status">
                {s.lastEventAt ? <>Last update {fmtWhen(s.lastEventAt)}{s.lastNote ? `: ${s.lastNote}` : ''}</> : 'Connected. Waiting for the first payment update from Stripe.'}
              </p>
            )}
            {err && <div className="form-msg err" role="alert">{err}</div>}

            <div className="cp-a">
              {s?.connected && <button type="button" className="ob-link sp-disc" onClick={async () => { await backend.saveStripe(client.id, { disconnect: true }); setS(null); toast('Stripe disconnected.'); }}>Disconnect</button>}
              {s?.hasKey && <button type="button" className="btn" disabled={!!busy} onClick={doImport}>{busy === 'import' ? 'Importing…' : 'Import past payments'}</button>}
              <button type="button" className="btn" onClick={() => setOpen(false)}>Close</button>
              <button type="button" className="btn gold" disabled={!!busy || (!secret && !key)} onClick={save}>{busy === 'save' ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
