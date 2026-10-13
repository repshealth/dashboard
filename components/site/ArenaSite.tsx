'use client';

import { useRef, useState, type CSSProperties } from 'react';
import type { Headline, SiteSpec } from '@/lib/site/spec';
import { Count, Logo, captureAttrs, Marquee, Phone, Pic, Stars, faceVars, onColour, screensOf, spot, statsOf, useCapture, useCycle, useReveal, type Faces } from './kit';

/**
 * "Arena": black, loud and athletic, after Centr, Ladder and the Physique X site. Huge stacked
 * capitals with a highlighter bar, a moving light grid behind the hero, a stage of phones whose
 * screens scroll, a numbered feature list beside a phone, poster-style programmes and a
 * before and after slider. Driven by the same SiteSpec as every other design.
 */
const FACES: Faces = {
  bold: { display: "'Archivo', 'Arial Black', sans-serif", stretch: '100%', weight: 900, tt: 'uppercase', accent: "'Archivo', sans-serif" },
  modern: { display: "'Archivo', 'Arial Narrow', sans-serif", stretch: '62%', weight: 800, tt: 'uppercase', accent: "'Archivo', sans-serif" },
  elegant: { display: "'Fraunces', Georgia, serif", stretch: '100%', weight: 700, tt: 'none', accent: "'Fraunces', Georgia, serif" },
};

const H = ({ h, as: Tag = 'h2', className = '' }: { h: Headline; as?: 'h1' | 'h2'; className?: string }) => (
  <Tag className={`ar-h ${className}`}>
    {h.light && <span className="ar-l1">{h.light}</span>}
    {h.bold && <span className="ar-l2"><mark>{h.bold}</mark></span>}
  </Tag>
);

/** Drag to compare the before and after photos. */
function Compare({ before, after }: { before?: string; after?: string }) {
  const [at, setAt] = useState(50);
  return (
    <div className="ar-cmp" data-compare="" style={{ '--at': `${at}%` } as CSSProperties}>
      <Pic src={after} label="After photo" className="ar-cmp-after" />
      <div className="ar-cmp-before"><Pic src={before} label="Before photo" /></div>
      <span className="ar-cmp-tag b">Before</span><span className="ar-cmp-tag a">After</span>
      <i className="ar-cmp-line" aria-hidden="true"><b /></i>
      <input type="range" min={0} max={100} value={at} aria-label="Compare before and after" onChange={(e) => setAt(Number(e.target.value))} />
    </div>
  );
}

export default function ArenaSite({ spec, formEndpoint }: { spec: SiteSpec; formEndpoint?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const vars = {
    '--p': spec.brand.primary, '--s': spec.brand.secondary, '--on-p': onColour(spec.brand.primary), '--on-s': onColour(spec.brand.secondary),
    ...faceVars(FACES[spec.brand.font] ?? FACES.bold),
  } as CSSProperties;

  const features = spec.features.items.slice(0, 6);
  const names = features.map((x) => x.title);
  const screens = screensOf(spec);
  const cycle = useCycle(features.length, 4500);
  const cap = useCapture(spec, formEndpoint);
  const [faq, setFaq] = useState(0);

  const stats = statsOf(spec);
  const plans = spec.pricing.plans.slice(0, 3);
  const reviews = spec.results?.reviews ?? [];
  const story = spec.results?.stories[0];
  const cta = spec.hero.ctaPrimary;
  const stage = Array.from({ length: 5 }, (_, i) => screens.length ? screens[i % screens.length] : undefined);

  return (
    <div ref={root} className="site sk ar" style={vars}>
      <div className="ar-ticker"><Marquee speed={30}>{spec.band.map((b, i) => <span key={i} className="ar-ticker-i">{b}</span>)}</Marquee></div>

      <nav className="ar-nav" aria-label={`${spec.brand.name} menu`}>
        <span className="ar-logo"><Logo spec={spec} /></span>
        <div className="ar-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}</div>
        <span className="ar-btn ar-btn-sm">{spec.nav.cta}</span>
      </nav>

      {/* Hero, over a light grid that moves towards you */}
      <section className="ar-hero">
        <div className="ar-grid-bg" aria-hidden="true"><i /><b /><b /></div>
        <div className="ar-wrap ar-hero-row">
          <div className="ar-hero-copy">
            {spec.hero.proof && <div className="ar-proof"><Stars /><span>{spec.hero.proof}</span></div>}
            <H h={spec.hero.headline} as="h1" className="ar-h1" />
            <p className="ar-sub">{spec.hero.sub}</p>
            <div className="ar-ctas">
              <span className="ar-btn">{cta}<b aria-hidden="true">→</b></span>
              <span className="ar-btn ar-btn-line">{spec.hero.ctaSecondary}</span>
            </div>
            <p className="ar-small">{spec.hero.smallPrint}</p>
          </div>
          <div className="ar-hero-art">
            <div className="ar-hero-photo"><Pic src={spec.hero.image} label="Hero photo of the coach" /></div>
            <div className="ar-hero-phone"><Phone src={screens[0]} label="App screen" items={names} speed={14} /></div>
            <div className="ar-chip ar-chip-a"><b>{stats[0]?.value ?? '7 days'}</b><span>{stats[0]?.label ?? 'free to try'}</span></div>
            <div className="ar-chip ar-chip-b"><Stars /><span>{spec.hero.proof ? 'Rated by members' : 'Train anywhere'}</span></div>
          </div>
        </div>
      </section>

      {/* Numbers */}
      {stats.length > 0 && (
        <section className="ar-stats" aria-label="At a glance">
          <div className="ar-wrap ar-stats-row">
            {stats.map((s) => <div key={s.label} className="ar-stat sk-rv"><b><Count value={s.value} /></b><span>{s.label}</span></div>)}
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="ar-sec">
        <div className="ar-wrap ar-split">
          <div className="ar-frame sk-rv"><Pic src={spec.about.image} label="Photo for the intro section" className="ar-about-img" /></div>
          <div className="sk-rv d1">
            <p className="ar-kicker">{spec.about.eyebrow}</p>
            <H h={spec.about.headline} />
            <p className="ar-p ar-lead">{spec.about.p1}</p>
            <p className="ar-p">{spec.about.p2}</p>
            <span className="ar-btn">{cta}<b aria-hidden="true">→</b></span>
          </div>
        </div>
      </section>

      {/* The app: a stage of phones, every screen scrolling */}
      <section id="app" className="ar-sec ar-app">
        <div className="ar-wrap">
          <div className="ar-head sk-rv">
            <H h={spec.app?.headline ?? spec.features.headline} />
            <p className="ar-intro">{spec.app?.intro ?? spec.features.intro}</p>
          </div>
        </div>
        <div className="ar-stage">
          <div className="ar-spot" aria-hidden="true" />
          {stage.map((src, i) => (
            <div key={i} className={`ar-stage-p p${i}`}><Phone src={src} label="App screen" items={i % 2 ? [...names].reverse() : names} tone={i} speed={12 + i * 3} /></div>
          ))}
        </div>
        {spec.app && spec.app.pills.length > 0 && (
          <Marquee className="ar-pills" speed={34}>{spec.app.pills.map((p) => <span key={p} className="ar-pill">{p}</span>)}</Marquee>
        )}
      </section>

      {/* Numbered features beside a phone that follows along */}
      <section id="inside" className="ar-sec ar-feats" data-cycle="4500" onMouseLeave={cycle.release}>
        <div className="ar-wrap ar-feats-grid">
          <div>
            <p className="ar-kicker">{spec.features.eyebrow}</p>
            <H h={spec.features.headline} />
            <ol className="ar-list">
              {features.map((it, i) => (
                <li key={it.title}>
                  <button type="button" data-ci={i} className={`ar-row${i === cycle.active ? ' on' : ''}`} aria-expanded={i === cycle.active}
                    onMouseEnter={() => cycle.pick(i)} onFocus={() => cycle.pick(i)} onClick={() => cycle.pick(i)}>
                    <span className="ar-row-n">{String(i + 1).padStart(2, '0')}</span>
                    <span className="ar-row-t">{it.title}</span>
                    <i aria-hidden="true" />
                    <span className="ar-row-b"><span>{it.body}</span></span>
                    <span className="ar-row-bar" aria-hidden="true"><i key={`${cycle.active}-${cycle.held}`} /></span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
          <div className="ar-feat-phone">
            <div className="ar-ring" aria-hidden="true" />
            {features.map((it, i) => (
              <div key={it.title} data-cs={i} className={`ar-slide${i === cycle.active ? ' on' : ''}`} aria-hidden={i !== cycle.active}>
                <Phone src={screens.length ? screens[i % screens.length] : undefined} label={`${it.title} in the app`} items={[it.title, ...names.filter((n) => n !== it.title)]} tone={i} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Programmes as posters */}
      {spec.programmes && spec.programmes.items.length > 0 && (
        <section id="programmes" className="ar-sec">
          <div className="ar-wrap">
            <div className="ar-head sk-rv">
              <H h={spec.programmes.headline} />
              <p className="ar-intro">{spec.programmes.intro}</p>
            </div>
            <div className="ar-posters">
              {spec.programmes.items.map((p, i) => (
                <article key={p.name} className={`ar-poster sk-rv d${i % 3}`} data-spot="" onMouseMove={spot}>
                  <Pic src={p.image} label={`${p.name} photo`} className="ar-poster-img" />
                  {p.tag && <span className="ar-tag">{p.tag}</span>}
                  <div className="ar-poster-body">
                    <p className="ar-meta">{p.meta}</p>
                    <h3>{p.name}</h3>
                    <div className="ar-poster-more">
                      <p>{p.body}</p>
                      <div className="ar-poster-foot"><b>{p.price}</b><span className="ar-btn ar-btn-sm">Get programme</span></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {spec.results && (story || reviews.length > 0) && (
        <section id="results" className="ar-sec ar-results">
          <div className="ar-wrap">
            <div className="ar-head sk-rv">
              <H h={spec.results.headline} />
              <p className="ar-intro">{spec.results.intro}</p>
            </div>
            {story && (
              <div className="ar-story sk-rv">
                <Compare before={story.before} after={story.after} />
                <blockquote className="ar-story-q"><Stars /><p>&ldquo;{story.quote}&rdquo;</p><cite>{story.name} · {story.label}</cite></blockquote>
              </div>
            )}
          </div>
          {reviews.length > 0 && (
            <Marquee className="ar-reviews" speed={46}>
              {reviews.map((r, i) => (
                <figure key={i} className="ar-review" data-spot="" onMouseMove={spot}><Stars /><blockquote>&ldquo;{r.quote}&rdquo;</blockquote><figcaption>{r.name} · {r.detail}</figcaption></figure>
              ))}
            </Marquee>
          )}
        </section>
      )}

      {/* Coach */}
      <section id="coach" className="ar-sec ar-coach">
        <div className="ar-coach-word" aria-hidden="true">{spec.coach.headline.bold || spec.brand.name}</div>
        <div className="ar-wrap ar-split ar-split-r">
          <div className="sk-rv">
            <p className="ar-kicker">{spec.coach.eyebrow}</p>
            <H h={spec.coach.headline} />
            <p className="ar-p ar-lead">{spec.coach.p1}</p>
            <p className="ar-p">{spec.coach.p2}</p>
            {spec.coach.stats.length > 0 && (
              <div className="ar-coach-stats">{spec.coach.stats.slice(0, 3).map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
            )}
            {spec.coach.instagram && <span className="ar-btn ar-btn-line">Follow {spec.coach.instagram}</span>}
          </div>
          <div className="ar-frame ar-coach-art sk-rv d1">
            <Pic src={spec.coach.image} label="Photo of the coach" className="ar-coach-img" />
            {spec.coach.badge && <span className="ar-badge">{spec.coach.badge}</span>}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="ar-sec ar-pricing">
        <div className="ar-wrap">
          <div className="ar-head ar-head-c sk-rv">
            <H h={spec.pricing.headline} />
            <p className="ar-intro">{spec.pricing.sub}</p>
          </div>
          {plans.length ? (
            <div className={`ar-plans n${plans.length}`}>
              {plans.map((p, i) => (
                <div key={p.name} className={`ar-plan sk-rv d${i}${p.popular ? ' pop' : ''}`} data-spot="" onMouseMove={spot}>
                  {p.popular && <span className="ar-plan-tag">Most popular</span>}
                  <p className="ar-plan-name">{p.name}</p>
                  <p className="ar-price"><b>{p.price}</b><span>{p.period}</span></p>
                  {p.perDay && <p className="ar-perday">{p.perDay}</p>}
                  <span className={`ar-btn ar-btn-block${p.popular ? ' ar-btn-ink' : ''}`}>{cta}</span>
                  <p className="ar-plan-inc">{p.includes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="ar-plans n3 ar-plans-todo" role="note">
              {['Monthly', 'Quarterly', 'Annual'].map((n) => (
                <div key={n} className="ar-plan"><p className="ar-plan-name">{n}</p><p className="ar-price"><b>£–</b></p><p className="ar-plan-inc">Pricing is added in the REPS launch setup</p></div>
              ))}
            </div>
          )}
          {spec.pricing.trust.length > 0 && <div className="ar-trust">{spec.pricing.trust.map((t) => <span key={t}>✓ {t}</span>)}</div>}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="ar-sec ar-faq">
        <div className="ar-wrap ar-faq-grid">
          <div className="sk-rv">
            <H h={spec.faq.headline} />
            {spec.faq.email && <p className="ar-p">Still unsure? Email <b>{spec.faq.email}</b>.</p>}
          </div>
          <div>
            {spec.faq.items.map((it, i) => {
              const open = faq === i;
              return (
                <div key={i} data-faq="" className={`ar-q${open ? ' open' : ''}`}>
                  <button type="button" aria-expanded={open} onClick={() => setFaq(open ? -1 : i)}>
                    <span className="ar-q-n">{String(i + 1).padStart(2, '0')}</span><span>{it.q}</span><i aria-hidden="true" />
                  </button>
                  <div className="ar-a"><p>{it.a}</p></div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Closing */}
      <section id="guide" className="ar-final">
        <div className="ar-stripes" aria-hidden="true" />
        <div className="ar-wrap ar-final-grid">
          {spec.capture.off ? (
            <div className="ar-final-join">
              <H h={spec.hero.headline} />
              <p className="ar-sub">{spec.hero.smallPrint}</p>
              <span className="ar-btn ar-btn-ink">{cta}<b aria-hidden="true">→</b></span>
            </div>
          ) : (
            <>
              <div>
                <p className="ar-kicker">{spec.capture.eyebrow}</p>
                <H h={spec.capture.headline} />
                <p className="ar-sub">{spec.capture.body}</p>
              </div>
              <form className="ar-capture" onSubmit={cap.submit} {...captureAttrs(spec.slug, formEndpoint, { source: 'magnet', form: spec.capture.headline.bold, page: '/', thanks: 'Thanks! Check your inbox in a few minutes.', thanksClass: 'ar-thanks' })}>
                {cap.state === 'done' ? <p className="ar-thanks">Thanks! Check your inbox in a few minutes.</p> : (
                  <>
                    <label htmlFor={`ar-email-${spec.slug}`}>Your email</label>
                    <input id={`ar-email-${spec.slug}`} name="email" type="email" required placeholder="you@email.com" value={cap.email} onChange={(e) => cap.setEmail(e.target.value)} />
                    <button type="submit" className="ar-btn ar-btn-ink ar-btn-block" disabled={cap.state === 'sending'}>{spec.capture.button}</button>
                    <p className="ar-small" data-note="">{cap.state === 'error' ? 'That did not go through. Please try again.' : spec.capture.small}</p>
                  </>
                )}
              </form>
            </>
          )}
        </div>
        <Marquee className="ar-word" speed={24}>{[0, 1, 2].map((i) => <span key={i}>{spec.brand.name}<b aria-hidden="true">✦</b></span>)}</Marquee>
      </section>

      <footer className="ar-foot">
        <div className="ar-wrap ar-foot-row">
          <div className="ar-foot-brand"><span className="ar-logo"><Logo spec={spec} /></span><p>{spec.footer.blurb}</p></div>
          <div className="ar-foot-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}<span>Member login</span></div>
        </div>
        <div className="ar-wrap ar-legal"><span>© {new Date().getFullYear()} {spec.brand.name}</span><span>Terms · Privacy · Cookies</span></div>
      </footer>
    </div>
  );
}
