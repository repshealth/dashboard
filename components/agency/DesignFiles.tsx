'use client';

import { useCallback, useEffect, useState } from 'react';
import { useData } from '../DataProvider';
import HtmlFrame from '../site/HtmlFrame';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import { LOOKS } from '@/lib/site/spec';
import type { DesignFile, Device, Site } from '@/lib/types';

/**
 * REPS only: the website pages generated for a client, waiting to be reviewed in the
 * "CRM - Website Designs" Claude Project. Nothing shows in the client's Website section
 * until the final design is committed to their site repo.
 */
export default function DesignFiles({ clientId, stamp }: { clientId: string; stamp?: string | number }) {
  const { toast, refreshSite } = useData();
  const [site, setSite] = useState<Site | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [open, setOpen] = useState<DesignFile | null>(null);
  const [device, setDevice] = useState<Device>('desktop');

  const load = useCallback(() => backend.getSite(clientId).then(setSite).catch(() => setSite(null)), [clientId]);
  useEffect(() => { load(); }, [load, stamp]);

  if (!site?.designs?.length) return null;
  const home = site.specs?.home;
  const committed = site.versions.some((v) => v.commit);

  const look = async (id: (typeof LOOKS)[number]['id']) => {
    if (busy || home?.design === id) return;
    setBusy(id);
    try {
      await backend.setSiteDesign(clientId, id);
      await load();
      toast(`Website Page redrawn in the ${LOOKS.find((l) => l.id === id)?.name} look.`);
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not change the look.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="detail df">
      <div className="df-h">
        <div>
          <h3 className="ls-h">Website designs</h3>
          <p className="sub">Review and finish these in the <b>CRM - Website Designs</b> Claude Project. {committed
            ? 'The site has been committed, so it now shows in their Website section.'
            : <>When you&apos;re happy, commit the final page to {site.github?.repo ? <b>{site.github.repo}</b> : 'the client’s site repo'} as <code>index.html</code>{site.designs.some((d) => d.key === 'prereg') ? <> (and the pre-registration page as <code>pre-register.html</code>)</> : null}. Only then does a preview appear in their Website section.</>}
          </p>
        </div>
      </div>
      <ul className="df-list">
        {site.designs.map((d) => (
          <li key={d.key} className="df-item">
            <div className="df-main">
              <b>{d.file}</b>
              <span className="df-meta">Saved {fmtWhen(d.savedAt)}{d.design ? ` · ${LOOKS.find((l) => l.id === d.design)?.name ?? d.design} look` : ''}</span>
              {d.note && <span className="df-note">{d.note}</span>}
            </div>
            <div className="actions">
              <button type="button" className="btn" onClick={() => { setOpen(d); setDevice('desktop'); }}>Preview</button>
              <a className="btn" href={d.url} download={d.file}>Download</a>
              {d.repoUrl && <a className="btn" href={d.repoUrl} target="_blank" rel="noreferrer">Open in GitHub</a>}
            </div>
          </li>
        ))}
      </ul>
      {home && (
        <div className="df-looks">
          <span className="ap-hint">Website look</span>
          <div className="sv-look-row" role="radiogroup" aria-label="Website look">
            {LOOKS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={home.design === l.id} title={`${l.desc} After ${l.after}.`}
                className={`sv-look-b${home.design === l.id ? ' on' : ''}`} disabled={!!busy} onClick={() => look(l.id)}>
                <span className={`ob-look ob-look-${l.id}`} style={{ ['--p' as string]: home.brand.primary, ['--s' as string]: home.brand.secondary }} aria-hidden="true"><i /><b /><em /><u /></span>
                {busy === l.id ? 'Redrawing…' : l.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {open && (
        <div className="modal-bg" onClick={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div className="modal df-modal" role="dialog" aria-modal="true" aria-label={open.name}>
            <div className="df-mh">
              <b>{open.name}</b>
              <div className="seg" role="group" aria-label="Device">
                {(['desktop', 'mobile'] as Device[]).map((x) => (
                  <button key={x} type="button" className={device === x ? 'on' : ''} onClick={() => setDevice(x)}>{x === 'desktop' ? 'Desktop' : 'Mobile'}</button>
                ))}
              </div>
              <button type="button" className="btn" onClick={() => { setOpen(null); refreshSite(clientId).catch(() => {}); }}>Close</button>
            </div>
            <div className="df-frame">
              <HtmlFrame key={`${open.url}-${device}`} url={open.url} device={device} width={device === 'desktop' ? 1000 : 390} height={Math.round(window.innerHeight * 0.72)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
