'use client';

import { useEffect, useRef, useState } from 'react';
import SpecSite from './SpecSite';
import type { AnySpec } from '@/lib/site/prereg';
import type { Device } from '@/lib/types';

const DESKTOP_W = 1280;

/** A browser-style frame showing a generated site at real desktop width, scaled to fit, or at phone width. */
export default function PreviewFrame({ spec, device, label, highlight = [] }: {
  spec: AnySpec; device: Device; label: string; highlight?: string[];
}) {
  const vp = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = vp.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Outline the words that changed, so they're easy to spot.
  useEffect(() => {
    const root = vp.current;
    if (!root) return;
    root.querySelectorAll('.chg').forEach((el) => el.classList.remove('chg'));
    if (!highlight.length) return;
    const wanted = new Set(highlight.map((h) => h.replace(/\s+/g, ' ').trim()));
    root.querySelectorAll('.site *').forEach((el) => {
      if (el.children.length) return;
      const t = (el.textContent || '').replace(/\s+/g, ' ').trim().replace(/^[“"]|[”"]$/g, '');
      if (t && wanted.has(t)) el.classList.add('chg');
    });
  }, [spec, device, highlight]);

  return (
    <div className="sv-stage">
      <div className={`frame ${device}`}>
        <div className="chrome">
          <span className="dots"><i /><i /><i /></span>
          <span className="url">{label}</span>
        </div>
        <div className="viewport" ref={vp}>
          {device === 'desktop' ? (
            <div className="tpl-zoom" style={{ width: DESKTOP_W, zoom: w ? Math.min(1, w / DESKTOP_W) : 0.6 }}>
              <SpecSite spec={spec} />
            </div>
          ) : (
            <SpecSite spec={spec} />
          )}
        </div>
      </div>
    </div>
  );
}
