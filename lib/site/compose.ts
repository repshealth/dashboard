import type { OnboardingAnswers } from './onboarding';
import type { SiteCopy } from './copy';
import type { Plan, SiteSpec } from './spec';

const DAYS: Record<string, number> = { week: 7, month: 30.4, quarter: 91.3, year: 365, once: 0 };
const PERIOD_LABEL: Record<string, string> = {
  week: 'per week', month: 'per month, rolling', quarter: 'every 3 months', year: 'per year', once: 'one time',
};

const money = (p: string) => '£' + p.replace(/^£/, '').trim();

/** "83p a day" or "£1.20 a day". */
function perDay(price: string, period: string) {
  const days = DAYS[period];
  const n = parseFloat(price.replace(/[^0-9.]/g, ''));
  if (!days || !n) return undefined;
  const pence = Math.round((n / days) * 100);
  return pence < 100 ? `${pence}p a day` : `£${(pence / 100).toFixed(2)} a day`;
}

/** URL-safe account name, e.g. "Strong With Dani" -> "strong-with-dani". */
export const slugify = (s: string) =>
  s.toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_]+/g, '-').replace(/-+/g, '-').slice(0, 48) || 'client';

/** Joins the client's answers and the written copy into a full site spec. */
export function buildSpec(a: OnboardingAnswers, c: SiteCopy, slug: string): SiteSpec {
  const hasApp = a.offer.type !== 'coaching';
  const trial = a.offer.freeTrialDays;
  const ctaPrimary = trial ? 'Start free trial' : a.offer.type === 'coaching' ? 'Apply now' : 'Join now';
  const where = a.offer.location === 'both' ? 'Gym + home' : a.offer.location === 'gym' ? 'Gym' : 'Home';

  const priced = a.offer.plans.filter((p) => p.price.trim());
  const savings = (p: (typeof priced)[number]) => {
    const base = priced[0];
    if (!base || p === base || !DAYS[p.period] || !DAYS[base.period]) return '';
    const baseDaily = parseFloat(base.price) / DAYS[base.period];
    const daily = parseFloat(p.price) / DAYS[p.period];
    const pct = Math.round((1 - daily / baseDaily) * 100);
    return pct > 0 ? ` · save ${pct}%` : '';
  };
  const plans: Plan[] = priced.slice(0, 3).map((p, i) => ({
    name: p.name,
    price: money(p.price),
    period: PERIOD_LABEL[p.period] + savings(p),
    perDay: perDay(p.price, p.period),
    includes: c.plan_includes,
    popular: priced.some((x) => x.popular) ? p.popular : priced.length === 3 && i === 1,
    image: a.about.planPhotos[i],
  }));

  const stats = (list: [string, string][]) => list.filter(([v]) => v).map(([value, label]) => ({ value, label }));
  const reviewsProof = a.proof.rating && a.proof.reviewCount ? `${a.proof.rating} from ${a.proof.reviewCount}+ reviews` : undefined;

  const navLinks = [
    "What's inside",
    a.proof.stories.length || a.proof.reviews.length ? 'Results' : '',
    'Pricing',
    a.offer.programmes.length ? 'Programmes' : '',
    'FAQ',
  ].filter(Boolean);

  return {
    slug,
    brand: {
      name: a.business.brandName,
      logoUrl: a.brand.logo,
      primary: a.brand.primary,
      secondary: a.brand.secondary,
      ground: '#FFFFFF',
      ink: '#141414',
      font: a.brand.font,
    },
    nav: { cta: c.nav_cta || ctaPrimary, links: navLinks },
    hero: {
      proof: reviewsProof,
      headline: { light: c.hero_light, bold: c.hero_bold },
      sub: c.hero_sub,
      ctaPrimary,
      ctaSecondary: c.cta_secondary,
      smallPrint: trial ? `${trial} days free · Cancel anytime` : 'Cancel anytime',
      image: a.about.heroPhoto,
      screens: a.offer.appScreens.slice(0, 2),
    },
    band: c.band.slice(0, 5),
    about: {
      eyebrow: c.about_eyebrow,
      headline: { light: c.about_light, bold: c.about_bold },
      p1: c.about_p1,
      p2: c.about_p2,
      stats: stats([[a.offer.sessionLength, 'Session length'], [a.offer.daysPerWeek, 'Days a week'], [where, 'Every plan']]),
      image: a.about.aboutPhoto || a.offer.appScreens[2],
    },
    features: {
      eyebrow: hasApp ? 'What’s inside the membership' : 'What’s included',
      headline: { light: c.features_light, bold: c.features_bold },
      intro: c.features_intro,
      items: c.features.slice(0, 6),
      cta: ctaPrimary,
    },
    app: hasApp
      ? {
          eyebrow: 'Inside the app',
          headline: { light: c.app_light, bold: c.app_bold },
          intro: c.app_intro,
          screens: a.offer.appScreens,
          pills: a.offer.features,
        }
      : null,
    pricing: {
      eyebrow: 'Membership',
      headline: { light: c.pricing_light, bold: c.pricing_bold },
      sub: c.pricing_sub,
      plans,
      trust: [trial ? `${trial} days free on every plan` : '', 'Cancel anytime', hasApp ? 'iOS & Android' : ''].filter(Boolean),
    },
    programmes: a.offer.programmes.length
      ? {
          eyebrow: 'Just want one programme?',
          headline: { light: 'One off', bold: 'programmes' },
          intro: c.programmes_intro,
          items: a.offer.programmes.map((p, i) => ({
            tag: i === 0 ? 'New programme!' : undefined,
            meta: p.meta,
            name: p.name,
            body: p.description,
            price: money(p.price),
            image: p.image,
          })),
          banner: c.programmes_banner,
        }
      : null,
    results: a.proof.stories.length || a.proof.reviews.length
      ? {
          eyebrow: 'Results',
          headline: { light: c.results_light, bold: c.results_bold },
          intro: c.results_intro,
          stories: a.proof.stories,
          reviews: a.proof.reviews,
        }
      : null,
    coach: {
      eyebrow: `Meet ${a.business.coachName}`,
      headline: { light: c.coach_light, bold: c.coach_bold },
      p1: c.coach_p1,
      p2: c.coach_p2,
      stats: stats([
        [a.proof.qualification ? 'Qualified' : '', a.proof.qualification],
        [a.proof.yearsCoaching ? `${a.proof.yearsCoaching} yrs` : '', 'Coaching in person and online'],
        [a.proof.clientsCoached, 'Clients coached'],
      ]),
      badge: c.coach_badge,
      image: a.about.coachPhoto,
      instagram: a.business.instagram || undefined,
    },
    faq: {
      headline: { light: 'Everything', bold: "you'd ask" },
      email: a.business.publicEmail || undefined,
      items: c.faq.slice(0, 10),
    },
    capture: {
      eyebrow: 'Not ready to join yet?',
      headline: { light: c.capture_light, bold: c.capture_bold },
      body: c.capture_body,
      button: 'Send it to me',
      small: "We'll never share your email. Unsubscribe in one click.",
    },
    footer: { blurb: c.footer_blurb },
  };
}
