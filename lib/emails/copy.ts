import { answersForPrompt } from '../site/copy';
import { launchOf, type OnboardingAnswers } from '../site/onboarding';
import { fmtLaunch, sequenceSlots, type Slot } from './schedule';
import type { EmailBrand, EmailCampaign, EmailListId, LaunchEmail } from './types';

/** What Claude writes for one email. */
export interface EmailCopy {
  subject: string;
  preview: string;
  heading: string;
  body: string[];
  button: string;
  ps: string;
}

const str = (description: string) => ({ type: 'string', description });
const EMAIL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    subject: str('Subject line, under 50 characters, no clickbait, sentence case'),
    preview: str('Preview text shown after the subject in the inbox, under 90 characters'),
    heading: str('Short heading at the top of the email, 3 to 8 words'),
    body: { type: 'array', items: str('One short paragraph, 1 to 3 sentences'), description: '3 to 5 paragraphs' },
    button: str('Button label linking to the website, 2 to 4 words. Empty string for warm-up emails 1 and 2.'),
    ps: str('Optional P.S. line, or empty string'),
  },
  required: ['subject', 'preview', 'heading', 'body', 'button', 'ps'],
} as const;

const SEQ = (about: string) => ({ type: 'array', items: EMAIL_SCHEMA, description: `Exactly 6 emails, in send order. ${about}` });

export const EMAILS_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    prereg: SEQ('For people who pre-registered. Emails 3 to 6 include the launch offer.'),
    public: SEQ('For the general email list. Same journey, full price, no discount.'),
  },
  required: ['prereg', 'public'],
} as const;

export const EMAILS_SYSTEM = `You write launch email sequences for fitness coaches launching their own app, in British English.
Write as the coach, in first person, in the exact tone of voice described in their onboarding answers. Match how they talk: their words, their energy, their audience.
Speak to the audience's real struggles, goals and objections. Short paragraphs, easy to read on a phone.
Use only facts given in the brief. Never invent numbers, results, reviews, prices or offers.
The button in each launch email links to the coach's main website, so do not write out URLs.
Emails to the general list must not mention any discount or code: they get full price. A free trial may be mentioned if the brief has one.
No em dashes. No emoji. No hype words like "revolutionary" or "game-changer". No fake urgency beyond the real offer deadline.`;

/** The brief sent to Claude with the onboarding answers. */
export function emailsPrompt(a: OnboardingAnswers, voice = '') {
  const l = launchOf(a);
  const slots = sequenceSlots(l.offerDays);
  const lastDay = slots[5].offset;
  return [
    'Write two 6-email launch sequences for this coach.',
    '',
    answersForPrompt(a),
    '',
    voice ? `${voice}\nThis comes from their real calls, so it outranks the tone line in the form.\n` : '',
    `Launch date: ${fmtLaunch(l.date) || 'to be confirmed'}.`,
    `Pre-registration offer: ${l.offer || 'none given, so focus on early access'}${l.code ? `, code ${l.code}` : ''}. It stays open for ${l.offerDays} days, closing at midnight ${lastDay} day${lastDay === 1 ? '' : 's'} after launch day.`,
    l.code ? 'In the pre-registration launch emails a box showing the code is added under the text automatically, so you can refer to it.' : '',
    '',
    'Send plan, the same for both lists:',
    ...slots.map((s) => `Email ${s.n}: ${s.offset === 0 ? 'launch day' : s.offset < 0 ? `${-s.offset} days before launch` : `${s.offset} day${s.offset === 1 ? '' : 's'} after launch`}. ${s.purpose}.${s.stage === 'warmup' ? ' No button.' : ' Button to the website.'}`),
  ].filter((x) => x !== '').join('\n');
}

const lower = (s: string) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const firstSentence = (s: string) => (s.split(/(?<=[.!?])\s+/)[0] || '').trim();

/** Email copy from fixed sentence patterns, for preview mode or if Claude is unavailable. */
export function fallbackEmails(a: OnboardingAnswers): Record<EmailListId, EmailCopy[]> {
  const l = launchOf(a);
  const brand = a.business.brandName || 'the app';
  const coach = a.business.coachName || a.contact.name.split(' ')[0] || 'Your coach';
  const app = a.offer.productName || brand;
  const launch = fmtLaunch(l.date) || 'launch day';
  const struggles = lower(a.audience.struggles) || 'not having the time or a plan that sticks';
  const goals = lower(a.audience.goals) || 'feel stronger and fitter';
  const objection = lower(a.audience.objections.split(/[,.]/)[0] || '') || 'worried it will not fit your week';
  const feats = (a.offer.features.length ? a.offer.features : ['Workout plans', 'Meal plans', 'Weekly check-ins']).slice(0, 4);
  const trial = a.offer.freeTrialDays ? `There is a ${a.offer.freeTrialDays} day free trial, so you can try it before you pay a penny.` : '';
  const offer = l.offer ? lower(l.offer) : '';
  const story = firstSentence(a.about.story);
  const review = a.proof.reviews[0];
  const days = Number(l.offerDays) || 5;
  const sessions = `${a.offer.daysPerWeek} sessions a week, around ${a.offer.sessionLength} each`;

  const warmups = (pre: boolean): EmailCopy[] => [
    {
      subject: pre ? `You're on the list for ${app}` : `Something I've been building`,
      preview: `Why I built it, and what happens on ${launch}.`,
      heading: pre ? 'Thanks for being early' : 'I have been working on something',
      body: [
        pre ? `You pre-registered for ${app}, so you are one of the first to hear everything. Thank you.` : `For months I have been quietly building something for you, and it is nearly ready.`,
        story ? `${story}` : `I built this because I kept seeing the same thing over and over.`,
        `So many of you tell me the hard part is ${struggles}. ${app} is my answer to that.`,
        `It goes live on ${launch}. More on what is inside in a few days.`,
      ],
      button: '',
      ps: pre && offer ? `Because you signed up early, you will get ${offer} on launch day. Keep an eye on your inbox.` : '',
    },
    {
      subject: `A look inside ${app}`,
      preview: `${feats.slice(0, 3).join(', ')} and more.`,
      heading: 'Here is what is inside',
      body: [
        `${app} launches on ${launch}, so I wanted to show you what you are getting.`,
        `Inside: ${feats.join(', ').toLowerCase()}. ${sessions}, ${a.offer.location === 'both' ? 'at the gym or at home' : a.offer.location === 'gym' ? 'in the gym' : 'at home'}.`,
        `It is built to help you ${goals}, without your whole life having to change.`,
        pre ? `On launch day you will get an email from me with the link${offer ? ` and your ${offer}` : ''}.` : `On launch day I will send you the link.`,
      ],
      button: '',
      ps: '',
    },
  ];

  const launches = (pre: boolean): EmailCopy[] => {
    const deal = pre && offer ? ` and, because you pre-registered, you get ${offer}` : '';
    return [
      {
        subject: `${app} is live`,
        preview: pre && offer ? `Your ${offer} is ready.` : 'The doors are open.',
        heading: `It's here`,
        body: [
          `${app} is officially live${deal}.`,
          `Everything you need to ${goals} is now in one place: ${feats.slice(0, 3).join(', ').toLowerCase()}.`,
          pre && offer ? `Your offer is open for ${days} days. Tap below to join.` : trial || 'Tap below to have a look.',
        ],
        button: pre && offer ? 'Claim my offer' : 'Join now',
        ps: '',
      },
      {
        subject: pre ? `Worried you are not ready?` : `"I'm not sure it's for me"`,
        preview: `If you are ${objection}, read this.`,
        heading: 'This one is for you if you are unsure',
        body: [
          `A lot of people tell me they are ${objection}. I get it.`,
          `That is exactly why ${app} starts where you are. ${sessions}, with every session laid out for you.`,
          trial || `You do not need to be ready. You just need to start.`,
        ],
        button: pre && offer ? 'Join with my discount' : 'See the app',
        ps: '',
      },
      {
        subject: 'What happens when you stick with it',
        preview: review ? `"${review.quote.slice(0, 70)}"` : 'Real routines, real progress.',
        heading: 'This is what it is all for',
        body: [
          review ? `"${review.quote}" That is ${review.name}${review.detail ? `, ${lower(review.detail)}` : ''}.` : `The people I coach do not have more time than you. They have a plan they can stick to.`,
          `${app} gives you that plan, so you can ${goals}.`,
          pre && offer ? `Your ${offer} is still open, but not for long.` : `Tap below to join.`,
        ],
        button: pre && offer ? 'Claim my offer' : 'Join now',
        ps: '',
      },
      {
        subject: pre && offer ? 'Your launch offer ends tonight' : 'Last call for launch week',
        preview: pre && offer ? `Midnight tonight is the last chance for ${offer}.` : 'A quick last note from me.',
        heading: pre && offer ? 'Last chance' : 'One last thing',
        body: [
          pre && offer ? `Just a quick one. Your ${offer} ends at midnight tonight.` : `Launch week is nearly over, so this is my last email about it.`,
          `If you have been thinking about it, this is your sign. ${sessions}, all planned for you.`,
          pre && offer ? `After tonight it goes back to full price.` : trial || `I would love to have you in.`,
        ],
        button: pre && offer ? 'Claim it before midnight' : 'Join now',
        ps: `${coach}`,
      },
    ];
  };

  return { prereg: [...warmups(true), ...launches(true)], public: [...warmups(false), ...launches(false)] };
}

/** Turns the copy into the emails, with their send slots. */
export function toEmails(copy: Record<EmailListId, EmailCopy[]>, slots: Slot[], fallback: Record<EmailListId, EmailCopy[]>): LaunchEmail[] {
  const out: LaunchEmail[] = [];
  for (const list of ['prereg', 'public'] as EmailListId[]) {
    slots.forEach((s, i) => {
      const c = copy[list]?.[i] ?? fallback[list][i];
      const f = fallback[list][i];
      out.push({
        id: `${list}-${s.n}`, list, n: s.n, stage: s.stage, offset: s.offset, time: s.time,
        subject: c.subject || f.subject,
        preview: c.preview || f.preview,
        heading: c.heading || f.heading,
        body: (c.body?.length ? c.body : f.body).filter((p) => p.trim()),
        // Warm-ups never have a button; launch emails always do.
        button: s.stage === 'warmup' ? '' : c.button || f.button || 'Join now',
        ps: c.ps ?? '',
      });
    });
  }
  return out;
}

const darken = (hex: string) => (/^#[0-9a-f]{6}$/i.test(hex) ? hex : '#111111');

/** The campaign record made from the onboarding answers. */
export function buildCampaign(a: OnboardingAnswers, clientId: string, emails: LaunchEmail[], by: 'claude' | 'template', logoUrl?: string): EmailCampaign {
  const l = launchOf(a);
  const brand: EmailBrand = {
    name: a.business.brandName,
    coach: a.business.coachName || a.contact.name.split(' ')[0] || a.business.brandName,
    logoUrl: logoUrl ?? a.brand.logo,
    primary: darken(a.brand.primary),
    secondary: darken(a.brand.secondary),
    ink: '#141414',
    font: a.brand.font,
    replyTo: a.business.publicEmail || a.contact.email,
  };
  return {
    clientId,
    status: 'draft',
    statusNote: by === 'claude' ? 'Written by Claude from the onboarding form' : 'Written from the onboarding form',
    contact: brand.coach,
    brand,
    launchDate: l.date,
    offerDays: Number(l.offerDays) || 5,
    websiteUrl: l.websiteUrl,
    discountCode: l.code,
    offer: l.offer,
    mailerlite: { state: 'not_scheduled', note: 'Scheduled in MailerLite once the client approves' },
    versions: [{
      id: `${clientId}-e1`, version: 'v1', label: 'v1 · First draft', state: 'published',
      sentNote: 'Written from the onboarding form', emails, comments: [], createdAt: new Date().toISOString(),
    }],
  };
}
