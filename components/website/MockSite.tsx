import type { CSSProperties } from 'react';
import type { MockBrand, MockPage } from '@/lib/types';

/** Draws the example client pages used in demo mode. Live sites are shown as screenshots instead. */
export default function MockSite({ brand: b, page }: { brand: MockBrand; page: MockPage }) {
  const vars = { '--a': b.accent, '--ink': b.ink, '--sbg': b.bg, '--hf': b.font } as CSSProperties;
  return (
    <div className="site" style={vars}>
      <div className="s-nav">
        <span className="s-logo">{b.name}</span>
        <div className="s-links"><span>Programs</span><span>Results</span><span>About</span></div>
        <span className="s-btn">{b.cta}</span>
      </div>

      {page.type === 'home' && (
        <>
          <div className="s-hero">
            <div className="s-copy">
              <div className="s-eyebrow">{b.eyebrow}</div>
              <div className="s-h1">{b.h1}</div>
              <p className="s-p">{b.p}</p>
              <div className="s-ctas"><span className="s-btn">{b.cta}</span><span className="s-btn ghost">See results</span></div>
            </div>
            <div className="s-photo">Coach photo</div>
          </div>
          <div className="s-sec">
            <div className="s-h2">How we can help</div>
            <div className="s-grid">
              {b.cards.map(([t, d]) => (
                <div className="s-card" key={t}><div className="s-ct">{t}</div><div className="s-cd">{d}</div><span className="s-link">Learn more</span></div>
              ))}
            </div>
          </div>
          <div className="s-quote"><div className="s-q">&ldquo;{b.quote}&rdquo;</div><div className="s-who">{b.who}</div></div>
          <div className="s-band"><div className="s-h2 light">Ready to start?</div><span className="s-btn inv">{b.cta}</span></div>
        </>
      )}

      {page.type === 'quiz' && (
        <div className="s-narrow">
          <div className="s-h1 sm">{page.title}</div>
          <div className="s-step">{page.step}</div>
          <div className="s-bar"><span /></div>
          <div className="s-qcard">
            <div className="s-qq">{page.q}</div>
            {page.opts.map((o) => <div className="s-opt" key={o}>{o}</div>)}
            <span className="s-btn">Next question</span>
          </div>
        </div>
      )}

      {page.type === 'survey' && (
        <div className="s-narrow">
          <div className="s-h1 sm">{page.title}</div>
          <p className="s-p">Takes 2 minutes. We read every answer personally.</p>
          <div className="s-qcard">
            {page.fields.map((f) => <div className="s-field" key={f}><div className="s-fl">{f}</div><div className="s-input" /></div>)}
            <span className="s-btn">Send my answers</span>
          </div>
        </div>
      )}

      {page.type === 'magnet' && (
        <div className="s-hero">
          <div className="s-cover"><span>{page.cover}</span></div>
          <div className="s-copy">
            <div className="s-eyebrow">Free download</div>
            <div className="s-h1 sm">{page.title}</div>
            <p className="s-p">{page.p}</p>
            <div className="s-field"><div className="s-fl">First name</div><div className="s-input" /></div>
            <div className="s-field"><div className="s-fl">Email</div><div className="s-input" /></div>
            <span className="s-btn">Send it to me</span>
          </div>
        </div>
      )}

      <div className="s-foot">© 2026 {b.name} · Privacy · Terms</div>
    </div>
  );
}
