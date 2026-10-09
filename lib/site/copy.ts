import type { OnboardingAnswers } from './onboarding';

/** The words Claude writes for a client's site. Facts, prices and quotes come from the answers instead. */
export interface SiteCopy {
  nav_cta: string;
  hero_light: string;
  hero_bold: string;
  hero_sub: string;
  cta_secondary: string;
  band: string[];
  about_eyebrow: string;
  about_light: string;
  about_bold: string;
  about_p1: string;
  about_p2: string;
  features_light: string;
  features_bold: string;
  features_intro: string;
  features: { title: string; body: string }[];
  app_light: string;
  app_bold: string;
  app_intro: string;
  pricing_light: string;
  pricing_bold: string;
  pricing_sub: string;
  plan_includes: string;
  programmes_intro: string;
  programmes_banner: string;
  results_light: string;
  results_bold: string;
  results_intro: string;
  coach_light: string;
  coach_bold: string;
  coach_p1: string;
  coach_p2: string;
  coach_badge: string;
  faq: { q: string; a: string }[];
  capture_light: string;
  capture_bold: string;
  capture_body: string;
  footer_blurb: string;
}

const str = (description: string) => ({ type: 'string', description });

/** JSON schema sent to the Claude API so the reply always has this exact shape. */
export const COPY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    nav_cta: str('Button in the nav, 2 to 4 words, e.g. "Start free trial"'),
    hero_light: str('Hero headline line 1, 2 to 4 words, punchy'),
    hero_bold: str('Hero headline line 2, 2 to 4 words, ends with a full stop'),
    hero_sub: str('One or two sentences under the headline. Mention the price and free trial if given.'),
    cta_secondary: str('Secondary hero button, 2 to 4 words, e.g. "See what\'s inside"'),
    band: { type: 'array', items: str('Short fact, 2 to 5 words, only from facts given'), description: '4 or 5 items' },
    about_eyebrow: str('Tiny label, e.g. "What Strong With Dani is"'),
    about_light: str('Section headline line 1'),
    about_bold: str('Section headline line 2'),
    about_p1: str('2 sentences: what it is and who it is for'),
    about_p2: str('2 sentences: what it replaces and why it sticks'),
    features_light: str('Headline line 1, e.g. "Everything."'),
    features_bold: str('Headline line 2, e.g. "One price."'),
    features_intro: str('One or two short sentences'),
    features: {
      type: 'array',
      description: 'Exactly 6 items built from the features they listed',
      items: {
        type: 'object', additionalProperties: false,
        properties: { title: str('2 to 5 words'), body: str('One or two sentences, concrete') },
        required: ['title', 'body'],
      },
    },
    app_light: str('App section headline line 1'),
    app_bold: str('App section headline line 2'),
    app_intro: str('One or two sentences in the coach\'s voice'),
    pricing_light: str('Pricing headline line 1'),
    pricing_bold: str('Pricing headline line 2'),
    pricing_sub: str('One or two sentences about the plans and trial'),
    plan_includes: str('One line shown under every plan, what each includes'),
    programmes_intro: str('One or two sentences about buying a single programme'),
    programmes_banner: str('One sentence comparing a programme price with the membership price'),
    results_light: str('Results headline line 1'),
    results_bold: str('Results headline line 2'),
    results_intro: str('One or two sentences'),
    coach_light: str('Coach section headline line 1, e.g. "I built this for"'),
    coach_bold: str('Coach section headline line 2, e.g. "mums like me"'),
    coach_p1: str('First person, 2 to 3 sentences from their story'),
    coach_p2: str('First person, 2 sentences on how they coach now'),
    coach_badge: str('Short credential sticker, e.g. "Level 3 PT, coaching women for 7 years"'),
    faq: {
      type: 'array',
      description: '8 questions their audience would ask, answered only with facts given',
      items: {
        type: 'object', additionalProperties: false,
        properties: { q: str('Question'), a: str('Answer, 1 to 3 sentences') },
        required: ['q', 'a'],
      },
    },
    capture_light: str('Lead magnet headline line 1, e.g. "Take the free"'),
    capture_bold: str('Lead magnet headline line 2, the lead magnet name'),
    capture_body: str('One or two sentences on what they get'),
    footer_blurb: str('One sentence for the footer'),
  },
  required: [
    'nav_cta', 'hero_light', 'hero_bold', 'hero_sub', 'cta_secondary', 'band', 'about_eyebrow', 'about_light', 'about_bold',
    'about_p1', 'about_p2', 'features_light', 'features_bold', 'features_intro', 'features', 'app_light', 'app_bold', 'app_intro',
    'pricing_light', 'pricing_bold', 'pricing_sub', 'plan_includes', 'programmes_intro', 'programmes_banner', 'results_light',
    'results_bold', 'results_intro', 'coach_light', 'coach_bold', 'coach_p1', 'coach_p2', 'coach_badge', 'faq', 'capture_light',
    'capture_bold', 'capture_body', 'footer_blurb',
  ],
} as const;

/** Answers as plain text for the prompt. Image fields are left out. */
export function answersForPrompt(a: OnboardingAnswers) {
  const plans = a.offer.plans.filter((p) => p.price).map((p) => `${p.name}: £${p.price} per ${p.period}`).join('; ');
  return [
    `Brand: ${a.business.brandName}. Coach: ${a.business.coachName}. Instagram: ${a.business.instagram || 'n/a'}.`,
    `Tone of voice: ${a.brand.tone || 'friendly and direct'}.`,
    `Audience: ${a.audience.who}`,
    `Their struggles: ${a.audience.struggles}`,
    `Their goals: ${a.audience.goals}`,
    `Their objections: ${a.audience.objections}`,
    `Offer type: ${a.offer.type === 'app' ? 'a training app membership' : a.offer.type === 'coaching' ? 'online coaching' : 'app membership plus coaching'}, called "${a.offer.productName}".`,
    `Training: ${a.offer.location === 'both' ? 'gym and home' : a.offer.location}, ${a.offer.daysPerWeek} days a week, sessions around ${a.offer.sessionLength}.`,
    `Features: ${a.offer.features.join(', ') || 'not listed'}.`,
    `Free trial: ${a.offer.freeTrialDays ? `${a.offer.freeTrialDays} days` : 'none'}.`,
    `Plans: ${plans || 'not given'}.`,
    a.offer.programmes.length ? `One-off programmes: ${a.offer.programmes.map((p) => `${p.name} (${p.meta}, £${p.price}): ${p.description}`).join(' | ')}` : 'No one-off programmes.',
    `Credentials: ${a.proof.qualification || 'n/a'}; coaching ${a.proof.yearsCoaching || '?'} years; ${a.proof.clientsCoached || '?'} clients coached; rating ${a.proof.rating || 'n/a'} from ${a.proof.reviewCount || 'n/a'} reviews.`,
    `Coach story: ${a.about.story}`,
    `Lead magnet: ${a.leadMagnet.name}: ${a.leadMagnet.description}`,
    a.extra ? `Anything else: ${a.extra}` : '',
  ].filter(Boolean).join('\n');
}

export const COPY_SYSTEM = `You write website copy for fitness coaches, in British English.
Write in the coach's tone of voice, speaking to their audience's real struggles and goals.
Use only facts given in the brief. Never invent member numbers, review counts, results, awards or press mentions.
Keep headlines short and punchy. No em dashes. No emoji. No hype words like "revolutionary" or "game-changer".`;

const money = (p?: string) => (p ? `£${p.replace(/^£/, '')}` : '');

/**
 * Copy written from the answers with fixed sentence patterns.
 * Used in preview mode, and as a fallback if the Claude API is unavailable.
 */
export function fallbackCopy(a: OnboardingAnswers): SiteCopy {
  const brand = a.business.brandName || 'Your brand';
  const coach = a.business.coachName || 'your coach';
  const product = a.offer.productName || brand;
  const trial = a.offer.freeTrialDays;
  const first = a.offer.plans.find((p) => p.price);
  const where = a.offer.location === 'both' ? 'gym or home' : a.offer.location;
  const feats = a.offer.features.length ? a.offer.features : ['Workout plans', 'Meal plans', 'Weekly check-ins', 'Habit tracking', 'Community group', 'Progress photos'];
  const six = [...feats, 'Workout plans', 'Meal plans', 'Weekly check-ins', 'Habit tracking', 'Community group', 'Progress photos']
    .filter((x, i, arr) => arr.indexOf(x) === i).slice(0, 6);
  const featureBody: Record<string, string> = {
    'Workout plans': `Structured ${where} sessions, ${a.offer.daysPerWeek} days a week, that progress as you do.`,
    'Exercise video demos': 'Every exercise has a demo video, so you always know what good form looks like.',
    'Meal plans': 'Simple meals with targets set for you. Nothing banned, nothing weighed in shame.',
    Recipes: 'Recipes the whole family will eat, built around your targets.',
    'Calorie & macro tracking': 'Log food in the same place you train, with targets already worked out.',
    'Barcode scanner': 'Scan it, log it, done. Tracking takes seconds, not evenings.',
    'Habit tracking': 'Water, steps and sleep in one place, with streaks that keep you going.',
    'Weekly check-ins': `${coach} checks in every week, so you are never doing it on your own.`,
    'Progress photos': 'See the change week by week, even when the scales are being stubborn.',
    'Community group': 'A private group of people on the same plans, cheering each other on.',
    'Live classes': `Train live with ${coach} every week, or catch up on demand.`,
    'Period / cycle tracking': 'Train with your cycle, not against it.',
    'Apple & Google Health sync': 'Steps and activity pull straight in from your phone.',
    'Coach messaging': `Message ${coach} directly whenever you get stuck.`,
    'Goal setting': 'Set a clear goal and see exactly how each week moves you towards it.',
    'Injury support': 'Swaps and modifications so a niggle does not mean starting again.',
  };
  const trialLine = trial ? ` Your first ${trial} days are free.` : '';
  return {
    nav_cta: trial ? 'Start free trial' : 'Join now',
    hero_light: 'Your strongest',
    hero_bold: 'self starts here.',
    hero_sub: `${product} brings your training, food and accountability into one place.${first ? ` ${money(first.price)} a ${first.period}.` : ''}${trialLine}`,
    cta_secondary: "See what's inside",
    band: [
      `${feats.length} features ${a.offer.type === 'coaching' ? 'included' : 'in one app'}`,
      `${a.offer.daysPerWeek} days a week`,
      `${a.offer.sessionLength} sessions`,
      a.proof.clientsCoached ? `${a.proof.clientsCoached} clients coached` : `${where} plans`,
      trial ? `${trial} days free` : 'Cancel anytime',
    ],
    about_eyebrow: `What ${brand} is`,
    about_light: 'Your training and',
    about_bold: 'nutrition, together',
    about_p1: `${product} is built for ${a.audience.who ? a.audience.who.charAt(0).toLowerCase() + a.audience.who.slice(1) : 'people who want results that last'}. ${coach} writes the plans and you follow them, one session at a time.`,
    about_p2: 'No spreadsheets, no second tracking app, no starting again every Monday. Just a plan that fits your week and keeps moving.',
    features_light: 'Everything.',
    features_bold: 'One price.',
    features_intro: `${six.length} things you get from day one. Nothing is locked behind a higher tier.`,
    features: six.map((t) => ({ title: t, body: featureBody[t] || `${t}, built into ${product}.` })),
    app_light: 'Everything you need,',
    app_bold: 'right there in your pocket.',
    app_intro: `Every plan, meal and check-in lives in the ${product}.`,
    pricing_light: "If you're waiting for a sign,",
    pricing_bold: 'this is it',
    pricing_sub: `Same everything on every plan. The longer you commit, the less you pay.${trial ? ` The first ${trial} days are free on every plan.` : ''}`,
    plan_includes: `Full access to ${product}, every plan and every update.`,
    programmes_intro: 'Buy a single plan outright, yours forever. Every one is also included in the membership.',
    programmes_banner: a.offer.programmes[0] && first
      ? `One programme is ${money(a.offer.programmes[0].price)}. The membership is ${money(first.price)} a ${first.period} and includes every programme.`
      : 'Every programme is included in the membership.',
    results_light: 'Real people,',
    results_bold: 'real results',
    results_intro: 'Different starting points, the same plans you would start on Monday.',
    coach_light: 'I built this for',
    coach_bold: 'people like you',
    coach_p1: a.about.story || `I'm ${coach}, and I built ${brand} to make training simple enough to stick with.`,
    coach_p2: `Today I write every plan in ${product} and check in with members every week.`,
    coach_badge: [a.proof.qualification, a.proof.yearsCoaching && `coaching for ${a.proof.yearsCoaching} years`].filter(Boolean).join(', '),
    faq: [
      { q: `What do I get with ${product}?`, a: `${feats.slice(0, 5).join(', ')}, all in one place.` },
      ...(trial ? [{ q: `How does the ${trial} day free trial work?`, a: `Start any plan and the first ${trial} days are free. Cancel before then and you pay nothing.` }] : []),
      { q: 'Can I cancel whenever I want?', a: 'Yes. Cancel in a couple of taps, with no emails or phone calls needed.' },
      { q: "I'm a complete beginner. Is this for me?", a: 'Yes. Every exercise has guidance and the plans start where you are.' },
      { q: 'Do I need a gym membership?', a: a.offer.location === 'gym' ? 'The plans are written for a gym.' : 'No. There are home plans that need little or no equipment.' },
      { q: 'How much time do I need each week?', a: `Plan for ${a.offer.daysPerWeek} sessions a week of around ${a.offer.sessionLength}.` },
      { q: 'What if I get stuck?', a: a.business.publicEmail ? `Email ${a.business.publicEmail} and you'll hear back within a day.` : `Message ${coach} and you'll get an answer quickly.` },
    ],
    capture_light: 'Take the free',
    capture_bold: a.leadMagnet.name || 'starter guide',
    capture_body: `${a.leadMagnet.description || 'A free plan to get you started.'} Straight to your inbox, unsubscribe in one click.`,
    footer_blurb: `${product}. Written and coached by ${coach}.`,
  };
}
