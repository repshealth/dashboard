import type { EmailCampaign, LaunchEmail } from '../types';

/**
 * Josh Bell's Black Friday Shred In 7 waitlist emails. Seven plain emails, one a day from
 * Thursday 19 to Thursday 26 November 2026 (no Sunday send), to everyone on Josh's list,
 * all pointing to the waitlist page. Spaces open on Black Friday (27 November); the Shred
 * starts on 4 January 2027 and includes a training plan, the December Survival Guide and a
 * Roadmap to Success call with Josh. Plain style, Josh's own greetings and sign-offs.
 *
 * In MailerLite: seven scheduled campaigns to all subscribers. From email 2, leave out anyone
 * who has already joined the waitlist.
 */
const WAITLIST = 'https://programme.leanbodyacademy.co.uk/black-friday.html';
const link = (text: string) => `[${text}](${WAITLIST})`;
const HEY = "Hey {$name|default('mate')},";

const e = (n: number, offset: number, x: Pick<LaunchEmail, 'subject' | 'preview' | 'body' | 'ps'>): LaunchEmail => ({
  id: `flow-${n}`, list: 'flow', n, stage: 'warmup', offset, time: '09:00',
  heading: '', button: '', link: WAITLIST, plain: true, ...x,
});

export const LEAN_BODY_BLACK_FRIDAY_EMAILS: LaunchEmail[] = [
  e(1, 0, {
    subject: 'something new for January',
    preview: 'and you can get first dibs',
    body: [
      HEY,
      'Quick one, because I’ve got some news.',
      'I’m opening a small number of spaces for something I’m calling the Shred In 7.',
      'It starts on 4th January 2027, and it’s built for one thing: getting you leaner, fast, at the start of the new year, without the usual January crash diet that falls apart by the 3rd week.',
      'Spaces open on Black Friday. But there are only a few, and the waitlist gets first pick.',
      'Getting on the list takes 10 seconds. Name, email and your Instagram. That’s it.',
      `${link('Join the Shred In 7 waitlist here')}.`,
      'More on what’s included tomorrow.',
      'Josh B.',
    ],
    ps: '',
  }),
  e(2, 1, {
    subject: 'the December problem',
    preview: 'why most guys start January heavier',
    body: [
      HEY,
      'Here’s what normally happens.',
      'You tell yourself you’ll start properly in January. Fair enough.',
      'Then December hits. Work do. Christmas drinks. Selection boxes “for the kids”. A month of “it’s Christmas, isn’t it”.',
      'By the time January comes round, you’re half a stone heavier and starting from further back than you were in November.',
      'That’s exactly why the Shred In 7 doesn’t start in January. Not really.',
      'Everyone who gets a space gets my December Survival Guide the moment they join. It shows you how to enjoy Christmas, have the drinks, eat the dinner, and still walk into 4th January ready to go instead of playing catch-up.',
      'So you start the Shred ahead, not behind.',
      `${link('Get on the waitlist here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(3, 2, {
    subject: 'what you actually get',
    preview: '3 things, no fluff',
    body: [
      HEY,
      'A few of you have asked what’s in the Shred In 7, so here it is.',
      '1. A training plan. Built so you know exactly what to do every session. No guessing, no wandering round the gym.',
      '2. The December Survival Guide. So Christmas doesn’t undo you before you’ve even started.',
      '3. A Roadmap to Success call with me. One to one. We’ll go through where you’re at, what’s held you back before, and exactly what your next few weeks look like.',
      'It all kicks off on 4th January 2027.',
      'Spaces open on Black Friday, and the waitlist hears first.',
      `${link('Join the waitlist here')}.`,
      'Josh B.',
    ],
    ps: 'The call is with me. Not a team member, not a “success coach”. Me.',
  }),
  e(4, 4, {
    subject: '2 and a half stone in 7 weeks',
    preview: 'Dan nearly didn’t bother',
    body: [
      HEY,
      'Let me tell you about Dan.',
      'Dan had been training for years, he just wasn’t losing any real fat. His doctor had warned him about his blood pressure and it was playing on his mind.',
      'He’d tried diet after diet. So when he came to me, he had the same doubts you might have right now. Is this just another thing that promises the world?',
      'He went for it anyway.',
      '7 weeks later he was 2 and a half stone lighter. More energy, a clothes size down, and his blood pressure improved too.',
      'That’s what a short, focused block can do when the plan is right and someone’s actually in your corner.',
      'That’s what the Shred In 7 is built around.',
      `${link('Get on the waitlist here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(5, 5, {
    subject: '“I’ll just do it myself in January”',
    preview: 'you might, but be honest',
    body: [
      HEY,
      'Some of you are thinking, “I’ll just sort myself out in January.”',
      'And you might. But be honest with yourself.',
      'How did last January go? And the one before?',
      'Most guys don’t fail because they’re lazy. They fail because they start with no plan, try to do everything at once, and they’re on their own when it gets hard in week 3.',
      'The Shred In 7 fixes all 3. You get the plan, you get through December first, and you get me on a call making sure you’re set up properly.',
      'Joining the waitlist doesn’t commit you to anything. It just means you hear first when spaces open on Black Friday and get first pick before anyone else.',
      `${link('Join here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(6, 6, {
    subject: 'spaces are limited',
    preview: 'here’s how it’ll work on Friday',
    body: [
      HEY,
      'Quick heads up on how Black Friday is going to work.',
      'I’m only opening a small number of spaces for the Shred In 7. Every person gets a call with me, so I can’t take everyone.',
      'The waitlist gets the link first, before I announce it anywhere else. When they’re gone, they’re gone.',
      `If you want one, the only thing you need to do right now is ${link('get your name down')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(7, 7, {
    subject: 'tomorrow',
    preview: 'last chance to get on the list',
    body: [
      HEY,
      'Spaces for the Shred In 7 open tomorrow, on Black Friday.',
      'The waitlist gets first access, so if you’ve been thinking about it, today’s the day to get on it.',
      'Here’s what you get:',
      '• A training plan',
      '• The December Survival Guide',
      '• A Roadmap to Success call with me',
      '• A start on 4th January 2027, ready to go instead of playing catch-up',
      `${link('Get on the waitlist here')}.`,
      'See you tomorrow.',
      'Josh B.',
    ],
    ps: 'If you’re already on the list, you don’t need to do anything. Keep an eye on your inbox tomorrow.',
  }),
];

/** The emails as stored in the dashboard: a draft for the REPS team to check before Josh sees it. */
export function leanBodyBlackFridayFlow(clientId: string, versionId: string, now = new Date().toISOString()): EmailCampaign {
  return {
    key: `${clientId}~black-friday-shred-in-7`,
    kind: 'flow',
    flow: {
      id: 'black-friday-shred-in-7',
      name: 'Black Friday Shred In 7 waitlist',
      form: 'Black Friday Shred In 7',
      trigger: 'Sent to all subscribers, one a day at 9am from Thursday 19 to Thursday 26 November (no Sunday email). Day 0 is Thursday 19 November.',
      about: 'Seven emails to get Josh’s list onto the Shred In 7 waitlist before spaces open on Black Friday (27 November). The Shred starts on 4 January 2027 and includes a training plan, the December Survival Guide and a Roadmap to Success call with Josh. Every link goes to the waitlist page. From email 2, leave out anyone already on the waitlist.',
    },
    clientId,
    status: 'draft',
    statusNote: 'First draft, ready for the REPS team to check',
    contact: 'Josh Bell',
    brand: { name: 'Lean Body Academy', coach: 'Josh B.', primary: '#FF4545', secondary: '#FFF0F0', ink: '#111111', font: 'bold', replyTo: 'joshbell@leanbodyacademy.co.uk' },
    launchDate: '2026-11-19',
    offerDays: 0,
    websiteUrl: WAITLIST,
    discountCode: '',
    offer: 'Shred In 7: training plan, December Survival Guide and a Roadmap to Success call. Starts 4 January 2027.',
    mailerlite: { state: 'not_scheduled', note: 'Set up as seven scheduled campaigns to all subscribers, 9am each day from 19 to 26 November (no Sunday). From email 2, exclude anyone who has already joined the waitlist.' },
    versions: [{
      id: versionId, version: 'v1', label: 'v1 · First draft', sentNote: 'Written by the REPS team in Josh’s voice',
      emails: LEAN_BODY_BLACK_FRIDAY_EMAILS, comments: [], state: 'published', createdAt: now,
    }],
  };
}
