'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useData } from '../DataProvider';
import { backend, type Submission } from '@/lib/backend';
import { SITE_STATUS } from '@/lib/constants';
import { fmtWhen } from '@/lib/format';
import { launchOf, type OnboardingAnswers as Answers } from '@/lib/site/onboarding';
import { fmtLaunch } from '@/lib/emails/schedule';

const OFFER = { app: 'App membership', coaching: 'Online coaching', hybrid: 'App plus coaching' } as const;
const WHERE = { gym: 'Gym', home: 'Home', both: 'Gym and home' } as const;
const PERIOD = { week: 'per week', month: 'per month', quarter: 'every 3 months', year: 'per year', once: 'one-off' } as const;
const FONT = { bold: 'Bold (tall, condensed capitals)', modern: 'Modern (clean and sporty)', elegant: 'Elegant (serif)' } as const;

/** A question and its answer. Empty answers are shown as such, so gaps are easy to spot. */
function Row({ q, children }: { q: string; children: ReactNode }) {
  const empty = children == null || children === '' || (Array.isArray(children) && !children.length);
  return (
    <div className="oa-row">
      <dt>{q}</dt>
      <dd className={empty ? 'oa-empty' : ''}>{empty ? 'Not answered' : children}</dd>
    </div>
  );
}

function Pics({ srcs, label, tall, fit }: { srcs: (string | undefined)[]; label: string; tall?: boolean; fit?: boolean }) {
  const list = srcs.filter(Boolean) as string[];
  if (!list.length) return <span className="oa-empty">No {label.toLowerCase()} uploaded</span>;
  return (
    <span className="oa-pics">
      {list.map((src, i) => (
        <a key={i} href={src} target="_blank" rel="noreferrer" className={`oa-pic${tall ? ' tall' : ''}${fit ? ' fit' : ''}`} title={`Open ${label.toLowerCase()} ${i + 1}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} ${i + 1}`} />
        </a>
      ))}
    </span>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="oa-sec" aria-labelledby={`oa-${n}`}>
      <h3 id={`oa-${n}`}><span>{n}</span>{title}</h3>
      <dl>{children}</dl>
    </section>
  );
}

function AnswerSheet({ a }: { a: Answers }) {
  const plans = a.offer.plans.filter((p) => p.price);
  const l = launchOf(a);
  return (
    <div className="oa-sheet">
      <Section n={1} title="You and your business">
        <Row q="Full name">{a.contact.name}</Row>
        <Row q="Email">{a.contact.email}</Row>
        <Row q="Phone">{a.contact.phone}</Row>
        <Row q="Business or brand name">{a.business.brandName}</Row>
        <Row q="Name clients know them by">{a.business.coachName}</Row>
        <Row q="Instagram">{a.business.instagram}</Row>
        <Row q="Public contact email">{a.business.publicEmail}</Row>
      </Section>

      <Section n={2} title="Brand">
        <Row q="Colours">
          <span className="oa-swatches">
            <span><i style={{ background: a.brand.primary }} />{a.brand.primary}</span>
            <span><i style={{ background: a.brand.secondary }} />{a.brand.secondary}</span>
          </span>
        </Row>
        <Row q="Headline style">{FONT[a.brand.font]}</Row>
        <Row q="How they talk to clients">{a.brand.tone}</Row>
        <Row q="Logo"><Pics srcs={[a.brand.logo]} label="Logo" fit /></Row>
      </Section>

      <Section n={3} title="Audience">
        <Row q="Ideal clients">{a.audience.who}</Row>
        <Row q="What they struggle with">{a.audience.struggles}</Row>
        <Row q="What they want">{a.audience.goals}</Row>
        <Row q="What stops them signing up">{a.audience.objections}</Row>
      </Section>

      <Section n={4} title="Offer">
        <Row q="What they sell">{OFFER[a.offer.type]}</Row>
        <Row q="Programme or app name">{a.offer.productName}</Row>
        <Row q="Where clients train">{WHERE[a.offer.location]}</Row>
        <Row q="Sessions per week">{a.offer.daysPerWeek}</Row>
        <Row q="Session length">{a.offer.sessionLength}</Row>
        <Row q="Free trial">{a.offer.freeTrialDays ? `${a.offer.freeTrialDays} days` : 'None'}</Row>
        <Row q="What's included">{a.offer.features.length ? <span className="oa-chips">{a.offer.features.map((f) => <span key={f}>{f}</span>)}</span> : null}</Row>
        <Row q="Plans">
          {plans.length ? (
            <span className="oa-list">
              {plans.map((p) => <span key={p.name}><b>{p.name}</b> £{p.price} {PERIOD[p.period]}{p.popular ? ' · most popular' : ''}</span>)}
            </span>
          ) : null}
        </Row>
        {a.offer.type !== 'coaching' && <Row q="App screenshots"><Pics srcs={a.offer.appScreens} label="Screenshot" tall /></Row>}
      </Section>

      <Section n={5} title="One-off programmes">
        {a.offer.programmes.length ? a.offer.programmes.map((p, i) => (
          <Row key={i} q={p.name || `Programme ${i + 1}`}>
            <span className="oa-list">
              <span>{[p.meta, p.price && `£${p.price}`].filter(Boolean).join(' · ')}</span>
              {p.description && <span>{p.description}</span>}
              {p.image && <Pics srcs={[p.image]} label="Programme photo" />}
            </span>
          </Row>
        )) : <Row q="Programmes">{null}</Row>}
      </Section>

      <Section n={6} title="Results and reviews">
        <Row q="Qualification">{a.proof.qualification}</Row>
        <Row q="Years coaching">{a.proof.yearsCoaching}</Row>
        <Row q="Clients coached">{a.proof.clientsCoached}</Row>
        <Row q="Rating">{a.proof.rating && `${a.proof.rating}${a.proof.reviewCount ? ` from ${a.proof.reviewCount} reviews` : ''}`}</Row>
        {a.proof.stories.map((s, i) => (
          <Row key={`s${i}`} q={`Transformation ${i + 1}`}>
            <span className="oa-list">
              <span><b>{s.name || 'Unnamed'}</b>{s.label ? ` · ${s.label}` : ''}</span>
              {s.quote && <span>&ldquo;{s.quote}&rdquo;</span>}
              <Pics srcs={[s.before, s.after]} label="Before and after photo" />
            </span>
          </Row>
        ))}
        {!a.proof.stories.length && <Row q="Transformations">{null}</Row>}
        {a.proof.reviews.map((r, i) => (
          <Row key={`r${i}`} q={`Review ${i + 1}`}>
            <span className="oa-list"><span>&ldquo;{r.quote}&rdquo;</span><span className="oa-meta">{[r.name, r.detail].filter(Boolean).join(' · ')}</span></span>
          </Row>
        ))}
        {!a.proof.reviews.length && <Row q="Written reviews">{null}</Row>}
      </Section>

      <Section n={7} title="Story and photos">
        <Row q="Their story">{a.about.story && <span className="oa-long">{a.about.story}</span>}</Row>
        <Row q="Main photo"><Pics srcs={[a.about.heroPhoto]} label="Main photo" /></Row>
        <Row q="Second photo"><Pics srcs={[a.about.aboutPhoto]} label="Second photo" /></Row>
        <Row q="'Meet me' photo"><Pics srcs={[a.about.coachPhoto]} label="Meet me photo" /></Row>
        <Row q="Pricing card photos"><Pics srcs={a.about.planPhotos} label="Pricing photo" /></Row>
      </Section>

      <Section n={8} title="Free guide">
        <Row q="Name">{a.leadMagnet.name}</Row>
        <Row q="What's in it">{a.leadMagnet.description}</Row>
        <Row q="Anything else">{a.extra && <span className="oa-long">{a.extra}</span>}</Row>
      </Section>

      <Section n={9} title="App launch">
        <Row q="Launch date">{l.date && fmtLaunch(l.date)}</Row>
        <Row q="Website address">{l.websiteUrl}</Row>
        <Row q="Pre-registration offer">{l.offer}</Row>
        <Row q="Discount code">{l.code}</Row>
        <Row q="Offer stays open">{l.offerDays && `${l.offerDays} days`}</Row>
        <Row q="Email list size">{l.listSize}</Row>
      </Section>
    </div>
  );
}

export default function OnboardingAnswers() {
  const router = useRouter();
  const { viewer, clients, allSites, setClientId, toast } = useData();
  const [subs, setSubs] = useState<Submission[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [q, setQ] = useState('');

  useEffect(() => { if (viewer && !viewer.isAdmin) router.replace('/leads'); }, [viewer, router]);
  useEffect(() => {
    backend.listSubmissions().then(setSubs).catch((e) => { setSubs([]); toast(e.message); });
  }, [toast]);

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (subs ?? []).filter((x) => !s || [x.answers.business.brandName, x.answers.contact.name, x.answers.contact.email].some((v) => v?.toLowerCase().includes(s)));
  }, [subs, q]);
  const current = shown.find((x) => x.id === sel) ?? shown[0];

  if (!viewer?.isAdmin) return null;

  const status = (clientId: string | null) => {
    const site = allSites?.find((s) => s.clientId === clientId);
    return site ? SITE_STATUS[site.status] : null;
  };
  const open = (clientId: string, to: '/leads' | '/website') => { setClientId(clientId); router.push(to); };

  return (
    <div className="view">
      <header>
        <div>
          <h1>Onboarding</h1>
          <p className="sub">Every onboarding form submitted, with the answers and photos exactly as the client sent them</p>
        </div>
        <div className="actions">
          <Link className="btn" href="/onboarding">Open the form</Link>
        </div>
      </header>

      {subs === null ? <div className="loading">Loading submissions…</div> : !subs.length ? (
        <div className="sv-empty">
          <span className="stbadge st-build">None yet</span>
          <div className="sv-et">No onboarding forms submitted yet</div>
          <p>Send a new client the onboarding link. Their answers will appear here as soon as they submit it.</p>
        </div>
      ) : (
        <div className="ap-grid">
          <div className="ap-list">
            <label className="search oa-search">
              <span className="sr">Search submissions</span>
              <input type="search" placeholder="Search name or email..." value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            {shown.map((x) => {
              const st = status(x.clientId);
              const on = current?.id === x.id;
              return (
                <button key={x.id} type="button" className={`ap-item${on ? ' on' : ''}`} onClick={() => setSel(x.id)} aria-current={on ? 'true' : undefined}>
                  <div className="ap-item-h"><b>{x.answers.business.brandName || 'Unnamed business'}</b><span className="cm-t">{fmtWhen(x.submittedAt)}</span></div>
                  <div className="ap-item-v">{x.answers.contact.name} · {x.answers.contact.email}</div>
                  {st && <div className="ap-item-tags"><span className={`stbadge sm ${st.cls}`}>Website: {st.label}</span></div>}
                </button>
              );
            })}
            {!shown.length && <p className="cm-none">No submissions match.</p>}
          </div>

          {current && (
            <section className="ap-detail" aria-label={`${current.answers.business.brandName} onboarding answers`}>
              <div className="ap-head">
                <div>
                  <div className="ap-eyebrow">Submitted {fmtWhen(current.submittedAt)}</div>
                  <h2>{current.answers.business.brandName}</h2>
                  <p className="sub">{current.answers.contact.name} · {current.answers.contact.email}{current.answers.contact.phone ? ` · ${current.answers.contact.phone}` : ''}</p>
                </div>
                {current.clientId && clients.some((c) => c.id === current.clientId) && (
                  <div className="actions">
                    <button type="button" className="btn" onClick={() => open(current.clientId!, '/leads')}>Leads</button>
                    <button type="button" className="btn gold" onClick={() => open(current.clientId!, '/website')}>Open their website</button>
                  </div>
                )}
              </div>
              <AnswerSheet a={current.answers} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
