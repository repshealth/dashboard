import type { EmailCampaign, LaunchEmail } from '../types';

/**
 * Josh Bell's follow-up for people who opt in to the Lean Body Academy VSL but don't book a call.
 * Seven plain emails over ten days, all pointing back to the watch page (video plus Josh's
 * 45 minute Vision Call calendar). Written by James; Josh's own greetings and sign-offs are kept,
 * so these use the plain style (no heading, greeting or sign-off added by the template).
 *
 * In MailerLite: trigger is joining the group "VSL Opt In - No Call Booked" (30 minutes after
 * opting in, only if no call is booked). Before each email, check: if in group "VSL Call Booked", exit.
 */
const WATCH = 'https://programme.leanbodyacademy.co.uk/watch.html';
const link = (text: string) => `[${text}](${WATCH})`;
const HEY = "Hey {$name|default('mate')},";

const e = (n: number, offset: number, x: Pick<LaunchEmail, 'subject' | 'preview' | 'body' | 'ps'>): LaunchEmail => ({
  id: `flow-${n}`, list: 'flow', n, stage: 'warmup', offset, time: offset === 0 ? 'now' : '',
  heading: '', button: '', link: WATCH, plain: true, ...x,
});

export const LEAN_BODY_VSL_NO_CALL_EMAILS: LaunchEmail[] = [
  e(1, 0, {
    subject: 'did you watch it {$name}?',
    preview: 'the bit most guys skip',
    body: [
      HEY,
      'Josh here.',
      'You grabbed my free video a little while ago, so first things first... did you make it to the end?',
      'If you did, you’ll know the whole point of it. Losing your belly fat and keeping it off doesn’t mean living in the gym or eating chicken and rice out of a tupperware 6 times a day.',
      'But here’s the bit most guys skip.',
      'Underneath the video there’s a spot to book a free call with me. Not a call centre. Not a ‘success coach’. Me.',
      'We’ll look at where you’re at right now, what’s been holding you back, and I’ll lay out exactly what it’ll take to hit your goal.',
      `${link('Grab a time that suits you here')}.`,
      'Haven’t watched it yet? Same link, the video’s right at the top.',
      'Josh B.',
    ],
    ps: 'There’s zero pressure on the call. If I don’t think I can help you, I’ll tell you straight.',
  }),
  e(2, 1, {
    subject: '{$name}?',
    preview: 'quick question mate',
    body: [
      'Hey mate',
      'Saw you watched my video yesterday but didn’t book in for a chat.',
      'Anything holding you back?',
      'Hit reply and let me know, I read every single one.',
      'Josh 🙌',
    ],
    ps: `If life just got in the way, here’s the link again: ${link('book your free call')}.`,
  }),
  e(3, 2, {
    subject: '2 and a half stone in 49 days??!!!',
    preview: 'Dan nearly didn’t bother',
    body: [
      HEY,
      '49 days isn’t a lot of time.',
      'So I get why some guys are sceptical. Every other person on Instagram has ‘coach’ in their bio and promises the world with nothing to back it up. The fitness industry is saturated, no doubt about it.',
      'But it’s saturated with sh*t.',
      'Take Dan.',
      'Dan had struggled for years to get the weight off. He was training, he just wasn’t losing any meaningful amount of fat. His doctor had given him a warning about his blood pressure and it was playing on his mind.',
      'He felt like he was banging his head against a brick wall.',
      'He’d tried diet after diet with nothing to show for it, so when he came to us he had the same doubts you probably have right now.',
      'Was this just another one that promises the world and turns out to be smoke and mirrors?',
      'Would it work for other guys but not him?',
      'Despite all that... Dan bit the bullet.',
      'He lost 2 and a half stone in 7 weeks. 35lbs. 15.8kg in 49 days.',
      'He’s got more energy, dropped a clothes size (he tried to invoice me for a new wardrobe), and his blood pressure improved too, so even his doctor’s happy.',
      'None of that happens if he talks himself out of taking the first step.',
      `Yours is a free call with me. ${link('Book it here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(4, 3, {
    subject: 'what actually happens on the call',
    preview: 'spoiler: no hard sell',
    body: [
      HEY,
      'Quick one, because I know what goes through most guys’ heads before booking a call with a coach.',
      '“Am I going to get pressured into something?”',
      '“What if I’m not in good enough shape yet?”',
      '“Will I even be speaking to Josh?”',
      'So here’s exactly how it goes.',
      '1. You speak to me. One to one. No call centre, no team of closers reading off a script.',
      '2. We look at where you’re at. Your training, your food, your week, your weekends, the lot. Honest chat, no judgement. I’ve coached 1000+ guys and heard every story going.',
      '3. You leave with a plan. You’ll know exactly what it’ll take to lose the belly fat and keep it off. Whether we work together or not, that plan is yours.',
      'And no, you don’t need to ‘get in shape first’. That’s like tidying up before the cleaner comes round. Guys join me at every stage.',
      'If I think I can help, I’ll tell you how. If I don’t, I’ll tell you that too.',
      `${link('Pick a time here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(5, 5, {
    subject: 'How Tony dropped 23.8kg in 16 weeks',
    preview: 'he’d tried literally everything',
    body: [
      HEY,
      'Got a story for you today.',
      'Tony came to me feeling miserable, embarrassed and stuck.',
      'He’d tried everything, and I mean EVERYTHING. Low carb. IIFYM. Intermittent fasting. Keto. 21 day challenges. Other personal trainers.',
      'If anything, he’d got fatter in the months before we started working together. Nothing was working no matter how low his food went.',
      'And it wasn’t just physical. He bought baggy clothes to hide his stomach. He’d look around the pool to see who was watching before taking his top off.',
      'In his head, his body had hit its limit.',
      'Does any of that sound familiar?',
      'When Tony first got on a call with me, I could tell he was apprehensive. Reaching out to a coach is daunting. You expect us to be all authoritarian with some sadistic love of suffering.',
      'That’s not my style.',
      'I told him I wouldn’t promise 20lbs off in a month, because extreme diets just end with you heavier than when you started. I’d actually have him eating more food than on any diet he’d done before. And no hours of daily cardio.',
      '16 weeks later Tony had dropped 23.8kg and looked that good he ended up doing a photoshoot.',
      'It all started with one call.',
      `${link('Book yours here')}.`,
      'Josh B.',
    ],
    ps: 'If you’ve ‘tried everything’ too, that’s exactly what I want to hear about on the call.',
  }),
  e(6, 7, {
    subject: 'ask yourself this {$name}...',
    preview: 'be honest with yourself',
    body: [
      HEY,
      'I want to ask you a few simple questions. And I really want you to sit with each one.',
      'How much would it be worth to never again do a last minute panic diet to drop the belly fat you’ve put on?',
      'How much would it be worth to stop the ‘train hard and eat well all week, then undo it all at the weekend’ cycle?',
      'How much would it be worth to eat out or grab a takeaway with no guilt, knowing it fits into your plan?',
      'How much would it be worth to never hide at the back of a group photo again, or dread taking your top off on holiday?',
      'Now flip it.',
      'If nothing changes, where will you be 6 months from now? Same weight. Same belly. Same Monday restart.',
      'Most guys sit on their hands. A month goes by, then 6, then a year, and they’re still treading water.',
      'You don’t have to be one of them.',
      `The first step costs you nothing but 45 minutes. ${link('Book your free call with me here')}.`,
      'Josh B.',
    ],
    ps: '',
  }),
  e(7, 10, {
    subject: 'should I stop chasing you?',
    preview: 'last one about this, promise',
    body: [
      HEY,
      'I’ve sent you a few emails about booking a call and haven’t heard back, so I’ll take the hint.',
      'This is the last one I’ll send about it.',
      'No hard feelings at all. Maybe the timing’s off. Maybe you’re cracking on by yourself. Fair play either way.',
      'But if part of you is still thinking about it, or something’s holding you back, just hit reply and tell me what it is. Even if it’s one word.',
      `And if you’re ready to get the belly fat gone for good, the door’s still open: ${link('book your free call here')}.`,
      'Either way, you’ll still get my emails with tips and the odd embarrassing story.',
      'Stay strong, get lean,',
      'Josh 💪',
    ],
    ps: '',
  }),
];

/** The flow as stored in the dashboard: a draft for the REPS team to check before Josh sees it. */
export function leanBodyVslNoCallFlow(clientId: string, versionId: string, now = new Date().toISOString()): EmailCampaign {
  return {
    key: `${clientId}~vsl-no-call`,
    kind: 'flow',
    flow: {
      id: 'vsl-no-call',
      name: 'VSL opt in, no call booked',
      form: 'VSL opt in',
      trigger: 'Joins the group “VSL Opt In - No Call Booked” 30 minutes after opting in, only if they haven’t booked a call',
      about: 'Seven emails over ten days for people who opted in to the free video but didn’t book a call. Every link goes to the video and Josh’s calendar. Before each email: if they’re in the group “VSL Call Booked”, they leave the flow.',
    },
    clientId,
    status: 'draft',
    statusNote: 'First draft, ready for the REPS team to check',
    contact: 'Josh Bell',
    brand: { name: 'Lean Body Academy', coach: 'Josh B.', primary: '#FF4545', secondary: '#FFF0F0', ink: '#111111', font: 'bold', replyTo: 'joshbell@leanbodyacademy.co.uk' },
    launchDate: '',
    offerDays: 0,
    websiteUrl: WATCH,
    discountCode: '',
    offer: 'Free 45 minute Vision Call with Josh',
    mailerlite: { state: 'not_scheduled', note: 'Set up as an automation in MailerLite: trigger on joining “VSL Opt In - No Call Booked”, and before each email exit anyone in “VSL Call Booked”.' },
    versions: [{
      id: versionId, version: 'v1', label: 'v1 · First draft', sentNote: 'Written by the REPS team in Josh’s voice',
      emails: LEAN_BODY_VSL_NO_CALL_EMAILS, comments: [], state: 'published', createdAt: now,
    }],
  };
}
