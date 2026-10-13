/**
 * Everything one client website needs. The template (components/site/TemplateSite.tsx)
 * draws the whole page from this, so a new client's site is just a new SiteSpec.
 */

export type FontStyle = 'bold' | 'modern' | 'elegant';

/** The website designs a generated site can use. Shape Up is the original, kept for older sites. */
export type SiteDesign = 'shapeup' | 'pulse' | 'arena' | 'studio';

/** The designs offered for new sites, for the intake form and the agency's look switcher. */
export const LOOKS: { id: Exclude<SiteDesign, 'shapeup'>; name: string; desc: string; after: string }[] = [
  { id: 'arena', name: 'Arena', desc: 'Black, loud and athletic. Huge capitals, a moving light grid, poster-style programmes.', after: 'Centr, Ladder, Physique X' },
  { id: 'studio', name: 'Studio', desc: 'Light, warm and editorial. Italic serif accents, soft moving shapes, arch photos.', after: 'Lean with Lilly, Harriet Harper, Sweat, Shreddy' },
  { id: 'pulse', name: 'Pulse', desc: 'Dark hero with a glow in your colours, bright sections below.', after: 'EvolveYou, Sweat' },
];

export interface Headline {
  /** Lighter first line, e.g. "Everything you need," */
  light: string;
  /** Heavier second line, e.g. "right there in your pocket." */
  bold: string;
}

export interface Stat { value: string; label: string }

export interface Plan {
  name: string; // "Monthly"
  price: string; // "£24.99"
  period: string; // "per month, rolling"
  perDay?: string; // "83p a day"
  includes: string; // one line under the button
  popular: boolean;
  image?: string;
}

export interface Programme {
  tag?: string; // "New programme!"
  meta: string; // "10 weeks · Gym + home"
  name: string;
  body: string;
  price: string;
  image?: string;
}

export interface Story {
  name: string; // "Sarah"
  label: string; // "12 weeks"
  before?: string;
  after?: string;
  quote: string;
}

export interface Review { quote: string; name: string; detail: string }
export interface Faq { q: string; a: string }

export interface SiteSpec {
  slug: string;
  /** Which website design draws it. Older sites without it use Shape Up. */
  design?: SiteDesign;
  brand: {
    name: string;
    logoUrl?: string;
    primary: string; // buttons, band, highlight card
    secondary: string; // nav button, popular plan, tags
    ground: string; // page background tint
    ink: string; // text
    font: FontStyle;
  };
  nav: { cta: string; links: string[] };
  hero: {
    proof?: string; // "4.9 from 300+ client reviews"
    headline: Headline;
    sub: string;
    ctaPrimary: string;
    ctaSecondary: string;
    smallPrint: string;
    image?: string;
    screens: string[];
  };
  band: string[];
  about: {
    eyebrow: string;
    headline: Headline;
    p1: string;
    p2: string;
    stats: Stat[];
    image?: string;
  };
  features: {
    eyebrow: string;
    headline: Headline;
    intro: string;
    items: { title: string; body: string }[];
    cta: string;
  };
  app: null | {
    eyebrow: string;
    headline: Headline;
    intro: string;
    screens: string[];
    pills: string[];
  };
  pricing: {
    eyebrow: string;
    headline: Headline;
    sub: string;
    plans: Plan[];
    trust: string[];
  };
  programmes: null | {
    eyebrow: string;
    headline: Headline;
    intro: string;
    items: Programme[];
    banner: string;
  };
  results: null | {
    eyebrow: string;
    headline: Headline;
    intro: string;
    stories: Story[];
    reviews: Review[];
  };
  coach: {
    eyebrow: string;
    headline: Headline;
    p1: string;
    p2: string;
    stats: Stat[];
    badge: string;
    image?: string;
    instagram?: string;
  };
  faq: {
    headline: Headline;
    email?: string;
    items: Faq[];
  };
  capture: {
    eyebrow: string;
    headline: Headline;
    body: string;
    button: string;
    small: string;
    /** No free guide yet: the closing section asks people to join instead. */
    off?: boolean;
  };
  footer: { blurb: string };
}
