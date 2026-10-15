import type { EmailCampaign, LaunchEmail } from '../types';

/**
 * Kieran's follow-up for people who use the calorie calculator on physique-x.com.
 * Seven emails over two weeks: helpful first, then the membership.
 */
const SITE = 'www.physique-x.com';
const JOIN = {
  monthly: 'https://join.physique-x.com/p/physique-x-members-app/monthly',
  pricing: 'https://www.physique-x.com/#pricing',
  inside: 'https://www.physique-x.com/#inside',
};

const e = (n: number, offset: number, time: string, x: Pick<LaunchEmail, 'subject' | 'preview' | 'heading' | 'body' | 'button' | 'ps'> & { link?: string }): LaunchEmail => ({
  id: `flow-${n}`, list: 'flow', n, stage: 'launch', offset, time, ...x,
});

export const PHYSIQUE_X_CALCULATOR_EMAILS: LaunchEmail[] = [
  e(1, 0, 'now', {
    subject: 'Your numbers (and how to actually use them)',
    preview: 'A calculator gives you a starting point. Here is what to do with it.',
    heading: 'You’ve got your numbers. Now what?',
    body: [
      'Thanks for using the calculator. Your calories and macros are the same starting point I give my own members, so you’re already ahead of most people who just guess.',
      'One thing before you do anything else: treat these numbers as a starting point, not a verdict. The calculation is an estimate. Your body will tell you the rest.',
      'Here’s how I’d use them. Eat to those numbers as closely as you can for the next two weeks. Weigh yourself a few mornings a week, same time, before food. Then look at the average, not any single day.',
      'If the average is moving the way you want, brilliant, keep going. If it isn’t, we adjust. That’s it. No starting again, no new diet, just a small tweak based on what actually happened.',
      'Over the next couple of weeks I’ll send you a few short emails with the stuff that makes the biggest difference. No spam, ever, and if you’ve got a question, just hit reply. It comes straight to me.',
    ],
    button: '',
    ps: 'Screenshot your numbers or jot them in your notes now. You’ll want them for the next email.',
  }),
  e(2, 1, '09:00', {
    subject: 'If you only get one number right, make it this one',
    preview: 'The easiest win in the whole thing.',
    heading: 'Protein first. Everything else second.',
    body: [
      'If your calories feel like a lot to think about, start with one number: protein.',
      'Getting enough protein keeps you fuller for longer, helps you hold on to muscle while you lose fat, and helps you build it if that’s the goal. It’s the one I’d get right before anything else.',
      'The easiest way to hit it is to spread it out. Aim for a decent serving at every meal rather than trying to cram it all into dinner. Think eggs or Greek yoghurt in the morning, chicken, fish, mince or tofu at lunch and dinner, and a shake or some cottage cheese if you’re short at the end of the day.',
      'You don’t need to be perfect on day one. If you’re hitting your protein most days and roughly landing on your calories, you’re doing better than you think.',
    ],
    button: '',
    ps: 'Every one of the 800+ recipes in the Physique X app has the macros worked out for you, so you can see the protein before you cook it.',
  }),
  e(3, 3, '09:00', {
    subject: 'Don’t panic about the scales this week',
    preview: 'Why your weight can jump around, and what to look at instead.',
    heading: 'The scales will lie to you this week',
    body: [
      'Quick heads up, because this is where a lot of people quit.',
      'Your weight can swing by a kilo or two from one day to the next, and it’s rarely fat. A salty meal, more carbs than usual, a hard session, a bad night’s sleep or where you are in your cycle can all push it up for a day or two.',
      'So don’t judge your numbers on one weigh-in. Weigh a few mornings a week, take the average, and compare week to week. That’s the trend that matters.',
      'And use more than the scales. Progress photos, how your clothes fit, and whether your lifts are going up all count. Sometimes the scales sit still while everything else is moving in the right direction.',
      'This is exactly why my members do a weekly check-in in the app. Their stats, photos and notes go in once a week, I look at the whole picture, and the plan changes based on real data rather than one bad morning.',
    ],
    button: 'See how check-ins work',
    link: JOIN.inside,
    ps: 'If the number goes up after a weekend, don’t cut your food hard on Monday. Get back to your normal numbers and let it settle.',
  }),
  e(4, 5, '12:00', {
    subject: 'The hard part isn’t the numbers',
    preview: 'It’s everything around them. Here’s how I make it easier.',
    heading: 'Knowing your numbers is the easy bit',
    body: [
      'Here’s the honest truth. Working out your calories takes a minute. Hitting them, day after day, around work, kids, weekends and everything else, is the hard part.',
      'Most people end up with one app for food, another for workouts, a notes app for their plan and a load of screenshots. Then life gets busy and the whole thing falls apart.',
      'That’s why I built Physique X. Your targets, your food logging with a barcode scanner, your training plan, your recipes and your weekly check-in with me all sit in one app. You open it, you know what to eat and what to train, and you get on with your day.',
      'The training is written by me around the days you’ve got and the kit you have, at the gym or at home. The nutrition sits in the same place you log it. And when something needs changing, I change it.',
      'It’s £16.99 a month, rolling, and you can cancel any time.',
    ],
    button: 'Start for £16.99 a month',
    link: JOIN.monthly,
    ps: 'It replaces MyFitnessPal, Hevy, Apple Health, a notes app and your coaching DMs. One app instead of five.',
  }),
  e(5, 7, '18:00', {
    subject: 'A week in. This is where people slip',
    preview: 'It’s not the weekdays that get you.',
    heading: 'One week in: how’s it going?',
    body: [
      'You’re a week in. If it’s been a bit up and down, that’s completely normal.',
      'In my experience, it’s rarely the weekdays that undo people. It’s Friday night to Sunday. A takeaway, a few drinks, a big Sunday dinner, and suddenly Monday feels like starting again.',
      'You don’t need a perfect weekend. You need a good-enough one. Keep your protein up, have the meal you’re looking forward to, and get straight back to your numbers the next day. Consistent beats perfect every single time.',
      'Sarah, one of my members, put it better than I can: “I lost 12kg in 4 months without feeling like I was dieting. Having a coach in your pocket every day genuinely changes everything.” She didn’t do anything extreme. She just kept turning up, week after week, with the plan changing as she went.',
      'If you want that kind of structure behind you, it’s all in Physique X.',
    ],
    button: 'Join Physique X',
    link: JOIN.monthly,
    ps: 'Got a question about your numbers or your week? Reply to this email and tell me. I read every one.',
  }),
  e(6, 10, '09:00', {
    subject: 'Which plan should you go for?',
    preview: 'Same everything on every plan. Here’s how to choose.',
    heading: 'Monthly, 3 months or the year?',
    body: [
      'A few people have asked which Physique X plan to pick, so here’s the simple version.',
      'Every plan gets exactly the same thing: all 14 features, your training and nutrition, the recipe library, and your weekly check-ins with me. There’s no higher tier to upgrade to. The only difference is how long you commit for.',
      'Monthly is £16.99 and rolling, so it’s the most flexible way to start. The 3 month plan is £44.99, which works out at £14.99 a month, and it’s the one most people go for because it’s a solid block of time to build the habits and actually see the change. The annual plan is £114.99, just £9.58 a month, or about 32p a day.',
      'If you’re not sure, start monthly. If you know you’re ready to give it a proper go, the 3 months is where I’d point you.',
    ],
    button: 'Pick your plan',
    link: JOIN.pricing,
    ps: 'Whichever you choose, you can cancel any time on the monthly plan, and the longer plans just run for the term you pick.',
  }),
  e(7, 14, '09:00', {
    subject: 'Two weeks on: time to check your numbers',
    preview: 'This is the point where most people need a tweak.',
    heading: 'Two weeks in. Time for a check-in',
    body: [
      'It’s been about two weeks since you worked out your numbers, which is exactly when I’d review them.',
      'Look at your weekly averages. If your weight is moving the way you want at a steady pace, keep going as you are. If it hasn’t moved at all, a small change usually does it, often around 100 to 200 calories a day. If it’s moving faster than you’d like, you might be undereating, so bring them back up a touch.',
      'That right there is coaching. Not a new plan every Monday, just looking at what happened and making one sensible change. It’s what I do for every Physique X member, every week, inside the app.',
      'If you’d like me to do that for you, with your training written around your week and everything in one place, now’s a great time to start.',
    ],
    button: 'Join and I’ll adjust them for you',
    link: JOIN.monthly,
    ps: 'Rather talk it through first? Reply to this email or message me on WhatsApp from the site, and I’ll answer myself.',
  }),
];

/** The flow as stored in the dashboard: a draft for the REPS team to check before Kieran sees it. */
export function physiqueXCalculatorFlow(clientId: string, versionId: string, now = new Date().toISOString()): EmailCampaign {
  return {
    key: `${clientId}~calculator`,
    kind: 'flow',
    flow: {
      id: 'calculator',
      name: 'Calorie calculator follow-up',
      form: 'Calorie calculator',
      trigger: 'When someone gets their numbers from the calorie calculator',
      about: 'Sent to everyone who uses the calorie calculator, starting the moment they get their numbers. Helpful tips first, then the membership.',
    },
    clientId,
    status: 'draft',
    statusNote: 'First draft, ready for the REPS team to check',
    contact: 'Kieran',
    brand: { name: 'Physique X', coach: 'Kieran', primary: '#644DE3', secondary: '#F3F0FE', ink: '#111111', font: 'modern', replyTo: '' },
    launchDate: '',
    offerDays: 0,
    websiteUrl: SITE,
    discountCode: '',
    offer: 'Physique X membership from £9.58 a month',
    mailerlite: { state: 'not_scheduled', note: 'Set up as an automation in MailerLite once Kieran approves.' },
    versions: [{
      id: versionId, version: 'v1', label: 'v1 · First draft', sentNote: 'Written by the REPS team in Kieran’s voice',
      emails: PHYSIQUE_X_CALCULATOR_EMAILS, comments: [], state: 'published', createdAt: now,
    }],
  };
}
