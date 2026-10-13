'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { FontStyle, Headline, SiteSpec } from '@/lib/site/spec';

/**
 * Shared pieces for the Arena and Studio website designs: phones whose screens scroll,
 * marquees, counters, scroll reveals and the email capture. Styles live in kit.css (.sk-*),
 * each design adds its own look on top.
 */

export type Face = { display: string; stretch: string; weight: number; tt: string; accent: string };

/** Picks the brand's headline face for a design. */
export const faceVars = (f: Face): CSSProperties => ({
  '--fd': f.display, '--fs': f.stretch, '--fw': f.weight, '--tt': f.tt, '--fa': f.accent,
} as CSSProperties);
export type Faces = Record<FontStyle, Face>;

export function Pic({ src, label, className = '' }: { src?: string; label: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className={`sk-img ${className}`} src={src} alt={label} />;
  return <div className={`sk-img sk-ph ${className}`} role="img" aria-label={`${label} (to be added)`}><span>{label}</span></div>;
}

export const Stars = () => <span className="sk-stars" aria-label="5 stars">★★★★★</span>;

/**
 * A phone whose screen slowly scrolls through a screenshot. Without screenshots it shows a
 * stand-in screen built from the feature names, so drafts still feel like an app.
 */
export function Phone({ src, label, items, tone = 0, speed = 16, className = '' }: { src?: string; label: string; items: string[]; tone?: number; speed?: number; className?: string }) {
  return (
    <div className={`sk-phone ${className}`} style={{ '--dur': `${speed}s` } as CSSProperties}>
      <div className="sk-notch" aria-hidden="true" />
      <div className="sk-screen">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="sk-scroll" src={src} alt={label} />
        ) : (
          <div className="sk-scroll sk-mock" role="img" aria-label={`${label} (screenshot to be added)`}>
            <div className="sk-mock-top"><span /><b>{['Today', 'This week', 'Plan', 'Progress'][tone % 4]}</b><span /></div>
            <div className="sk-mock-ring" style={{ '--n': `${58 + (tone % 4) * 10}%` } as CSSProperties}><b>{58 + (tone % 4) * 10}%</b><small>complete</small></div>
            {[...items, ...items, ...items].slice(0, 12).map((t, i) => (
              <div key={i} className={`sk-mock-card${(i + tone) % 3 === 0 ? ' hi' : ''}`}>
                <i />
                <div><b>{t}</b><small>{['20 min', 'Day 3', 'Ready', '4 of 6'][(i + tone) % 4]}</small></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/** "2,000+" counts up from 0 the first time it scrolls into view. */
export function Count({ value }: { value: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const m = value.match(/^([^\d]*)([\d,.]+)(.*)$/);
  const target = m ? parseFloat(m[2].replace(/,/g, '')) : NaN;
  const [shown, setShown] = useState(value);
  useEffect(() => {
    const el = ref.current;
    if (!el || !m || !isFinite(target) || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const dec = (m[2].split('.')[1] || '').length;
    const fmt = (n: number) => `${m[1]}${n.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec })}${m[3]}`;
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t: number) => {
        const k = Math.min(1, (t - t0) / 1400);
        setShown(fmt(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    }, { threshold: 0.4 });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  return <span ref={ref}>{shown}</span>;
}

/** An endless strip. Children are drawn twice so the loop is seamless. */
export function Marquee({ children, className = '', reverse, speed = 38 }: { children: ReactNode; className?: string; reverse?: boolean; speed?: number }) {
  return (
    <div className={`sk-marquee ${className}`}>
      <div className={`sk-track${reverse ? ' rev' : ''}`} style={{ '--dur': `${speed}s` } as CSSProperties}>
        <div className="sk-run">{children}</div>
        <div className="sk-run" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

/** Steps through n items on a timer; hovering or clicking holds one. */
export function useCycle(n: number, ms = 4200) {
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || n < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % n), ms);
    return () => clearInterval(t);
  }, [held, n, ms]);
  return { active, held, pick: (i: number) => { setActive(i); setHeld(true); }, release: () => setHeld(false) };
}

/** Fades sections in as they scroll into view. Anything marked .sk-rv inside the ref. */
export function useReveal(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = ref.current;
    if (!root || typeof IntersectionObserver === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const els = [...root.querySelectorAll<HTMLElement>('.sk-rv')];
    const io = new IntersectionObserver((list) => list.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
    }), { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach((el) => io.observe(el));
    root.classList.add('sk-armed');
    // Never leave anything hidden, even if the observer doesn't fire (e.g. a scaled thumbnail).
    const t = setTimeout(() => els.forEach((el) => el.classList.add('in')), 6000);
    return () => { io.disconnect(); clearTimeout(t); };
  }, [ref]);
}

/** A soft light that follows the pointer across a card. */
export const spot = (e: MouseEvent<HTMLElement>) => {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${((e.clientX - r.left) / Math.max(r.width, 1)) * 100}%`);
  el.style.setProperty('--my', `${((e.clientY - r.top) / Math.max(r.height, 1)) * 100}%`);
};

/** The free guide sign-up at the bottom of the page. */
export function useCapture(spec: SiteSpec, formEndpoint?: string) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEndpoint) { setState('done'); return; }
    setState('sending');
    try {
      const res = await fetch(formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: spec.slug, email, source: 'magnet', form: spec.capture.headline.bold, page: '/' }) });
      setState(res.ok ? 'done' : 'error');
    } catch { setState('error'); }
  };
  return { email, setEmail, state, submit };
}

export function Logo({ spec, className = '' }: { spec: SiteSpec; className?: string }) {
  return spec.brand.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className={`sk-logo-img ${className}`} src={spec.brand.logoUrl} alt={spec.brand.name} />
    : <span className={`sk-logo-text ${className}`}>{spec.brand.name}</span>;
}

/** Up to four headline numbers from the about and coach sections. */
export const statsOf = (spec: SiteSpec) => [...spec.about.stats, ...spec.coach.stats].slice(0, 4);

export const headText = (h: Headline) => [h.light, h.bold].filter(Boolean).join(' ');

/** Black or white, whichever reads better on a brand colour. */
export function onColour(hex: string) {
  const m = hex.replace('#', '').match(/^([\da-f]{2})([\da-f]{2})([\da-f]{2})/i);
  if (!m) return '#fff';
  const [r, g, b] = m.slice(1).map((x) => { const c = parseInt(x, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.4 ? '#0b0b0d' : '#fff';
}

/** Screens to show: the app section's, else the hero's. */
export const screensOf = (spec: SiteSpec) => (spec.app?.screens.length ? spec.app.screens : spec.hero.screens);
