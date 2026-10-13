'use client';

import type { ReactNode } from 'react';
import { FEATURE_OPTIONS, TIMEZONES, type OnboardingAnswers } from '@/lib/site/onboarding';
import type { FontStyle } from '@/lib/site/spec';
import { Area, Chips, Choice, Colour, Photo, Photos, Text } from './fields';

export type Draft = OnboardingAnswers;
export type Step = { title: string; intro: string; check?: (a: Draft) => string | null; body: (a: Draft, set: (fn: (d: Draft) => void) => void) => ReactNode };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FontPreview = ({ font }: { font: FontStyle }) => {
  const f = {
    bold: { fontFamily: "'Oswald', 'Arial Narrow', sans-serif", textTransform: 'uppercase' as const },
    modern: { fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif", textTransform: 'uppercase' as const },
    elegant: { fontFamily: "'DM Serif Display', Georgia, serif", textTransform: 'none' as const },
  }[font];
  return <span className="ob-fontprev" style={f}><span style={{ fontWeight: font === 'elegant' ? 400 : 300, fontStyle: font === 'elegant' ? 'italic' : 'normal' }}>Your strongest</span><br /><span style={{ fontWeight: 700 }}>self starts here.</span></span>;
};

const ALL_STEPS: Step[] = [
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
        <Area label="Business address" hint="For your website footer and emails. Required by email law for marketing emails." rows={2} value={a.contact.address} onChange={(v) => set((d) => { d.contact.address = v; })} />
        <div className="ob-field">
          <label className="ob-label" htmlFor="ob-tz">Your time zone</label>
          <span className="ob-hint">So emails go out at the right time for your audience</span>
          <select id="ob-tz" className="ob-input" value={a.contact.timezone} onChange={(e) => set((d) => { d.contact.timezone = e.target.value; })}>
            {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ').replace('/', ' · ')}</option>)}
          </select>
        </div>
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
    title: 'Offer and pricing',
    intro: 'What the client sells, what it costs and the app screenshots.',
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
        <Area label="Anything else we should know?" rows={3} value={a.extra} onChange={(v) => set((d) => { d.extra = v; })} />
      </div>
    ),
  },
  {
    title: 'App launch',
    intro: 'Drives the pre-registration page and both launch email sequences.',
    check: (a) => (!a.launch.date ? 'Please add your launch date, even if it is a best guess.' : null),
    body: (a, set) => (
      <div className="ob-grid">
        <Text type="date" label="Launch date" required hint="When the app goes live. A best guess is fine, we can move it." value={a.launch.date} onChange={(v) => set((d) => { d.launch.date = v; })} />
        <Text label="Website address" hint="Linked in the launch emails" placeholder="e.g. strongwithdani.co.uk" value={a.launch.websiteUrl} onChange={(v) => set((d) => { d.launch.websiteUrl = v; })} />
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
    title: 'Free guide',
    intro: 'The free download that collects emails at the bottom of the site.',
    body: (a, set) => (
      <div className="ob-grid">
        <Text wide label="What is it called?" placeholder="e.g. 5 day kickstart plan" value={a.leadMagnet.name} onChange={(v) => set((d) => { d.leadMagnet.name = v; })} />
        <Area label="What's in it?" rows={2} value={a.leadMagnet.description} onChange={(v) => set((d) => { d.leadMagnet.description = v; })} />
      </div>
    ),
  },
];


const DOMAIN_STEP: Step = {
  title: 'Your website address',
  intro: 'So we can put your new website live on your own address.',
  body: (a, set) => (
    <div className="ob-grid">
      <Choice wide label="Do you own a website address (domain)?" value={a.domain.has} onChange={(v) => set((d) => { d.domain.has = v; })} options={[
        { value: 'yes', title: 'Yes', desc: 'I already own one' }, { value: 'no', title: 'No', desc: 'I need one' }, { value: 'unsure', title: 'Not sure' },
      ]} />
      {a.domain.has === 'yes' && (
        <>
          <Text label="Your domain" placeholder="e.g. strongwithdani.co.uk" value={a.domain.name} onChange={(v) => set((d) => { d.domain.name = v.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, ''); })} />
          <Text label="Where did you buy it?" placeholder="e.g. GoDaddy, Namecheap, 123-reg, Squarespace" value={a.domain.registrar} onChange={(v) => set((d) => { d.domain.registrar = v; })} />
          <Choice wide label="Can you log in to where you bought it?" value={a.domain.access} onChange={(v) => set((d) => { d.domain.access = v; })} options={[
            { value: 'yes', title: 'Yes' }, { value: 'no', title: 'No', desc: 'Someone else set it up' }, { value: 'unsure', title: 'Not sure' },
          ]} />
        </>
      )}
      {a.domain.has === 'no' && <p className="ob-hint ob-wide">No problem, we&apos;ll help you choose and set one up.</p>}
      <Text wide label="Do you have a website already?" hint="Paste the address, or leave blank" placeholder="e.g. strongwithdani.com" value={a.domain.currentSite} onChange={(v) => set((d) => { d.domain.currentSite = v; })} />
    </div>
  ),
};

const byTitle = (t: string) => ALL_STEPS.find((x) => x.title === t)!;

/** The client intake form: everything about them and their brand. */
export const CLIENT_STEPS: Step[] = [
  byTitle('You and your business'), DOMAIN_STEP, byTitle('Your brand'), byTitle('Your audience'),
  byTitle('Results and reviews'), byTitle('Your story and photos'),
];

/** Agency launch setup: what the REPS team fills in after the intake form. */
export const LAUNCH_STEPS: Step[] = [byTitle('Offer and pricing'), byTitle('One-off programmes'), byTitle('Free guide'), byTitle('App launch')];
