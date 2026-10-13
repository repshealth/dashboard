'use client';

import { useState } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { fmtWhen } from '@/lib/format';
import type { Site } from '@/lib/types';

/** REPS only: connect the website to the GitHub repo it's saved to from Claude, and pull updates. */
export default function SiteSource({ site }: { site: Site }) {
  const { toast, refreshSite, refreshAgency } = useData();
  const src = site.github;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ repo: src?.repo ?? '', branch: src?.branch ?? 'main', autoPublish: src?.autoPublish ?? false });
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try { await fn(); await refreshSite(); refreshAgency().catch(() => {}); }
    catch (e) { toast(e instanceof Error ? e.message : 'Something went wrong.'); }
    finally { setBusy(false); }
  };

  return (
    <div className="sv-source">
      <div className="lbl" style={{ marginTop: 0 }}>UPDATES FROM CLAUDE</div>
      {src && !open ? (
        <>
          <p className="sv-src-line">Connected to <a className="sv-inline-link" href={`https://github.com/${src.repo}`} target="_blank" rel="noreferrer">{src.repo}</a> ({src.branch}). {site.versions.length ? <>Each push adds a new version{src.autoPublish ? ' and sends it straight to the client.' : ' that waits for you in Approvals.'}</> : 'The first commit shows here straight away, for the REPS team only until you send it to the client.'}</p>
          {src.lastSync && <p className="sv-src-note">Last checked {fmtWhen(src.lastSync)}{src.lastNote ? `: ${src.lastNote}` : ''}</p>}
          <div className="sv-src-btns">
            <button type="button" className="btn" disabled={busy} onClick={() => run(async () => { const r = await backend.syncSite(site.clientId); toast(r.note); })}>{busy ? 'Checking…' : 'Check for updates'}</button>
            <button type="button" className="ob-link" onClick={() => setOpen(true)}>Change</button>
          </div>
        </>
      ) : open || !src ? (
        open ? (
          <form className="mt-vedit" onSubmit={(e) => { e.preventDefault(); run(async () => { await backend.saveSiteSource(site.clientId, f); setOpen(false); toast(f.repo ? 'Connected. Checking for the latest version…' : 'Disconnected.'); if (f.repo) { const r = await backend.syncSite(site.clientId); toast(r.note); } }); }}>
            <label className="ae-f"><span>GitHub repo</span><input className="ob-input" placeholder="e.g. repshealth/physique-x-site" value={f.repo} onChange={(e) => setF({ ...f, repo: e.target.value })} /></label>
            <label className="ae-f"><span>Branch</span><input className="ob-input" value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value })} /></label>
            <label className="ae-check"><input type="checkbox" checked={f.autoPublish} onChange={(e) => setF({ ...f, autoPublish: e.target.checked })} /> Send updates straight to the client (skip Approvals)</label>
            <div className="cp-a"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button type="submit" className="btn gold" disabled={busy}>Save</button></div>
          </form>
        ) : (
          <>
            <p className="sv-src-line">Keep this website up to date from Claude: save it to a GitHub repo and every change shows up here as a new version.</p>
            <button type="button" className="btn" onClick={() => setOpen(true)}>Connect GitHub repo</button>
          </>
        )
      ) : null}
    </div>
  );
}
