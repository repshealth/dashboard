'use client';

import { useState, type CSSProperties, type FormEvent, type ReactNode } from 'react';
import type { FontStyle, Headline, SiteSpec } from '@/lib/site/spec';

/** Display and body faces per brand style. All are loaded from Google Fonts in the app layout. */
export const FONTS: Record<FontStyle, { display: string; body: string; lightWeight: number; lightStyle: string; upper: boolean }> = {
  bold: { display: "'Oswald', 'Arial Narrow', sans-serif", body: "'Poppins', 'Helvetica Neue', sans-serif", lightWeight: 300, lightStyle: 'normal', upper: true },
  modern: { display: "'Barlow Condensed', 'Arial Narrow', sans-serif", body: "'DM Sans', 'Helvetica Neue', sans-serif", lightWeight: 300, lightStyle: 'normal', upper: true },
  elegant: { display: "'DM Serif Display', Georgia, serif", body: "'Montserrat', 'Helvetica Neue', sans-serif", lightWeight: 400, lightStyle: 'italic', upper: false },
};

export const H = ({ h, as: Tag = 'h2', className = '' }: { h: Headline; as?: 'h1' | 'h2'; className?: string }) => (
  <Tag className={`t-h ${className}`}>
    {h.light && <span className="t-light">{h.light}</span>}
    {h.light && h.bold ? <br /> : null}
    {h.bold && <span className="t-bold">{h.bold}</span>}
  </Tag>
);

/** A photo, or a tidy branded placeholder naming what goes there. */
export function Pic({ src, label, className = '' }: { src?: string; label: string; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className={`t-img ${className}`} src={src} alt={label} />;
  }
  return <div className={`t-img t-ph ${className}`} role="img" aria-label={`${label} (to be added)`}><span>{label}</span></div>;
}

export function Phone({ src, label }: { src?: string; label: string }) {
  return <div className="t-phone"><Pic src={src} label={label} /></div>;
}

export const Spark = () => (
  <svg className="t-spark" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 0c1 6.5 5.5 11 12 12-6.5 1-11 5.5-12 12-1-6.5-5.5-11-12-12C6.5 11 11 6.5 12 0z" fill="currentColor" /></svg>
);
export const Check = () => (
  <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="8" fill="currentColor" /><path d="M4.5 8.2l2.3 2.3 4.7-4.8" stroke="#fff" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
);
const Stars = () => <span className="t-stars" aria-label="5 stars">★★★★★</span>;

function Section({ id, className = '', children }: { id?: string; className?: string; children: ReactNode }) {
  return <section id={id} className={`t-sec ${className}`}><div className="t-wrap">{children}</div></section>;
}

function SectionHead({ eyebrow, headline, intro }: { eyebrow: string; headline: Headline; intro?: string }) {
  return (
    <div className="t-head">
      <div>
        <div className="t-eyebrow">{eyebrow}</div>
        <H h={headline} />
      </div>
      {intro && <p className="t-intro">{intro}</p>}
    </div>
  );
}

export default function TemplateSite({
  spec,
  formEndpoint,
}: {
  spec: SiteSpec;
  /** Where the starter guide form posts. Left out in previews, where it only shows the thank-you state. */
  formEndpoint?: string;
}) {
  const f = FONTS[spec.brand.font] ?? FONTS.bold;
  const vars = {
    '--p': spec.brand.primary,
    '--s': spec.brand.secondary,
    '--g': spec.brand.ground,
    '--ink': spec.brand.ink,
    '--fd': f.display,
    '--fb': f.body,
    '--lw': f.lightWeight,
    '--ls': f.lightStyle,
    '--tt': f.upper ? 'uppercase' : 'none',
  } as CSSProperties;

  const [faqOpen, setFaqOpen] = useState(0);
  const [story, setStory] = useState(0);
  const [captured, setCaptured] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [email, setEmail] = useState('');

  const capture = async (e: FormEvent) => {
    e.preventDefault();
    if (!formEndpoint) { setCaptured('done'); return; }
    setCaptured('sending');
    try {
      const res = await fetch(formEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: spec.slug, email, source: 'magnet', form: spec.capture.headline.bold, page: '/' }),
      });
      setCaptured(res.ok ? 'done' : 'error');
    } catch {
      setCaptured('error');
    }
  };

  const logo = spec.brand.logoUrl
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="t-logo-img" src={spec.brand.logoUrl} alt={spec.brand.name} />
    : <span className="t-logo-text">{spec.brand.name}</span>;

  const stories = spec.results?.stories ?? [];
  const st = stories[story % Math.max(stories.length, 1)];

  return (
    <div className="site tpl" style={vars}>
      {/* Nav */}
      <div className="t-navwrap">
        <nav className="t-nav" aria-label={`${spec.brand.name} menu`}>
          <span className="t-logo">{logo}</span>
          <div className="t-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}</div>
          <span className="t-btn t-btn-s">{spec.nav.cta}</span>
        </nav>
      </div>

      {/* Hero */}
      <section className="t-hero">
        <div className="t-wrap t-hero-grid">
          <div className="t-hero-copy">
            {spec.hero.proof && <div className="t-proof"><Stars /><span>{spec.hero.proof}</span></div>}
            <H h={spec.hero.headline} as="h1" className="t-h1" />
            <p className="t-sub">{spec.hero.sub}</p>
            <div className="t-ctas">
              <span className="t-btn t-btn-p">{spec.hero.ctaPrimary}</span>
              <span className="t-btn t-btn-o">{spec.hero.ctaSecondary} ↓</span>
            </div>
            <div className="t-small">{spec.hero.smallPrint}</div>
          </div>
          <div className="t-hero-art">
            <Pic src={spec.hero.image} label="Hero photo of the coach" className="t-hero-img" />
            {spec.hero.screens.length > 0 && (
              <div className="t-hero-phones">
                {spec.hero.screens.slice(0, 2).map((s, i) => <Phone key={i} src={s} label="App screen" />)}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Rotated band */}
      {spec.band.length > 0 && (
        <div className="t-bandzone" aria-label="Highlights">
          <div className="t-band t-band-back" aria-hidden="true" />
          <div className="t-band t-band-front">
            <div className="t-band-row">
              {[...spec.band, ...spec.band].map((b, i) => (
                <span key={i} className="t-band-item">{b}<Spark /></span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* About */}
      <Section id="about" className="t-about">
        <div className="t-split">
          <div>
            <div className="t-eyebrow">{spec.about.eyebrow}</div>
            <H h={spec.about.headline} />
            <p className="t-p t-strong">{spec.about.p1}</p>
            <p className="t-p t-muted">{spec.about.p2}</p>
            <div className="t-stats">
              {spec.about.stats.map((s) => (
                <div key={s.label}><div className="t-stat-v">{s.value}</div><div className="t-stat-l">{s.label}</div></div>
              ))}
            </div>
          </div>
          <Pic src={spec.about.image} label="Photo for the intro section" className="t-about-img" />
        </div>
      </Section>

      {/* Features */}
      <div className="t-curve t-curve-p" aria-hidden="true" />
      <Section id="inside" className="t-features">
        <SectionHead eyebrow={spec.features.eyebrow} headline={spec.features.headline} intro={spec.features.intro} />
        <div className="t-grid3">
          {spec.features.items.slice(0, 6).map((it, i, arr) => {
            const last = i === arr.length - 1 && arr.length === 6;
            return (
              <div key={it.title} className={`t-card t-feat${last ? ' t-feat-hl' : ''}`}>
                <span className="t-num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="t-card-t">{it.title}</h3>
                <p className="t-card-b">{it.body}</p>
                {last && <span className="t-btn t-btn-s t-btn-sm">{spec.features.cta}</span>}
              </div>
            );
          })}
        </div>
      </Section>

      {/* App */}
      {spec.app && (
        <Section id="app" className="t-app">
          <SectionHead eyebrow={spec.app.eyebrow} headline={spec.app.headline} intro={spec.app.intro} />
          {spec.app.screens.length > 0 && (
            <div className="t-screens">
              {spec.app.screens.slice(0, 5).map((s, i) => <Phone key={i} src={s} label="App screen" />)}
            </div>
          )}
          {spec.app.pills.length > 0 && (
            <div className="t-pills">
              {spec.app.pills.map((p, i) => <span key={p} className={`t-pill${i % 3 === 1 ? ' t-pill-t' : ''}`}>{p}</span>)}
            </div>
          )}
        </Section>
      )}

      {/* Pricing */}
      <div className="t-curve t-curve-s" aria-hidden="true" />
      <Section id="pricing" className="t-pricing">
        <div className="t-center">
          <div className="t-eyebrow">{spec.pricing.eyebrow}</div>
          <H h={spec.pricing.headline} />
          <p className="t-intro t-intro-c">{spec.pricing.sub}</p>
        </div>
        <div className={`t-plans t-plans-${Math.min(spec.pricing.plans.length, 3)}`}>
          {spec.pricing.plans.slice(0, 3).map((p) => (
            <div key={p.name} className={`t-plan${p.popular ? ' t-plan-pop' : ''}`}>
              {p.popular && <span className="t-poptag">Most popular</span>}
              <Pic src={p.image} label={`${p.name} plan photo`} className="t-plan-img" />
              <div className="t-plan-body">
                <div className="t-plan-name">{p.name}</div>
                <div className="t-price"><span className="t-price-v">{p.price}</span><span className="t-price-p">{p.period}</span></div>
                {p.perDay && <span className="t-perday">{p.perDay}</span>}
                <span className={`t-btn t-btn-block ${p.popular ? 't-btn-w' : 't-btn-o'}`}>{spec.hero.ctaPrimary}</span>
                <p className="t-plan-inc">{p.includes}</p>
              </div>
            </div>
          ))}
        </div>
        {spec.pricing.trust.length > 0 && (
          <div className="t-trust">{spec.pricing.trust.map((t) => <span key={t}><Check />{t}</span>)}</div>
        )}
      </Section>

      {/* Programmes */}
      {spec.programmes && spec.programmes.items.length > 0 && (
        <Section id="programmes" className="t-progs">
          <SectionHead eyebrow={spec.programmes.eyebrow} headline={spec.programmes.headline} intro={spec.programmes.intro} />
          <div className="t-grid3">
            {spec.programmes.items.map((p) => (
              <div key={p.name} className="t-card t-prog">
                <div className="t-prog-imgwrap">
                  <Pic src={p.image} label={`${p.name} photo`} className="t-prog-img" />
                  {p.tag && <span className="t-tag">{p.tag}</span>}
                </div>
                <div className="t-prog-body">
                  <div className="t-meta">{p.meta}</div>
                  <h3 className="t-prog-name">{p.name}</h3>
                  <p className="t-card-b">{p.body}</p>
                  <div className="t-prog-foot">
                    <div><div className="t-prog-price">{p.price}</div><div className="t-meta-s">one time</div></div>
                    <span className="t-btn t-btn-p t-btn-sm">Get programme</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          {spec.programmes.banner && (
            <div className="t-banner">
              <p>{spec.programmes.banner}</p>
              <span className="t-btn t-btn-s">{spec.hero.ctaPrimary}</span>
            </div>
          )}
        </Section>
      )}

      {/* Results */}
      {spec.results && (stories.length > 0 || spec.results.reviews.length > 0) && (
        <Section id="results" className="t-results">
          <SectionHead eyebrow={spec.results.eyebrow} headline={spec.results.headline} intro={spec.results.intro} />
          {st && (
            <div className="t-story">
              <div className="t-story-pic">
                <Pic src={st.before} label="Before photo" />
                <span className="t-ba t-ba-b">Before</span>
                <span className="t-story-cap">{st.name} · {st.label}</span>
              </div>
              <div className="t-story-pic">
                <Pic src={st.after} label="After photo" />
                <span className="t-ba t-ba-a">After</span>
                <span className="t-story-cap">{st.name} · {st.label}</span>
              </div>
              <div className="t-story-quote">
                <Stars />
                <p>&ldquo;{st.quote}&rdquo;</p>
                <span className="t-story-who">{st.name} · {st.label}</span>
              </div>
              {stories.length > 1 && (
                <>
                  <button type="button" className="t-arrow t-arrow-l" aria-label="Previous story" onClick={() => setStory((story - 1 + stories.length) % stories.length)}>‹</button>
                  <button type="button" className="t-arrow t-arrow-r" aria-label="Next story" onClick={() => setStory((story + 1) % stories.length)}>›</button>
                </>
              )}
            </div>
          )}
          {spec.results.reviews.length > 0 && (
            <div className="t-grid3 t-reviews">
              {spec.results.reviews.slice(0, 3).map((r, i) => (
                <div key={i} className="t-card t-review">
                  <Stars />
                  <p>&ldquo;{r.quote}&rdquo;</p>
                  <span className="t-meta">{r.name} · {r.detail}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* Coach */}
      <Section id="coach" className="t-coach">
        <div className="t-split t-split-r">
          <div className="t-coach-art">
            <Pic src={spec.coach.image} label="Photo of the coach" className="t-coach-img" />
            {spec.coach.badge && <span className="t-sticker">{spec.coach.badge}</span>}
          </div>
          <div>
            <div className="t-eyebrow">{spec.coach.eyebrow}</div>
            <H h={spec.coach.headline} />
            <p className="t-p">{spec.coach.p1}</p>
            <p className="t-p">{spec.coach.p2}</p>
            <div className="t-stats t-stats-coach">
              {spec.coach.stats.map((s) => (
                <div key={s.label}><Spark /><div className="t-stat-v">{s.value}</div><div className="t-stat-l t-stat-l2">{s.label}</div></div>
              ))}
            </div>
            {spec.coach.instagram && <span className="t-btn t-btn-o t-btn-sm">Instagram {spec.coach.instagram}</span>}
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq" className="t-faq">
        <div className="t-faq-grid">
          <div>
            <div className="t-eyebrow">FAQ</div>
            <H h={spec.faq.headline} />
            {spec.faq.email && <p className="t-p t-muted">Still unsure? Email <b className="t-email">{spec.faq.email}</b> and you&apos;ll hear back within a day.</p>}
            <span className="t-btn t-btn-s">{spec.hero.ctaPrimary}</span>
          </div>
          <div className="t-faq-list">
            {spec.faq.items.map((it, i) => {
              const open = faqOpen === i;
              return (
                <div key={i} className={`t-faq-item${open ? ' t-open' : ''}`}>
                  <button type="button" className="t-faq-q" aria-expanded={open} onClick={() => setFaqOpen(open ? -1 : i)}>
                    <span className="t-faq-n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="t-faq-t">{it.q}</span>
                    <span className="t-faq-x" aria-hidden="true">{open ? '×' : '+'}</span>
                  </button>
                  {open && <p className="t-faq-a">{it.a}</p>}
                </div>
              );
            })}
          </div>
        </div>
      </Section>

      {/* Lead capture */}
      <section className="t-capture" id="guide">
        <div className="t-wave t-wave-top" aria-hidden="true" />
        <div className="t-wrap t-capture-grid">
          <div>
            <div className="t-eyebrow t-eyebrow-w">{spec.capture.eyebrow}</div>
            <H h={spec.capture.headline} className="t-h-w" />
            <p className="t-p t-p-w">{spec.capture.body}</p>
          </div>
          <form className="t-capture-card" onSubmit={capture}>
            {captured === 'done' ? (
              <p className="t-thanks">Thanks! Check your inbox in the next few minutes.</p>
            ) : (
              <>
                <label className="t-label" htmlFor={`t-email-${spec.slug}`}>Your email</label>
                <input id={`t-email-${spec.slug}`} className="t-input" type="email" required placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="submit" className="t-btn t-btn-s t-btn-block" disabled={captured === 'sending'}>{spec.capture.button}</button>
                <p className="t-capture-small">{captured === 'error' ? 'That did not go through. Please try again.' : spec.capture.small}</p>
              </>
            )}
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="t-foot">
        <div className="t-wrap">
          <div className="t-foot-top">
            <div className="t-foot-brand">
              <span className="t-logo">{logo}</span>
              <p>{spec.footer.blurb}</p>
            </div>
            <div className="t-foot-cols">
              <div><div className="t-foot-h">Membership</div><span>Pricing</span><span>What&apos;s inside</span><span>Member login</span></div>
              {spec.programmes && spec.programmes.items.length > 0 && (
                <div><div className="t-foot-h">Programmes</div>{spec.programmes.items.map((p) => <span key={p.name}>{p.name}</span>)}</div>
              )}
              <div><div className="t-foot-h">Help &amp; social</div><span>FAQ</span><span>Contact</span>{spec.coach.instagram && <span>Instagram</span>}</div>
            </div>
          </div>
          <div className="t-wordmark" aria-hidden="true" style={{ fontSize: `${Math.min(19, 128 / Math.max(spec.brand.name.length, 4)).toFixed(1)}cqi` }}>{spec.brand.name}</div>
          <div className="t-legal"><span>© {new Date().getFullYear()} {spec.brand.name}. All rights reserved.</span><span>Terms · Privacy · Cookies</span></div>
        </div>
      </footer>
    </div>
  );
}
