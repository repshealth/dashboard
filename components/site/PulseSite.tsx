'use client';

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { FontStyle, Headline, SiteSpec } from '@/lib/site/spec';

/**
 * "Pulse": the website design for new clients, after the app-launch sites REPS likes
 * (EvolveYou, Ladder, Sweat, Centr). Dark campaign hero with a moving glow in the brand
 * colours, phones whose screens scroll, a feature showcase that steps through the app,
 * and marquees. Everything is driven by the same SiteSpec as Shape Up.
 */
const FACES: Record<FontStyle, { display: string; stretch: string; weight: number; tt: string }> = {
  bold: { display: "'Archivo', 'Arial Black', sans-serif", stretch: '118%', weight: 900, tt: 'none' },
  modern: { display: "'Archivo', 'Arial Narrow', sans-serif", stretch: '72%', weight: 800, tt: 'uppercase' },
  elegant: { display: "'Fraunces', Georgia, serif", stretch: '100%', weight: 600, tt: 'none' },
};

const H = ({ h, as: Tag = 'h2', className = '' }: { h: Headline; as?: 'h1' | 'h2'; className?: string }) => (
  <Tag className={`pz-h ${className}`}>
    {h.light && <span className="pz-l1">{h.light}</span>}
    {h.bold && <span className="pz-l2">{h.bold}</span>}
  </Tag>
);

function Pic({ src, label, className = '' }: { src?: string; label: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img className={`pz-img ${className}`} src={src} alt={label} />;
  return <div className={`pz-img pz-ph ${className}`} role="img" aria-label={`${label} (to be added)`}><span>{label}</span></div>;
}

/**
 * A phone whose screen slowly scrolls through a screenshot. Without screenshots it shows a
 * stand-in screen built from the feature names, so drafts still feel like an app.
 */
function Phone({ src, label, items, tone = 0 }: { src?: string; label: string; items: string[]; tone?: number }) {
  return (
    <div className="pz-phone">
      <div className="pz-notch" aria-hidden="true" />
      <div className="pz-screen">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="pz-scroll" src={src} alt={label} />
        ) : (
          <div className="pz-scroll pz-mock" role="img" aria-label={`${label} (screenshot to be added)`}>
            <div className="pz-mock-top"><span /><b>Today</b><span /></div>
            <div className="pz-mock-ring" style={{ '--n': `${62 + tone * 9}%` } as CSSProperties}><b>{62 + tone * 9}%</b><small>this week</small></div>
            {[...items, ...items].slice(0, 8).map((t, i) => (
              <div key={i} className={`pz-mock-card${i % 3 === 0 ? ' hi' : ''}`}>
                <i />
                <div><b>{t}</b><small>{['20 min', 'Day 3', 'Ready', '4 of 6'][i % 4]}</small></div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Stars() {
  return <span className="pz-stars" aria-label="5 stars">★★★★★</span>;
}

/** "2,000+" counts up from 0 the first time it scrolls into view. */
function Count({ value }: { value: string }) {
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
function Marquee({ children, className = '', reverse }: { children: ReactNode; className?: string; reverse?: boolean }) {
  return (
    <div className={`pz-marquee ${className}`}>
      <div className={`pz-track${reverse ? ' rev' : ''}`}>
        <div className="pz-run">{children}</div>
        <div className="pz-run" aria-hidden="true">{children}</div>
      </div>
    </div>
  );
}

export default function PulseSite({ spec, formEndpoint }: { spec: SiteSpec; formEndpoint?: string }) {
  const f = FACES[spec.brand.font] ?? FACES.bold;
  const vars = {
    '--p': spec.brand.primary, '--s': spec.brand.secondary, '--ink': spec.brand.ink,
    '--fd': f.display, '--fs': f.stretch, '--fw': f.weight, '--tt': f.tt,
  } as CSSProperties;

  const features = spec.features.items.slice(0, 6);
  const featureNames = features.map((x) => x.title);
  const screens = spec.app?.screens.length ? spec.app.screens : spec.hero.screens;
  const [active, setActive] = useState(0);
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held || features.length < 2) return;
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => setActive((i) => (i + 1) % features.length), 4200);
    return () => clearInterval(t);
  }, [held, features.length]);

  const [faqOpen, setFaqOpen] = useState(0);
  const [email, setEmail] = useState('');
  const [captured, setCaptured] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const capture = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEndpoint) { setCaptured('done'); return; }
    setCaptured('sending');
    try {
      const res = await fetch(formEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client: spec.slug, email, source: 'magnet', form: spec.capture.headline.bold, page: '/' }) });
      setCaptured(res.ok ? 'done' : 'error');
    } catch { setCaptured('error'); }
  };

  const logo = spec.brand.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="pz-logo-img" src={spec.brand.logoUrl} alt={spec.brand.name} />
    : <span className="pz-logo-text">{spec.brand.name}</span>;
  const reviews = spec.results?.reviews ?? [];
  const story = spec.results?.stories[0];
  const plans = spec.pricing.plans.slice(0, 3);
  const cta = spec.hero.ctaPrimary;

  return (
    <div className="site pz" style={vars}>
      {/* Offer bar */}
      <div className="pz-promo">
        <Marquee>{spec.band.map((b, i) => <span key={i} className="pz-promo-i">{b}</span>)}</Marquee>
      </div>

      {/* Nav */}
      <nav className="pz-nav" aria-label={`${spec.brand.name} menu`}>
        <span className="pz-logo">{logo}</span>
        <div className="pz-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}</div>
        <span className="pz-btn pz-btn-sm">{spec.nav.cta}</span>
      </nav>

      {/* Hero */}
      <section className="pz-hero pz-night">
        <div className="pz-aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="pz-wrap pz-hero-grid">
          <div className="pz-hero-copy">
            {spec.hero.proof && <div className="pz-proof"><Stars /><span>{spec.hero.proof}</span></div>}
            <H h={spec.hero.headline} as="h1" className="pz-h1" />
            <p className="pz-sub">{spec.hero.sub}</p>
            <div className="pz-ctas">
              <span className="pz-btn">{cta}</span>
              <span className="pz-btn pz-btn-ghost">{spec.hero.ctaSecondary}</span>
            </div>
            <p className="pz-small">{spec.hero.smallPrint}</p>
            <div className="pz-stores" aria-label="Available on iPhone and Android">
              <span className="pz-store"><small>Download on the</small>App Store</span>
              <span className="pz-store"><small>Get it on</small>Google Play</span>
            </div>
          </div>
          <div className="pz-hero-art">
            <Pic src={spec.hero.image} label="Hero photo of the coach" className="pz-hero-photo" />
            <div className="pz-hero-phones">
              <div className="pz-tilt-a"><Phone src={screens[0]} label="App screen" items={featureNames} /></div>
              <div className="pz-tilt-b"><Phone src={screens[1] ?? screens[0]} label="App screen" items={[...featureNames].reverse()} tone={2} /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Highlights */}
      <Marquee className="pz-band">{spec.band.map((b, i) => <span key={i} className="pz-band-i">{b}<b aria-hidden="true">✦</b></span>)}</Marquee>

      {/* Numbers */}
      {spec.about.stats.length > 0 && (
        <section className="pz-stats" aria-label="At a glance">
          <div className="pz-wrap pz-stats-row">
            {spec.about.stats.map((s) => (
              <div key={s.label} className="pz-stat"><b><Count value={s.value} /></b><span>{s.label}</span></div>
            ))}
            {spec.coach.stats.slice(0, 4 - spec.about.stats.length).map((s) => (
              <div key={s.label} className="pz-stat"><b><Count value={s.value} /></b><span>{s.label}</span></div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="pz-sec pz-about">
        <div className="pz-wrap pz-split">
          <div>
            <p className="pz-kicker">{spec.about.eyebrow}</p>
            <H h={spec.about.headline} />
            <p className="pz-p pz-lead">{spec.about.p1}</p>
            <p className="pz-p">{spec.about.p2}</p>
            <span className="pz-btn">{cta}</span>
          </div>
          <div className="pz-zoom"><Pic src={spec.about.image} label="Photo for the intro section" className="pz-about-img" /></div>
        </div>
      </section>

      {/* Feature showcase: the phone follows the feature you're on */}
      <section id="inside" className="pz-sec pz-show pz-night" onMouseLeave={() => setHeld(false)}>
        <div className="pz-aurora pz-aurora-soft" aria-hidden="true"><i /><i /></div>
        <div className="pz-wrap">
          <div className="pz-head">
            <H h={spec.features.headline} />
            <p className="pz-intro">{spec.features.intro}</p>
          </div>
          <div className="pz-show-grid">
            <ol className="pz-feats">
              {features.map((it, i) => (
                <li key={it.title}>
                  <button type="button" className={`pz-feat${i === active ? ' on' : ''}`} aria-pressed={i === active}
                    onMouseEnter={() => { setActive(i); setHeld(true); }} onFocus={() => { setActive(i); setHeld(true); }} onClick={() => { setActive(i); setHeld(true); }}>
                    <span className="pz-feat-t">{it.title}</span>
                    <span className="pz-feat-b">{it.body}</span>
                    <span className="pz-feat-bar" aria-hidden="true"><i key={`${active}-${held}`} /></span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="pz-show-phone">
              {features.map((it, i) => (
                <div key={it.title} className={`pz-show-slide${i === active ? ' on' : ''}`} aria-hidden={i !== active}>
                  <Phone src={screens.length ? screens[i % screens.length] : undefined} label={`${it.title} in the app`} items={[it.title, ...featureNames.filter((n) => n !== it.title)]} tone={i % 4} />
                </div>
              ))}
            </div>
          </div>
          {spec.app && spec.app.pills.length > 0 && (
            <div className="pz-pills">{spec.app.pills.map((p) => <span key={p} className="pz-pill">{p}</span>)}</div>
          )}
        </div>
      </section>

      {/* Programmes */}
      {spec.programmes && spec.programmes.items.length > 0 && (
        <section id="programmes" className="pz-sec pz-progs">
          <div className="pz-wrap">
            <div className="pz-head">
              <H h={spec.programmes.headline} />
              <p className="pz-intro">{spec.programmes.intro}</p>
            </div>
            <div className="pz-prog-row">
              {spec.programmes.items.map((p) => (
                <article key={p.name} className="pz-prog">
                  <div className="pz-zoom"><Pic src={p.image} label={`${p.name} photo`} className="pz-prog-img" /></div>
                  {p.tag && <span className="pz-tag">{p.tag}</span>}
                  <div className="pz-prog-body">
                    <p className="pz-meta">{p.meta}</p>
                    <h3>{p.name}</h3>
                    <p>{p.body}</p>
                    <div className="pz-prog-foot"><b>{p.price}</b><span className="pz-btn pz-btn-sm">Get programme</span></div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {spec.results && (story || reviews.length > 0) && (
        <section id="results" className="pz-sec pz-results">
          <div className="pz-wrap">
            <div className="pz-head">
              <H h={spec.results.headline} />
              <p className="pz-intro">{spec.results.intro}</p>
            </div>
            {story && (
              <div className="pz-story">
                <div className="pz-ba"><Pic src={story.before} label="Before photo" /><span>Before</span></div>
                <div className="pz-ba"><Pic src={story.after} label="After photo" /><span>After</span></div>
                <blockquote className="pz-story-q"><Stars /><p>&ldquo;{story.quote}&rdquo;</p><cite>{story.name} · {story.label}</cite></blockquote>
              </div>
            )}
          </div>
          {reviews.length > 0 && (
            <Marquee className="pz-reviews">
              {reviews.map((r, i) => (
                <figure key={i} className="pz-review"><Stars /><blockquote>&ldquo;{r.quote}&rdquo;</blockquote><figcaption>{r.name} · {r.detail}</figcaption></figure>
              ))}
            </Marquee>
          )}
        </section>
      )}

      {/* Coach */}
      <section id="coach" className="pz-sec pz-coach">
        <div className="pz-wrap pz-split pz-split-r">
          <div className="pz-coach-art">
            <div className="pz-zoom"><Pic src={spec.coach.image} label="Photo of the coach" className="pz-coach-img" /></div>
            {spec.coach.badge && <span className="pz-badge">{spec.coach.badge}</span>}
          </div>
          <div>
            <p className="pz-kicker">{spec.coach.eyebrow}</p>
            <H h={spec.coach.headline} />
            <p className="pz-p pz-lead">{spec.coach.p1}</p>
            <p className="pz-p">{spec.coach.p2}</p>
            {spec.coach.instagram && <span className="pz-btn pz-btn-ghost-dark">Follow {spec.coach.instagram}</span>}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="pz-sec pz-pricing">
        <div className="pz-wrap">
          <div className="pz-head pz-head-c">
            <H h={spec.pricing.headline} />
            <p className="pz-intro">{spec.pricing.sub}</p>
          </div>
          {plans.length ? (
            <div className={`pz-plans n${plans.length}`}>
              {plans.map((p) => (
                <div key={p.name} className={`pz-plan${p.popular ? ' pop' : ''}`}>
                  {p.popular && <span className="pz-plan-tag">Most popular</span>}
                  <p className="pz-plan-name">{p.name}</p>
                  <p className="pz-price"><b>{p.price}</b><span>{p.period}</span></p>
                  {p.perDay && <p className="pz-perday">{p.perDay}</p>}
                  <span className={`pz-btn pz-btn-block${p.popular ? '' : ' pz-btn-ghost-dark'}`}>{cta}</span>
                  <p className="pz-plan-inc">{p.includes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="pz-plans n3 pz-plans-todo" role="note">
              {['Monthly', 'Quarterly', 'Annual'].map((n) => (
                <div key={n} className="pz-plan"><p className="pz-plan-name">{n}</p><p className="pz-price"><b>£–</b></p><p className="pz-plan-inc">Pricing is added in the REPS launch setup</p></div>
              ))}
            </div>
          )}
          {spec.pricing.trust.length > 0 && <div className="pz-trust">{spec.pricing.trust.map((t) => <span key={t}>✓ {t}</span>)}</div>}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="pz-sec pz-faq">
        <div className="pz-wrap pz-faq-grid">
          <div>
            <H h={spec.faq.headline} />
            {spec.faq.email && <p className="pz-p">Still unsure? Email <b>{spec.faq.email}</b>.</p>}
          </div>
          <div className="pz-faq-list">
            {spec.faq.items.map((it, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className={`pz-q${open ? ' open' : ''}`}>
                  <button type="button" aria-expanded={open} onClick={() => setFaqOpen(open ? -1 : i)}>
                    <span>{it.q}</span><i aria-hidden="true" />
                  </button>
                  <div className="pz-a"><p>{it.a}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section id="guide" className="pz-final pz-night">
        <div className="pz-aurora" aria-hidden="true"><i /><i /><i /></div>
        <div className="pz-wrap pz-final-grid">
          {spec.capture.off ? (
            <div className="pz-final-join">
              <H h={spec.hero.headline} />
              <p className="pz-sub">{spec.hero.smallPrint}</p>
              <span className="pz-btn">{cta}</span>
            </div>
          ) : (
            <>
              <div>
                <p className="pz-kicker">{spec.capture.eyebrow}</p>
                <H h={spec.capture.headline} />
                <p className="pz-sub">{spec.capture.body}</p>
              </div>
              <form className="pz-capture" onSubmit={capture}>
                {captured === 'done' ? <p className="pz-thanks">Thanks! Check your inbox in a few minutes.</p> : (
                  <>
                    <label htmlFor={`pz-email-${spec.slug}`}>Your email</label>
                    <div className="pz-capture-row">
                      <input id={`pz-email-${spec.slug}`} type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <button type="submit" className="pz-btn" disabled={captured === 'sending'}>{spec.capture.button}</button>
                    </div>
                    <p className="pz-small">{captured === 'error' ? 'That did not go through. Please try again.' : spec.capture.small}</p>
                  </>
                )}
              </form>
            </>
          )}
        </div>
        <div className="pz-word" aria-hidden="true" style={{ fontSize: `${Math.min(17, 120 / Math.max(spec.brand.name.length, 5)).toFixed(1)}cqi` }}>{spec.brand.name}</div>
      </section>

      {/* Footer */}
      <footer className="pz-foot">
        <div className="pz-wrap pz-foot-row">
          <div className="pz-foot-brand"><span className="pz-logo">{logo}</span><p>{spec.footer.blurb}</p></div>
          <div className="pz-foot-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}<span>Member login</span></div>
        </div>
        <div className="pz-wrap pz-legal"><span>© {new Date().getFullYear()} {spec.brand.name}</span><span>Terms · Privacy · Cookies</span></div>
      </footer>
    </div>
  );
}
