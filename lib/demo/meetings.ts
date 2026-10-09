import type { Meeting, TranscriptLine, VoiceProfile } from '../meetings/types';

/** Example calls for the preview. All invented. */
const T = (rows: [string, string, string?][]): TranscriptLine[] => rows.map(([speaker, text, at]) => ({ speaker, text, at }));
const J = 'James Wright';
const D = 'Dani Cole';

export const demoMeetings: Meeting[] = [
  {
    id: 'm-dani-3', clientId: 'strong-with-dani', title: 'Strong With Dani website review', startedAt: '2026-10-08T17:30:00', durationMins: 24,
    attendees: ['dani@example.com', 'james@fitpreneuragency.com'], source: 'gemini', visibleToClient: true,
    summary: 'James walked Dani through the first draft of her website and pre-registration page. Dani liked the layout and colours but wants the hero copy to sound more like her and to swap in a photo from her beach shoot. They agreed the launch emails will lean into real-life mum routines rather than transformation talk.',
    details: [
      'Website: Dani is happy with the structure and the pink. She wants the hero line to mention busy mums directly.',
      'Photos: Dani will send the beach shoot photos for the hero and the coach section.',
      'Emails: Dani does not want anything that sounds salesy. She prefers "chatting to a friend" over hard selling.',
    ],
    nextSteps: [
      'Dani will leave comments on the website in the dashboard.',
      'Dani will send the beach shoot photos by Monday.',
      'James will update the launch emails once comments are in.',
    ],
    transcript: T([
      [J, 'Right, so this is the first draft. Homepage first, then the pre-reg page.', '00:00:05'],
      [D, 'Oh I love the pink. Honestly, that is so me. Proper bold.', '00:00:31'],
      [J, 'Good. What about the headline up top?', '00:01:02'],
      [D, 'It is nice, but it is a bit, I don\'t know, gym-bro? My girls are mums. They\'re knackered. They want something that fits real life, not a six pack in six weeks.', '00:01:10'],
      [J, 'Makes sense. Something that speaks to busy mums straight away.', '00:01:40'],
      [D, 'Yes. Like, training, food and accountability in one app, built for busy mums. No faff. That\'s literally the whole point.', '00:01:48'],
      [J, 'Love that. Drop it as a comment on the hero and we\'ll get it changed.', '00:02:15'],
      [D, 'And the photo, can we use one from my beach shoot? That one is a bit old now.', '00:02:30'],
      [J, 'Of course. Send them over and we\'ll swap it in.', '00:02:41'],
      [J, 'On the emails, how do you feel about a discount for the pre-reg list?', '00:10:02'],
      [D, 'Yeah, thirty percent for the first three months. But I don\'t want it to sound salesy. I\'m not about that. I want it to feel like I\'m chatting to a friend over a brew.', '00:10:12'],
      [J, 'Got it. Warm, direct, no pressure.', '00:10:40'],
      [D, 'Exactly. Be real with them. If they\'re not ready, that\'s fine, I\'ll still be here. Let\'s crack on.', '00:10:48'],
    ]),
  },
  {
    id: 'm-dani-2', clientId: 'strong-with-dani', title: 'Strong With Dani onboarding call', startedAt: '2026-10-02T10:00:00', durationMins: 38,
    attendees: ['dani@example.com', 'james@fitpreneuragency.com'], source: 'gemini', visibleToClient: true,
    summary: 'James and Dani went through the onboarding form together. They set the app launch for the end of October, agreed a 30% pre-registration offer, and talked through her audience: busy mums aged 28 to 45 who used to train.',
    details: [
      'Launch: end of October, with a pre-registration page live as soon as possible.',
      'Offer: 30% off the first 3 months for anyone who pre-registers, code STRONG30.',
      'Audience: mums who used to train, have no time, and keep starting again on Mondays.',
      'Tone: warm, direct, no-nonsense. Dani swears a little on Instagram but wants emails clean.',
    ],
    nextSteps: [
      'Dani will submit the onboarding form with her photos.',
      'James will build the website, pre-registration page and launch emails from the form.',
    ],
    transcript: T([
      [J, 'So tell me about the women you work with.', '00:03:10'],
      [D, 'Mums, mostly. Late twenties to mid forties. They used to train, pre kids, and now they feel like a stranger in their own body. I get it because that was me.', '00:03:16'],
      [D, 'They don\'t need another influencer shouting at them. They need someone to say, look, twenty five minutes, three times a week, you\'ve got this.', '00:03:45'],
      [J, 'And what stops them signing up?', '00:05:02'],
      [D, 'Honestly? They think they\'re too unfit to start. Or they think they need a gym. Or they\'ve tried an app before and quit by February. Every single one says the Monday thing. Starting again every Monday.', '00:05:08'],
      [J, 'How do you want to come across in the emails?', '00:20:30'],
      [D, 'Like me. Warm, but I\'ll tell you straight. No faff. Real life. If the kids are screaming, do ten minutes and call it a win.', '00:20:36'],
      [D, 'I\'m not about the before and after obsession. It\'s about feeling strong again and having energy for your kids.', '00:21:05'],
      [J, 'Perfect. And the launch offer?', '00:28:40'],
      [D, 'Thirty percent off the first three months for the pre-reg girls. They backed me early, they should get looked after.', '00:28:44'],
    ]),
  },
  {
    id: 'm-dani-1', clientId: 'strong-with-dani', title: 'REPS discovery call: Dani', startedAt: '2026-09-24T13:00:00', durationMins: 22,
    attendees: ['dani@example.com', 'james@fitpreneuragency.com'], source: 'gemini', visibleToClient: false,
    summary: 'Discovery call. Dani has an engaged Instagram following of mums and wants her own app. James explained the Reps app and the launch process. Dani signed up at the end of the call.',
    details: ['Internal sales notes: hidden from the client account by the REPS team.'],
    nextSteps: ['James will send the payment link and the onboarding form.'],
    transcript: T([
      [J, 'What made you look at having your own app?', '00:01:00'],
      [D, 'I\'m sick of sending PDFs, honestly. My girls deserve something proper. Something that feels like me in their pocket.', '00:01:05'],
      [D, 'I\'ve got about twelve hundred on my email list and they\'re dead keen. Let\'s crack on.', '00:15:20'],
    ]),
  },
  {
    id: 'm-unassigned-1', clientId: null, title: 'Discovery call: Jade (Lift With Jade)', startedAt: '2026-10-07T11:00:00', durationMins: 18,
    attendees: ['jade.lifts@example.com', 'james@fitpreneuragency.com'], source: 'gemini', visibleToClient: true,
    summary: 'Discovery call with Jade, a strength coach thinking about launching her own app. Not a client yet, so this call is not linked to an account.',
    details: [], nextSteps: ['James will follow up with pricing on Friday.'],
    transcript: T([
      [J, 'Thanks for jumping on, Jade.', '00:00:04'],
      ['Jade Ellis', 'No worries! So I coach about forty women online and I want to move everyone into an app.', '00:00:09'],
    ]),
  },
];

export const demoVoice: VoiceProfile[] = [{
  clientId: 'strong-with-dani',
  summary: 'Dani talks like a mate who happens to be a coach: warm, straight-talking and practical, with no hype. She speaks to tired mums about real life rather than transformations, and keeps things light with a bit of humour.',
  traits: ['Short, punchy sentences', 'Warm but tells you straight', 'Talks about real life and busy mums, not six packs', 'Uses British, informal words', 'Reassuring: "you\'ve got this", small wins count', 'Dislikes anything salesy'],
  phrases: ['honestly', 'no faff', 'real life', 'proper', 'knackered', 'let\'s crack on', 'my girls', 'you\'ve got this', 'starting again every Monday', 'call it a win'],
  avoid: ['Hard selling or pushy urgency', 'Before and after obsession', 'Gym-bro language like "shred" or "beast mode"', 'Corporate words'],
  meetingsUsed: 3,
  updatedAt: '2026-10-08T18:10:00',
  by: 'claude',
}];
