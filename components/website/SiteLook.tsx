'use client';

import { useState } from 'react';
import { useData } from '../DataProvider';
import { backend } from '@/lib/backend';
import { isPreReg } from '@/lib/site/prereg';
import { LOOKS } from '@/lib/site/spec';
import type { Site, SiteVersion } from '@/lib/types';

/** REPS only: redraw a generated website in another design. Same words and photos. */
export default function SiteLook({ site, version }: { site: Site; version: SiteVersion }) {
  const { toast, refreshSite, refreshAgency } = useData();
  const [busy, setBusy] = useState<string | null>(null);
  const home = version.pages.find((p) => p.key === 'home' && p.kind === 'template');
  const spec = home?.spec && !isPreReg(home.spec) ? home.spec : null;
  if (!spec) return null;
  const now = spec.design ?? 'shapeup';

  const pick = async (id: (typeof LOOKS)[number]['id']) => {
    if (id === now || busy) return;
    setBusy(id);
    try {
      const r = await backend.setSiteDesign(site.clientId, id);
      await refreshSite();
      refreshAgency().catch(() => {});
      const name = LOOKS.find((l) => l.id === id)?.name;
      toast(r.pending ? `The ${name} look is waiting for you in Approvals.` : `Switched to the ${name} look.`);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Could not change the look.');
    } finally { setBusy(null); }
  };

  return (
    <div className="sv-look">
      <div className="lbl" style={{ marginTop: 0 }}>WEBSITE LOOK</div>
      <div className="sv-look-row" role="radiogroup" aria-label="Website look">
        {LOOKS.map((l) => (
          <button key={l.id} type="button" role="radio" aria-checked={now === l.id} title={`${l.desc} After ${l.after}.`}
            className={`sv-look-b${now === l.id ? ' on' : ''}`} disabled={!!busy} onClick={() => pick(l.id)}>
            <span className={`ob-look ob-look-${l.id}`} style={{ ['--p' as string]: spec.brand.primary, ['--s' as string]: spec.brand.secondary }} aria-hidden="true"><i /><b /><em /><u /></span>
            {busy === l.id ? 'Switching…' : l.name}
          </button>
        ))}
      </div>
      <p className="sv-src-note">{site.status === 'draft' ? 'Changes the draft straight away.' : 'The client has seen this site, so a new look goes to Approvals first.'}</p>
    </div>
  );
}
