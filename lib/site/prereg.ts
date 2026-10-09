import type { Headline, SiteSpec } from './spec';
import { launchOf, type OnboardingAnswers } from './onboarding';

/**
 * The pre-registration page: a short page that collects name, email and phone before
 * the app launches. Drawn by components/site/PreRegSite.tsx.
 */
export interface PreRegSpec {
  kind: 'prereg';
  slug: string;
  brand: SiteSpec['brand'];
  launchDate: string; // YYYY-MM-DD, drives the countdown
  hero: {
    eyebrow: string;
    headline: Headline;
    sub: string;
    perk: string; // what signing up gets you
    image?: string;
    screens: string[];
  };
  form: { title: string; button: string; small: string };
  benefits: { headline: Headline; items: { title: string; body: string }[] };
  coach: { headline: Headline; body: string; image?: string };
  footer: { blurb: string };
}

/** Words Claude writes for the page. Dates, the offer and photos come from the answers. */
export interface PreRegCopy {
  eyebrow: string;
  hero_light: string;
  hero_bold: string;
  hero_sub: string;
  perk: string;
  form_title: string;
  form_button: string;
  form_small: string;
  benefits_light: string;
  benefits_bold: string;
  benefits: { title: string; body: string }[];
  coach_light: string;
  coach_bold: string;
  coach_body: string;
  footer_blurb: string;
}

const str = (description: string) => ({ type: 'string', description });

export const PREREG_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    eyebrow: str('Tiny label above the headline, 2 to 5 words, e.g. "The app is almost here"'),
    hero_light: str('Headline line 1, 2 to 4 words'),
    hero_bold: str('Headline line 2, 2 to 4 words, ends with a full stop'),
    hero_sub: str('One or two sentences: what the app is, who it is for, and to pre-register now'),
    perk: str('One short line on what pre-registering gets them, using the launch offer given. If no offer is given, early access.'),
    form_title: str('Form heading, 3 to 6 words, e.g. "Get on the early list"'),
    form_button: str('Button, 2 to 4 words, e.g. "Pre-register now"'),
    form_small: str('One line under the button about privacy or what happens next. No promises not in the brief.'),
    benefits_light: str('Section headline line 1'),
    benefits_bold: str('Section headline line 2'),
    benefits: {
      type: 'array',
      description: 'Exactly 3 reasons to join, from the features and goals given',
      items: { type: 'object', additionalProperties: false, properties: { title: str('2 to 4 words'), body: str('One sentence') }, required: ['title', 'body'] },
    },
    coach_light: str('Coach section headline line 1, e.g. "Built by"'),
    coach_bold: str('Coach section headline line 2, e.g. the coach name'),
    coach_body: str('2 or 3 sentences in first person from the coach, based on their story'),
    footer_blurb: str('One line about the brand for the footer'),
  },
  required: ['eyebrow', 'hero_light', 'hero_bold', 'hero_sub', 'perk', 'form_title', 'form_button', 'form_small', 'benefits_light', 'benefits_bold', 'benefits', 'coach_light', 'coach_bold', 'coach_body', 'footer_blurb'],
} as const;

/** Copy from fixed sentence patterns. Used in preview mode and if Claude is unavailable. */
export function fallbackPreRegCopy(a: OnboardingAnswers): PreRegCopy {
  const l = launchOf(a);
  const brand = a.business.brandName || 'the app';
  const coach = a.business.coachName || a.contact.name.split(' ')[0] || 'me';
  const product = a.offer.productName || brand;
  const feats = a.offer.features.length ? a.offer.features : ['Workout plans', 'Meal plans', 'Weekly check-ins'];
  const where = a.offer.location === 'both' ? 'at the gym or at home' : a.offer.location === 'gym' ? 'in the gym' : 'at home';
  const body: Record<string, string> = {
    'Workout plans': `Structured sessions ${where}, ${a.offer.daysPerWeek} days a week, around ${a.offer.sessionLength} each.`,
    'Meal plans': 'Simple meals with your targets set for you, so you know exactly what to eat.',
    'Weekly check-ins': `${coach} checks in every week to keep you on track.`,
    'Habit tracking': 'Small daily habits that add up, tracked in one place.',
    'Community group': 'A group of people on the same journey, cheering you on.',
    'Exercise video demos': 'Every exercise has a video, so you always know what good form looks like.',
    'Calorie & macro tracking': 'Track your food in seconds, with targets built for you.',
    'Progress photos': 'See how far you have come, week by week.',
  };
  return {
    eyebrow: 'The app is almost here',
    hero_light: 'Be first',
    hero_bold: 'in the door.',
    hero_sub: `${product} is launching soon, built for ${a.audience.who ? a.audience.who.charAt(0).toLowerCase() + a.audience.who.slice(1) : 'people who want to train with a plan'}. Pre-register now and you will hear the moment it goes live.`,
    perk: l.offer ? `Pre-register for ${l.offer.charAt(0).toLowerCase() + l.offer.slice(1)} at launch` : 'Pre-register for early access on launch day',
    form_title: 'Get on the early list',
    form_button: 'Pre-register now',
    form_small: 'No spam. Just the launch, and your early offer.',
    benefits_light: 'Why you will',
    benefits_bold: 'want in.',
    benefits: feats.slice(0, 3).map((f) => ({ title: f, body: body[f] ?? `${f}, built into the app and ready on day one.` })),
    coach_light: 'Built by',
    coach_bold: `${coach}.`,
    coach_body: a.about.story ? a.about.story.split(/(?<=\.)\s+/).slice(0, 2).join(' ') : `I built ${product} to make training simple. I cannot wait to show you what is inside.`,
    footer_blurb: `${brand}. Coaching in your pocket.`,
  };
}

export const PREREG_SYSTEM = `You write short pre-registration landing pages for fitness coaches launching their own app, in British English.
Write in the coach's tone of voice. The page has one job: get the reader to leave their name, email and phone before launch.
Use only facts given in the brief. Never invent numbers, results, reviews or launch offers.
Keep it short and punchy. No em dashes. No emoji. No hype words like "revolutionary" or "game-changer".`;

/** Joins the answers, the written copy and the site's brand into the page. */
export function buildPreReg(a: OnboardingAnswers, c: PreRegCopy, site: SiteSpec): PreRegSpec {
  return {
    kind: 'prereg',
    slug: site.slug,
    brand: { ...site.brand },
    launchDate: launchOf(a).date,
    hero: {
      eyebrow: c.eyebrow,
      headline: { light: c.hero_light, bold: c.hero_bold },
      sub: c.hero_sub,
      perk: c.perk,
      image: a.about.heroPhoto,
      screens: a.offer.appScreens.slice(0, 2),
    },
    form: { title: c.form_title, button: c.form_button, small: c.form_small },
    benefits: { headline: { light: c.benefits_light, bold: c.benefits_bold }, items: c.benefits.slice(0, 3) },
    coach: { headline: { light: c.coach_light, bold: c.coach_bold }, body: c.coach_body, image: a.about.coachPhoto || a.about.aboutPhoto },
    footer: { blurb: c.footer_blurb },
  };
}

export type AnySpec = SiteSpec | PreRegSpec;
export const isPreReg = (s: AnySpec | undefined): s is PreRegSpec => Boolean(s && (s as PreRegSpec).kind === 'prereg');
