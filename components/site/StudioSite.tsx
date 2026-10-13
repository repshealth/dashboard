'use client';

import { useId, useRef, useState, type CSSProperties } from 'react';
import type { Headline, SiteSpec } from '@/lib/site/spec';
import { Count, Logo, Marquee, Phone, Pic, Stars, faceVars, onColour, screensOf, spot, statsOf, useCapture, useCycle, useReveal, type Faces } from './kit';

/**
 * "Studio": light, warm and editorial, after Lean with Lilly, Harriet Harper, Sweat, Shreddy
 * and EvolveYou. Italic serif accents, soft shapes that drift and change shape behind the hero,
 * arch-topped photos, features orbiting a phone, and a moving row of phones whose screens
 * scroll. Driven by the same SiteSpec as every other design.
 */
const FACES: Faces = {
  bold: { display: "'Archivo', 'Arial Black', sans-serif", stretch: '108%', weight: 800, tt: 'none', accent: "'Fraunces', Georgia, serif" },
  modern: { display: "'Archivo', 'Arial Narrow', sans-serif", stretch: '74%', weight: 700, tt: 'uppercase', accent: "'Fraunces', Georgia, serif" },
  elegant: { display: "'Fraunces', Georgia, serif", stretch: '100%', weight: 500, tt: 'none', accent: "'Fraunces', Georgia, serif" },
};

const H = ({ h, as: Tag = 'h2', className = '' }: { h: Headline; as?: 'h1' | 'h2'; className?: string }) => (
  <Tag className={`st-h ${className}`}>
    {h.light && <em className="st-l1">{h.light}</em>}
    {h.bold && <span className="st-l2">{h.bold}</span>}
  </Tag>
);

/** Text set around a slowly turning circle, with an arrow in the middle. */
function Spinner({ text }: { text: string }) {
  const t = `${text} · ${text} · `.toUpperCase();
  const id = `st-c${useId().replace(/[^\w-]/g, '')}`;
  return (
    <div className="st-spin" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <defs><path id={id} d="M60,60 m-46,0 a46,46 0 1,1 92,0 a46,46 0 1,1 -92,0" /></defs>
        <text><textPath href={`#${id}`} textLength="289">{t}</textPath></text>
      </svg>
      <b>↓</b>
    </div>
  );
}

const ICONS = ['✦', '◐', '❋', '✿', '◎', '☼'];

export default function StudioSite({ spec, formEndpoint }: { spec: SiteSpec; formEndpoint?: string }) {
  const root = useRef<HTMLDivElement>(null);
  useReveal(root);
  const vars = {
    '--p': spec.brand.primary, '--s': spec.brand.secondary, '--ink': spec.brand.ink,
    '--on-p': onColour(spec.brand.primary), '--on-s': onColour(spec.brand.secondary),
    ...faceVars(FACES[spec.brand.font] ?? FACES.bold),
  } as CSSProperties;

  const features = spec.features.items.slice(0, 6);
  const names = features.map((x) => x.title);
  const screens = screensOf(spec);
  const cycle = useCycle(features.length, 3800);
  const cap = useCapture(spec, formEndpoint);
  const [faq, setFaq] = useState(0);

  const stats = statsOf(spec);
  const plans = spec.pricing.plans.slice(0, 3);
  const reviews = spec.results?.reviews ?? [];
  const story = spec.results?.stories[0];
  const cta = spec.hero.ctaPrimary;
  const left = features.slice(0, Math.ceil(features.length / 2));
  const right = features.slice(Math.ceil(features.length / 2));
  const reel = Array.from({ length: 6 }, (_, i) => screens.length ? screens[i % screens.length] : undefined);

  const featCard = (i: number) => {
    const it = features[i];
    return (
      <button key={it.title} type="button" className={`st-fc${i === cycle.active ? ' on' : ''}`} aria-pressed={i === cycle.active}
        onMouseEnter={() => cycle.pick(i)} onFocus={() => cycle.pick(i)} onClick={() => cycle.pick(i)} onMouseMove={spot}>
        <span className="st-fc-i" aria-hidden="true">{ICONS[i % ICONS.length]}</span>
        <span className="st-fc-t">{it.title}</span>
        <span className="st-fc-b">{it.body}</span>
      </button>
    );
  };

  return (
    <div ref={root} className="site sk st" style={vars}>
      <div className="st-bar"><Marquee speed={42}>{spec.band.map((b, i) => <span key={i} className="st-bar-i">{b}</span>)}</Marquee></div>

      <nav className="st-nav" aria-label={`${spec.brand.name} menu`}>
        <div className="st-links">{spec.nav.links.slice(0, 3).map((l) => <span key={l}>{l}</span>)}</div>
        <span className="st-logo"><Logo spec={spec} /></span>
        <div className="st-nav-r">
          <div className="st-links">{spec.nav.links.slice(3).map((l) => <span key={l}>{l}</span>)}</div>
          <span className="st-btn st-btn-sm">{spec.nav.cta}</span>
        </div>
      </nav>

      {/* Hero over soft shapes that drift and change shape */}
      <section className="st-hero">
        <div className="st-blobs" aria-hidden="true"><i /><i /><i /></div>
        <div className="st-wrap st-hero-copy">
          {spec.hero.proof && <div className="st-proof"><span className="st-faces" aria-hidden="true"><i /><i /><i /></span><Stars /><span>{spec.hero.proof}</span></div>}
          <H h={spec.hero.headline} as="h1" className="st-h1" />
          <p className="st-sub">{spec.hero.sub}</p>
          <div className="st-ctas">
            <span className="st-btn">{cta}</span>
            <span className="st-btn st-btn-line">{spec.hero.ctaSecondary}</span>
          </div>
          <p className="st-small">{spec.hero.smallPrint}</p>
        </div>
        <div className="st-wrap st-hero-art">
          <div className="st-arch st-arch-l"><Pic src={spec.hero.image} label="Hero photo of the coach" /></div>
          <div className="st-hero-phone"><Phone src={screens[0]} label="App screen" items={names} speed={15} /></div>
          <div className="st-arch st-arch-r"><Pic src={spec.about.image} label="Second photo" /></div>
          {names.slice(0, 3).map((n, i) => <span key={n} className={`st-float f${i}`}>{ICONS[i]} {n}</span>)}
          <Spinner text={spec.brand.name} />
        </div>
      </section>

      <Marquee className="st-band" speed={44}>{spec.band.map((b, i) => <span key={i} className="st-band-i">{b}<b aria-hidden="true">✿</b></span>)}</Marquee>

      {/* Numbers in circles */}
      {stats.length > 0 && (
        <section className="st-stats" aria-label="At a glance">
          <div className="st-wrap st-stats-row">
            {stats.map((s, i) => (
              <div key={s.label} className={`st-stat sk-rv d${i}`}><div className="st-stat-c"><b><Count value={s.value} /></b></div><span>{s.label}</span></div>
            ))}
          </div>
        </section>
      )}

      {/* About */}
      <section id="about" className="st-sec">
        <div className="st-wrap st-split">
          <div className="st-about-art sk-rv">
            <div className="st-arch st-about-img"><Pic src={spec.about.image} label="Photo for the intro section" /></div>
            <span className="st-sticker">{spec.about.stats[0] ? `${spec.about.stats[0].value} ${spec.about.stats[0].label}` : spec.brand.name}</span>
          </div>
          <div className="sk-rv d1">
            <p className="st-kicker">{spec.about.eyebrow}</p>
            <H h={spec.about.headline} />
            <p className="st-p st-lead">{spec.about.p1}</p>
            <p className="st-p">{spec.about.p2}</p>
            <span className="st-btn">{cta}</span>
          </div>
        </div>
      </section>

      {/* Features around a phone */}
      <section id="inside" className="st-sec st-orbit" onMouseLeave={cycle.release}>
        <div className="st-wrap">
          <div className="st-head st-head-c sk-rv">
            <p className="st-kicker">{spec.features.eyebrow}</p>
            <H h={spec.features.headline} />
            <p className="st-intro">{spec.features.intro}</p>
          </div>
          <div className="st-orbit-grid">
            <div className="st-col">{left.map((_, k) => featCard(k))}</div>
            <div className="st-orbit-phone">
              <div className="st-halo" aria-hidden="true" />
              {features.map((it, i) => (
                <div key={it.title} className={`st-slide${i === cycle.active ? ' on' : ''}`} aria-hidden={i !== cycle.active}>
                  <Phone src={screens.length ? screens[i % screens.length] : undefined} label={`${it.title} in the app`} items={[it.title, ...names.filter((n) => n !== it.title)]} tone={i} />
                </div>
              ))}
            </div>
            <div className="st-col">{right.map((_, k) => featCard(left.length + k))}</div>
          </div>
        </div>
      </section>

      {/* A moving row of phones, each screen scrolling */}
      <section id="app" className="st-sec st-reel">
        <div className="st-wrap">
          <div className="st-head sk-rv">
            <H h={spec.app?.headline ?? spec.features.headline} />
            <p className="st-intro">{spec.app?.intro ?? spec.features.intro}</p>
          </div>
        </div>
        <Marquee className="st-phones" speed={60}>
          {reel.map((src, i) => <div key={i} className={`st-reel-p r${i % 3}`}><Phone src={src} label="App screen" items={i % 2 ? [...names].reverse() : names} tone={i} speed={11 + (i % 3) * 4} /></div>)}
        </Marquee>
        {spec.app && spec.app.pills.length > 0 && (
          <div className="st-wrap st-pills">{spec.app.pills.map((p, i) => <span key={p} className="st-pill"><i aria-hidden="true">{ICONS[i % ICONS.length]}</i>{p}</span>)}</div>
        )}
      </section>

      {/* Programmes */}
      {spec.programmes && spec.programmes.items.length > 0 && (
        <section id="programmes" className="st-sec st-progs">
          <div className="st-wrap">
            <div className="st-head sk-rv">
              <H h={spec.programmes.headline} />
              <p className="st-intro">{spec.programmes.intro}</p>
            </div>
            <div className="st-prog-row">
              {spec.programmes.items.map((p, i) => (
                <article key={p.name} className={`st-prog sk-rv d${i % 3}`}>
                  <div className="st-arch st-prog-img"><Pic src={p.image} label={`${p.name} photo`} /></div>
                  {p.tag && <span className="st-tag">{p.tag}</span>}
                  <p className="st-meta">{p.meta}</p>
                  <h3>{p.name}</h3>
                  <p className="st-prog-b">{p.body}</p>
                  <div className="st-prog-foot"><b>{p.price}</b><span className="st-link">Get programme <i aria-hidden="true">→</i></span></div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Results */}
      {spec.results && (story || reviews.length > 0) && (
        <section id="results" className="st-sec st-results">
          <div className="st-wrap">
            <div className="st-head st-head-c sk-rv">
              <p className="st-kicker">{spec.results.eyebrow}</p>
              <H h={spec.results.headline} />
              <p className="st-intro">{spec.results.intro}</p>
            </div>
            {story && (
              <div className="st-story sk-rv">
                <div className="st-polas">
                  <figure className="st-pola a"><Pic src={story.before} label="Before photo" /><figcaption>Before</figcaption></figure>
                  <figure className="st-pola b"><Pic src={story.after} label="After photo" /><figcaption>After · {story.label}</figcaption></figure>
                </div>
                <blockquote className="st-story-q"><Stars /><p>&ldquo;{story.quote}&rdquo;</p><cite>{story.name}, {story.label}</cite></blockquote>
              </div>
            )}
            {reviews.length > 0 && (
              <div className="st-reviews">
                {reviews.slice(0, 6).map((r, i) => (
                  <figure key={i} className={`st-review sk-rv d${i % 3}`}><Stars /><blockquote>&ldquo;{r.quote}&rdquo;</blockquote><figcaption><b>{r.name}</b> · {r.detail}</figcaption></figure>
                ))}
              </div>
            )}
          </div>
        </section>
      )}

      {/* Coach */}
      <section id="coach" className="st-sec st-coach">
        <div className="st-wrap st-split">
          <div className="sk-rv">
            <p className="st-kicker">{spec.coach.eyebrow}</p>
            <H h={spec.coach.headline} />
            <p className="st-p st-lead">{spec.coach.p1}</p>
            <p className="st-p">{spec.coach.p2}</p>
            {spec.coach.stats.length > 0 && (
              <div className="st-coach-stats">{spec.coach.stats.slice(0, 3).map((s) => <div key={s.label}><b>{s.value}</b><span>{s.label}</span></div>)}</div>
            )}
            {spec.coach.instagram && <span className="st-btn st-btn-line">Follow {spec.coach.instagram}</span>}
          </div>
          <div className="st-coach-art sk-rv d1">
            <div className="st-arch st-coach-img"><Pic src={spec.coach.image} label="Photo of the coach" /></div>
            {spec.coach.badge && <span className="st-sticker st-sticker-r">{spec.coach.badge}</span>}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="st-sec st-pricing">
        <div className="st-wrap">
          <div className="st-head st-head-c sk-rv">
            <p className="st-kicker">{spec.pricing.eyebrow}</p>
            <H h={spec.pricing.headline} />
            <p className="st-intro">{spec.pricing.sub}</p>
          </div>
          {plans.length ? (
            <div className={`st-plans n${plans.length}`}>
              {plans.map((p, i) => (
                <div key={p.name} className={`st-plan sk-rv d${i}${p.popular ? ' pop' : ''}`} onMouseMove={spot}>
                  {p.popular && <span className="st-plan-tag">Best value</span>}
                  <p className="st-plan-name">{p.name}</p>
                  <p className="st-price"><b>{p.price}</b></p>
                  <p className="st-period">{p.period}</p>
                  {p.perDay && <span className="st-perday">{p.perDay}</span>}
                  <span className={`st-btn st-btn-block${p.popular ? '' : ' st-btn-line'}`}>{cta}</span>
                  <p className="st-plan-inc">{p.includes}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="st-plans n3 st-plans-todo" role="note">
              {['Monthly', 'Quarterly', 'Annual'].map((n) => (
                <div key={n} className="st-plan"><p className="st-plan-name">{n}</p><p className="st-price"><b>£–</b></p><p className="st-plan-inc">Pricing is added in the REPS launch setup</p></div>
              ))}
            </div>
          )}
          {spec.pricing.trust.length > 0 && <div className="st-trust">{spec.pricing.trust.map((t) => <span key={t}>✓ {t}</span>)}</div>}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="st-sec st-faq">
        <div className="st-wrap st-faq-wrap">
          <div className="st-head st-head-c sk-rv">
            <H h={spec.faq.headline} />
            {spec.faq.email && <p className="st-intro">Still unsure? Email <b>{spec.faq.email}</b>.</p>}
          </div>
          {spec.faq.items.map((it, i) => {
            const open = faq === i;
            return (
              <div key={i} className={`st-q${open ? ' open' : ''}`}>
                <button type="button" aria-expanded={open} onClick={() => setFaq(open ? -1 : i)}>
                  <span>{it.q}</span><i aria-hidden="true" />
                </button>
                <div className="st-a"><p>{it.a}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Closing */}
      <section id="guide" className="st-final">
        <div className="st-wrap">
          <div className="st-panel">
            <div className="st-blobs st-blobs-in" aria-hidden="true"><i /><i /><i /></div>
            <svg className="st-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0,30 C150,60 300,0 450,30 C600,60 750,0 900,30 C1050,60 1200,0 1350,30 L1350,0 L0,0 Z" /></svg>
            {spec.capture.off ? (
              <div className="st-final-join">
                <H h={spec.hero.headline} />
                <p className="st-sub">{spec.hero.smallPrint}</p>
                <span className="st-btn st-btn-ink">{cta}</span>
              </div>
            ) : (
              <div className="st-final-grid">
                <div>
                  <p className="st-kicker">{spec.capture.eyebrow}</p>
                  <H h={spec.capture.headline} />
                  <p className="st-sub">{spec.capture.body}</p>
                </div>
                <form className="st-capture" onSubmit={cap.submit}>
                  {cap.state === 'done' ? <p className="st-thanks">Thanks! Check your inbox in a few minutes.</p> : (
                    <>
                      <label htmlFor={`st-email-${spec.slug}`}>Your email</label>
                      <input id={`st-email-${spec.slug}`} type="email" required placeholder="you@email.com" value={cap.email} onChange={(e) => cap.setEmail(e.target.value)} />
                      <button type="submit" className="st-btn st-btn-ink st-btn-block" disabled={cap.state === 'sending'}>{spec.capture.button}</button>
                      <p className="st-small">{cap.state === 'error' ? 'That did not go through. Please try again.' : spec.capture.small}</p>
                    </>
                  )}
                </form>
              </div>
            )}
          </div>
        </div>
      </section>

      <footer className="st-foot">
        <div className="st-wrap st-foot-row">
          <div className="st-foot-brand"><span className="st-logo"><Logo spec={spec} /></span><p>{spec.footer.blurb}</p></div>
          <div className="st-foot-links">{spec.nav.links.map((l) => <span key={l}>{l}</span>)}<span>Member login</span></div>
        </div>
        <div className="st-word" aria-hidden="true" style={{ fontSize: `${Math.min(16, 110 / Math.max(spec.brand.name.length, 5)).toFixed(1)}cqi` }}>{spec.brand.name}</div>
        <div className="st-wrap st-legal"><span>© {new Date().getFullYear()} {spec.brand.name}</span><span>Terms · Privacy · Cookies</span></div>
      </footer>
    </div>
  );
}
