'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { backend } from '@/lib/backend';
import { rememberClient } from '../DataProvider';
import { FEATURE_OPTIONS, emptyAnswers, exampleAnswers, type OnboardingAnswers } from '@/lib/site/onboarding';
import type { FontStyle } from '@/lib/site/spec';
import { Area, Chips, Choice, Colour, Photo, Photos, Text } from './fields';

type Draft = OnboardingAnswers;
type Step = { title: string; intro: string; check?: (a: Draft) => string | null; body: (a: Draft, set: (fn: (d: Draft) => void) => void) => ReactNode };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FontPreview = ({ font }: { font: FontStyle }) => {
  const f = {
    bold: { fontFamily: "'Oswald', 'Arial Narrow', sans-serif", textTransform: 'uppercase' as const },
    modern: { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", textTransform: 'uppercase' as const },
    elegant: { fontFamily: "'DM Serif Display', Georgia, serif", textTransform: 'none' as const },
  }[font];
  return <span className="ob-fontprev" style={f}><span style={{ fontWeight: font === 'elegant' ? 400 : 300, fontStyle: font === 'elegant' ? 'italic' : 'normal' }}>Your strongest</span><br /><span style={{ fontWeight: 700 }}>self starts here.</span></span>;
};

const STEPS: Step[] = [
  {
    title: 'You and your business',
    intro: 'The basics, so we can set up your account.',
    check: (a) => (!a.contact.name.trim() ? 'Please add your name.'
      : !EMAIL.test(a.contact.email) ? 'Please add a valid email address. Your login will be sent here.'
      : !a.business.brandName.trim() ? 'Please add your business name.'
      : !a.business.coachName.trim() ? 'Please add the name clients know you by.' : null),
    body: (a, set) => (
      <div className="ob-grid">
        <Text label="Your full name" required value={a.contact.name} onChange={(v) => set((d) => { d.contact.name = v; })} />
        <Text label="Email" required hint="Your dashboard login is sent here" type="email" value={a.contact.email} onChange={(v) => set((d) => { d.contact.email = v; })} />
        <Text label="Phone" type="tel" value={a.contact.phone} onChange={(v) => set((d) => { d.contact.phone = v; })} />
        <Text label="Business or brand name" required placeholder="e.g. Strong With Dani" value={a.business.brandName} onChange={(v) => set((d) => { d.business.brandName = v; })} />
        <Text label="Name clients know you by" required placeholder="e.g. Dani" value={a.business.coachName} onChange={(v) => set((d) => { d.business.coachName = v; })} />
        <Text label="Instagram handle" placeholder="@yourhandle" value={a.business.instagram} onChange={(v) => set((d) => { d.business.instagram = v; })} />
        <Text label="Public contact email" hint="Shown on your website for questions" type="email" value={a.business.publicEmail} onChange={(v) => set((d) => { d.business.publicEmail = v; })} />
      </div>
    ),
  },
  {
    title: 'Your brand',
    intro: 'Your colours, logo and the style of your headlines.',
    body: (a, set) => (
      <div className="ob-grid">
        <Colour label="Main brand colour" value={a.brand.primary} onChange={(v) => set((d) => { d.brand.primary = v; })} />
        <Colour label="Second colour" value={a.brand.secondary} onChange={(v) => set((d) => { d.brand.secondary = v; })} />
        <div className="ob-swatch ob-wide" style={{ background: `linear-gradient(90deg, ${a.brand.primary} 0 50%, ${a.brand.secondary} 50% 100%)` }} aria-hidden="true" />
        <Choice<FontStyle> wide label="Headline style" value={a.brand.font} onChange={(v) => set((d) => { d.brand.font = v; })} options={[
          { value: 'bold', title: 'Bold', desc: 'Tall, condensed capitals', preview: <FontPreview font="bold" /> },
          { value: 'modern', title: 'Modern', desc: 'Clean and sporty', preview: <FontPreview font="modern" /> },
          { value: 'elegant', title: 'Elegant', desc: 'Serif, softer feel', preview: <FontPreview font="elegant" /> },
        ]} />
        <Text wide label="Three words for how you talk to clients" placeholder="e.g. Warm, direct, no-nonsense" value={a.brand.tone} onChange={(v) => set((d) => { d.brand.tone = v; })} />
        <Photo square label="Logo" hint="PNG with a transparent background works best" value={a.brand.logo} onChange={(v) => set((d) => { d.brand.logo = v; })} />
      </div>
    ),
  },
  {
    title: 'Your audience',
    intro: 'Who you help. This shapes every line of copy on your site.',
    check: (a) => (!a.audience.who.trim() ? 'Please tell us who your clients are.' : null),
    body: (a, set) => (
      <div className="ob-grid">
        <Area label="Who are your ideal clients?" placeholder="e.g. Busy mums aged 28 to 45 who used to train and want to feel strong again" value={a.audience.who} onChange={(v) => set((d) => { d.audience.who = v; })} />
        <Area label="What are they struggling with?" value={a.audience.struggles} onChange={(v) => set((d) => { d.audience.struggles = v; })} />
        <Area label="What do they want to achieve?" value={a.audience.goals} onChange={(v) => set((d) => { d.audience.goals = v; })} />
        <Area label="What stops them signing up?" hint="Their doubts and objections" value={a.audience.objections} onChange={(v) => set((d) => { d.audience.objections = v; })} />
      </div>
    ),
  },
  {
    title: 'Your offer',
    intro: 'What people are buying and what it costs.',
    check: (a) => (!a.offer.plans.some((p) => p.price.trim()) ? 'Please add a price for at least one plan.' : null),
    body: (a, set) => (
      <div className="ob-grid">
        <Choice wide label="What do you sell?" value={a.offer.type} onChange={(v) => set((d) => { d.offer.type = v; })} options={[
          { value: 'app', title: 'App membership', desc: 'Plans and tracking in an app' },
          { value: 'coaching', title: 'Online coaching', desc: '1:1 or small group' },
          { value: 'hybrid', title: 'Both', desc: 'App plus coaching' },
        ]} />
        <Text label="Name of your programme or app" placeholder="e.g. Strong With Dani app" value={a.offer.productName} onChange={(v) => set((d) => { d.offer.productName = v; })} />
        <Choice label="Where do clients train?" value={a.offer.location} onChange={(v) => set((d) => { d.offer.location = v; })} options={[
          { value: 'gym', title: 'Gym' }, { value: 'home', title: 'Home' }, { value: 'both', title: 'Both' },
        ]} />
        <Text label="Sessions per week" placeholder="e.g. 3–5" value={a.offer.daysPerWeek} onChange={(v) => set((d) => { d.offer.daysPerWeek = v; })} />
        <Text label="Typical session length" placeholder="e.g. 30 min" value={a.offer.sessionLength} onChange={(v) => set((d) => { d.offer.sessionLength = v; })} />
        <Text label="Free trial (days)" hint="0 for no free trial" type="number" value={String(a.offer.freeTrialDays)} onChange={(v) => set((d) => { d.offer.freeTrialDays = Math.max(0, parseInt(v || '0', 10) || 0); })} />
        <Chips label="What's included?" hint="Pick everything that applies. These become your feature cards." options={FEATURE_OPTIONS} value={a.offer.features} onChange={(v) => set((d) => { d.offer.features = v; })} />
        <div className="ob-field ob-wide">
          <span className="ob-label">Plans and prices</span>
          <span className="ob-hint">Leave a price empty to hide that plan. Tick the one to highlight.</span>
          <div className="ob-plans">
            {a.offer.plans.map((p, i) => (
              <div key={i} className="ob-plan">
                <input className="ob-input" aria-label={`Plan ${i + 1} name`} value={p.name} onChange={(e) => set((d) => { d.offer.plans[i].name = e.target.value; })} />
                <div className="ob-money"><span>£</span><input className="ob-input" aria-label={`Plan ${i + 1} price`} inputMode="decimal" placeholder="0.00" value={p.price} onChange={(e) => set((d) => { d.offer.plans[i].price = e.target.value.replace(/[^0-9.]/g, ''); })} /></div>
                <select className="ob-input" aria-label={`Plan ${i + 1} billing`} value={p.period} onChange={(e) => set((d) => { d.offer.plans[i].period = e.target.value as typeof p.period; })}>
                  <option value="week">per week</option><option value="month">per month</option><option value="quarter">every 3 months</option><option value="year">per year</option><option value="once">one-off</option>
                </select>
                <label className="ob-check"><input type="radio" name="popular" checked={p.popular} onChange={() => set((d) => { d.offer.plans.forEach((x, j) => (x.popular = j === i)); })} /> Most popular</label>
              </div>
            ))}
          </div>
        </div>
        {a.offer.type !== 'coaching' && (
          <Photos label="App screenshots" hint="Up to 6 phone screenshots of your app" max={6} value={a.offer.appScreens} onChange={(v) => set((d) => { d.offer.appScreens = v; })} />
        )}
      </div>
    ),
  },
  {
    title: 'One-off programmes',
    intro: 'Optional. Programmes people can buy outright, without a membership.',
    body: (a, set) => (
      <div className="ob-grid">
        {a.offer.programmes.map((p, i) => (
          <div key={i} className="ob-group ob-wide">
            <div className="ob-group-h"><b>Programme {i + 1}</b><button type="button" className="ob-link" onClick={() => set((d) => { d.offer.programmes.splice(i, 1); })}>Remove</button></div>
            <div className="ob-grid">
              <Text label="Name" value={p.name} onChange={(v) => set((d) => { d.offer.programmes[i].name = v; })} />
              <Text label="Length and format" placeholder="e.g. 8 weeks · Gym + home" value={p.meta} onChange={(v) => set((d) => { d.offer.programmes[i].meta = v; })} />
              <Text label="Price (£)" value={p.price} onChange={(v) => set((d) => { d.offer.programmes[i].price = v.replace(/[^0-9.]/g, ''); })} />
              <Photo label="Image" value={p.image} onChange={(v) => set((d) => { d.offer.programmes[i].image = v; })} />
              <Area label="One-line description" value={p.description} onChange={(v) => set((d) => { d.offer.programmes[i].description = v; })} rows={2} />
            </div>
          </div>
        ))}
        {a.offer.programmes.length < 3 && (
          <button type="button" className="btn ob-wide" onClick={() => set((d) => { d.offer.programmes.push({ name: '', meta: '', price: '', description: '' }); })}>+ Add a programme</button>
        )}
      </div>
    ),
  },
  {
    title: 'Results and reviews',
    intro: 'Real proof only. We never make up numbers or testimonials.',
    body: (a, set) => (
      <div className="ob-grid">
        <Text label="Qualification" placeholder="e.g. Level 3 PT & nutrition coach" value={a.proof.qualification} onChange={(v) => set((d) => { d.proof.qualification = v; })} />
        <Text label="Years coaching" value={a.proof.yearsCoaching} onChange={(v) => set((d) => { d.proof.yearsCoaching = v; })} />
        <Text label="Clients coached" placeholder="e.g. 500+" value={a.proof.clientsCoached} onChange={(v) => set((d) => { d.proof.clientsCoached = v; })} />
        <Text label="Average review rating" placeholder="e.g. 4.9" value={a.proof.rating} onChange={(v) => set((d) => { d.proof.rating = v; })} />
        <Text label="Number of reviews" placeholder="e.g. 120" value={a.proof.reviewCount} onChange={(v) => set((d) => { d.proof.reviewCount = v; })} />

        <div className="ob-sub ob-wide">Client transformations</div>
        {a.proof.stories.map((s, i) => (
          <div key={i} className="ob-group ob-wide">
            <div className="ob-group-h"><b>Transformation {i + 1}</b><button type="button" className="ob-link" onClick={() => set((d) => { d.proof.stories.splice(i, 1); })}>Remove</button></div>
            <div className="ob-grid">
              <Text label="First name" value={s.name} onChange={(v) => set((d) => { d.proof.stories[i].name = v; })} />
              <Text label="Timeframe" placeholder="e.g. 12 weeks" value={s.label} onChange={(v) => set((d) => { d.proof.stories[i].label = v; })} />
              <Photo label="Before photo" value={s.before} onChange={(v) => set((d) => { d.proof.stories[i].before = v; })} />
              <Photo label="After photo" value={s.after} onChange={(v) => set((d) => { d.proof.stories[i].after = v; })} />
              <Area label="Their words" rows={2} value={s.quote} onChange={(v) => set((d) => { d.proof.stories[i].quote = v; })} />
            </div>
          </div>
        ))}
        {a.proof.stories.length < 4 && <button type="button" className="btn ob-wide" onClick={() => set((d) => { d.proof.stories.push({ name: '', label: '', quote: '' }); })}>+ Add a transformation</button>}

        <div className="ob-sub ob-wide">Written reviews</div>
        {a.proof.reviews.map((r, i) => (
          <div key={i} className="ob-group ob-wide">
            <div className="ob-group-h"><b>Review {i + 1}</b><button type="button" className="ob-link" onClick={() => set((d) => { d.proof.reviews.splice(i, 1); })}>Remove</button></div>
            <div className="ob-grid">
              <Area label="Review" rows={2} value={r.quote} onChange={(v) => set((d) => { d.proof.reviews[i].quote = v; })} />
              <Text label="Name" placeholder="e.g. Becky T" value={r.name} onChange={(v) => set((d) => { d.proof.reviews[i].name = v; })} />
              <Text label="Detail" placeholder="e.g. Member 9 months" value={r.detail} onChange={(v) => set((d) => { d.proof.reviews[i].detail = v; })} />
            </div>
          </div>
        ))}
        {a.proof.reviews.length < 3 && <button type="button" className="btn ob-wide" onClick={() => set((d) => { d.proof.reviews.push({ quote: '', name: '', detail: '' }); })}>+ Add a review</button>}
      </div>
    ),
  },
  {
    title: 'Your story and photos',
    intro: 'Why you started, and the photos for your site.',
    body: (a, set) => (
      <div className="ob-grid">
        <Area rows={5} label="Your story" hint="Why you started coaching, in your own words. A few sentences is plenty." value={a.about.story} onChange={(v) => set((d) => { d.about.story = v; })} />
        <Photo label="Main photo" hint="For the top of your site. A full-length shot works best." value={a.about.heroPhoto} onChange={(v) => set((d) => { d.about.heroPhoto = v; })} />
        <Photo label="Second photo" hint="For the intro section" value={a.about.aboutPhoto} onChange={(v) => set((d) => { d.about.aboutPhoto = v; })} />
        <Photo label="Photo for 'Meet me'" value={a.about.coachPhoto} onChange={(v) => set((d) => { d.about.coachPhoto = v; })} />
        <Photos label="Photos for the pricing cards" hint="Up to 3, one per plan" max={3} value={a.about.planPhotos} onChange={(v) => set((d) => { d.about.planPhotos = v; })} />
      </div>
    ),
  },
  {
    title: 'Your app launch',
    intro: 'For your pre-registration page and your launch emails.',
    check: (a) => (!a.launch.date ? 'Please add your launch date, even if it is a best guess.' : null),
    body: (a, set) => (
      <div className="ob-grid">
        <Text type="date" label="Launch date" required hint="When the app goes live. A best guess is fine, we can move it." value={a.launch.date} onChange={(v) => set((d) => { d.launch.date = v; })} />
        <Text label="Your website address" hint="If you already have one. Linked in the launch emails." placeholder="e.g. strongwithdani.co.uk" value={a.launch.websiteUrl} onChange={(v) => set((d) => { d.launch.websiteUrl = v; })} />
        <Text label="Launch offer for people who pre-register" hint="Your general email list gets full price." placeholder="e.g. 30% off your first 3 months" value={a.launch.offer} onChange={(v) => set((d) => { d.launch.offer = v; })} />
        <Text label="Discount code" hint="Leave blank if you don't have one yet" placeholder="e.g. LAUNCH30" value={a.launch.code} onChange={(v) => set((d) => { d.launch.code = v.toUpperCase(); })} />
        <Choice wide label="How long does the launch offer stay open?" value={a.launch.offerDays} onChange={(v) => set((d) => { d.launch.offerDays = v; })} options={[
          { value: '4', title: '4 days' }, { value: '5', title: '5 days', desc: 'Most common' }, { value: '7', title: '7 days' },
        ]} />
        <Text label="Roughly how many people are on your email list?" placeholder="e.g. About 1,200" value={a.launch.listSize} onChange={(v) => set((d) => { d.launch.listSize = v; })} />
      </div>
    ),
  },
  {
    title: 'Your free guide',
    intro: 'The free download that collects emails at the bottom of your site.',
    body: (a, set) => (
      <div className="ob-grid">
        <Text wide label="What is it called?" placeholder="e.g. 5 day kickstart plan" value={a.leadMagnet.name} onChange={(v) => set((d) => { d.leadMagnet.name = v; })} />
        <Area label="What's in it?" rows={2} value={a.leadMagnet.description} onChange={(v) => set((d) => { d.leadMagnet.description = v; })} />
        <Area label="Anything else we should know?" rows={3} value={a.extra} onChange={(v) => set((d) => { d.extra = v; })} />
      </div>
    ),
  },
];

export default function OnboardingForm({ dashboardLink = true }: { dashboardLink?: boolean }) {
  const [a, setA] = useState<Draft>(emptyAnswers);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const [result, setResult] = useState<{ clientId: string; copyBy: string } | null>(null);
  const demo = backend.mode === 'demo';

  const set = (fn: (d: Draft) => void) => setA((prev) => { const next = structuredClone(prev); fn(next); return next; });
  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const go = (to: number) => {
    if (to > step) {
      for (let i = step; i < to; i++) {
        const msg = STEPS[i].check?.(a);
        if (msg) { setStep(i); setError(msg); return; }
      }
    }
    setError(null);
    setStep(to);
    try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch {}
  };

  const submit = async () => {
    for (let i = 0; i < STEPS.length; i++) {
      const msg = STEPS[i].check?.(a);
      if (msg) { setStep(i); setError(msg); return; }
    }
    setPhase('sending'); setError(null);
    try {
      const r = await backend.submitOnboarding(a);
      rememberClient(r.clientId);
      setResult(r);
      setPhase('done');
    } catch (e) {
      setPhase('form');
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  if (phase === 'sending') {
    return (
      <div className="ob-card ob-center">
        <div className="ob-spinner" aria-hidden="true" />
        <h1 className="ob-title">Building your launch</h1>
        <p className="ob-intro">Setting up your account, then writing your website, pre-registration page and launch emails from your answers. This takes up to a couple of minutes.</p>
      </div>
    );
  }

  if (phase === 'done') {
    return (
      <div className="ob-card ob-center">
        <div className="ob-tick" aria-hidden="true">✓</div>
        <h1 className="ob-title">Thanks, {a.business.coachName || a.contact.name.split(' ')[0]}!</h1>
        <p className="ob-intro">
          We&apos;ve got everything we need. The REPS team will check your new website, pre-registration page and launch emails, then email you at <b>{a.contact.email}</b> with
          your login so you can review them and leave comments.
        </p>
        {demo && dashboardLink && (
          <div className="ob-demo-done">
            <p>Example mode: the account and draft site were created. Open the dashboard to see them as the REPS team would.</p>
            <Link className="btn gold" href="/website">Open {a.business.brandName} in the dashboard</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="ob-card">
      <ol className="ob-steps" aria-label="Progress">
        {STEPS.map((x, i) => (
          <li key={x.title} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button type="button" onClick={() => go(i)} aria-current={i === step ? 'step' : undefined} title={x.title}>
              <span className="ob-dot">{i < step ? '✓' : i + 1}</span>
              <span className="ob-step-t">{x.title}</span>
            </button>
          </li>
        ))}
      </ol>

      <div className="ob-head">
        <div className="ob-count">Step {step + 1} of {STEPS.length}</div>
        <h1 className="ob-title">{s.title}</h1>
        <p className="ob-intro">{s.intro}</p>
        {demo && step === 0 && (
          <button type="button" className="ob-link" onClick={() => { setA(exampleAnswers()); setError(null); }}>Fill with example answers</button>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (last) submit(); else go(step + 1); }}>
        {s.body(a, set)}
        {error && <div className="ob-error" role="alert">{error}</div>}
        <div className="ob-nav">
          {step > 0 ? <button type="button" className="btn" onClick={() => go(step - 1)}>Back</button> : <span />}
          <button type="submit" className="btn gold">{last ? 'Send my answers' : 'Continue'}</button>
        </div>
      </form>
    </div>
  );
}
