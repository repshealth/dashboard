'use client';

import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import type { PreRegSpec } from '@/lib/site/prereg';
import { fmtLaunch } from '@/lib/emails/schedule';
import { Check, FONTS, H, Phone, Pic, Spark } from './TemplateSite';

/** Days, hours and minutes until 8am on launch day. */
function useCountdown(date: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const m = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const left = Math.max(0, new Date(+m[1], +m[2] - 1, +m[3], 8).getTime() - now);
  return { d: Math.floor(left / 864e5), h: Math.floor((left % 864e5) / 36e5), m: Math.floor((left % 36e5) / 6e4) };
}

/** The pre-registration page, in the same style as the client's main site. */
export default function PreRegSite({ spec, formEndpoint }: { spec: PreRegSpec; formEndpoint?: string }) {
  const f = FONTS[spec.brand.font] ?? FONTS.bold;
  const vars = {
    '--p': spec.brand.primary, '--s': spec.brand.secondary, '--g': spec.brand.ground, '--ink': spec.brand.ink,
    '--fd': f.display, '--fb': f.body, '--lw': f.lightWeight, '--ls': f.lightStyle, '--tt': f.upper ? 'uppercase' : 'none',
  } as CSSProperties;
  const left = useCountdown(spec.launchDate);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEndpoint) { setState('done'); return; }
    setState('sending');
    try {
      const res = await fetch(formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: spec.slug, ...form, source: 'prereg', form: 'Pre-registration', page: '/pre-register' }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  const logo = spec.brand.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="t-logo-img" src={spec.brand.logoUrl} alt={spec.brand.name} />
    : <span className="t-logo-text">{spec.brand.name}</span>;
  const id = (k: string) => `pr-${k}-${spec.slug}`;
  const launch = fmtLaunch(spec.launchDate);

  return (
    <div className="site tpl t-pr" style={vars}>
      <div className="t-navwrap">
        <nav className="t-nav" aria-label={`${spec.brand.name} menu`}>
          <span className="t-logo">{logo}</span>
          <span className="t-btn t-btn-s">{spec.form.button}</span>
        </nav>
      </div>

      <section className="t-hero t-pr-hero">
        <div className="t-wrap t-pr-grid">
          <div className="t-pr-copy">
            <div className="t-eyebrow">{spec.hero.eyebrow}</div>
            <H h={spec.hero.headline} as="h1" className="t-h1" />
            <p className="t-sub">{spec.hero.sub}</p>
            <div className="t-pr-perk"><Spark /><span>{spec.hero.perk}</span></div>
            {left && (
              <div className="t-pr-count" aria-label={`Launches ${launch}`}>
                <div className="t-pr-when">Launches {launch}</div>
                <div className="t-pr-boxes">
                  {([['d', 'days'], ['h', 'hours'], ['m', 'mins']] as const).map(([k, label]) => (
                    <div key={k}><b>{String(left[k]).padStart(2, '0')}</b><span>{label}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <form className="t-capture-card t-pr-form" onSubmit={submit} id="register">
            {state === 'done' ? (
              <p className="t-thanks">You&apos;re on the list. Look out for an email from {spec.brand.name} before launch day.</p>
            ) : (
              <>
                <h2 className="t-pr-ft">{spec.form.title}</h2>
                <label className="t-label" htmlFor={id('name')}>Your name</label>
                <input id={id('name')} className="t-input" required autoComplete="name" placeholder="First and last name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                <label className="t-label" htmlFor={id('email')}>Your email</label>
                <input id={id('email')} className="t-input" type="email" required autoComplete="email" placeholder="you@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <label className="t-label" htmlFor={id('phone')}>Your phone</label>
                <input id={id('phone')} className="t-input" type="tel" autoComplete="tel" placeholder="07..." value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <button type="submit" className="t-btn t-btn-p t-btn-block" disabled={state === 'sending'}>{spec.form.button}</button>
                <p className="t-capture-small">{state === 'error' ? 'That did not go through. Please try again.' : spec.form.small}</p>
              </>
            )}
          </form>
        </div>
      </section>

      <section className="t-sec t-pr-benefits" id="benefits">
        <div className="t-wrap">
          <div className="t-center"><H h={spec.benefits.headline} /></div>
          <div className="t-grid3 t-pr-cards">
            {spec.benefits.items.map((it, i) => (
              <div key={i} className="t-card t-feat">
                <span className="t-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="t-card-t">{it.title}</h3>
                <p className="t-card-b">{it.body}</p>
              </div>
            ))}
          </div>
          {spec.hero.screens.length > 0 && (
            <div className="t-pr-phones">{spec.hero.screens.map((s, i) => <Phone key={i} src={s} label="App screen" />)}</div>
          )}
        </div>
      </section>

      <section className="t-sec t-pr-coach" id="coach">
        <div className="t-wrap t-split">
          <Pic src={spec.coach.image ?? spec.hero.image} label="Photo of the coach" className="t-pr-coach-img" />
          <div>
            <H h={spec.coach.headline} />
            <p className="t-p">{spec.coach.body}</p>
            <div className="t-trust t-pr-trust"><span><Check />{spec.hero.perk}</span></div>
            <span className="t-btn t-btn-p">{spec.form.button}</span>
          </div>
        </div>
      </section>

      <footer className="t-foot t-pr-foot">
        <div className="t-wrap">
          <div className="t-legal">
            <span className="t-logo">{logo}</span>
            <span>{spec.footer.blurb}</span>
            <span>© {new Date().getFullYear()} {spec.brand.name} · Privacy</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
