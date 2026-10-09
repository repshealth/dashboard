import type { FontStyle } from './spec';

/** What a client fills in on the onboarding form. Image fields hold a URL (live) or a data URL (preview). */
export interface OnboardingAnswers {
  contact: { name: string; email: string; phone: string };
  business: { brandName: string; coachName: string; instagram: string; publicEmail: string };
  brand: { primary: string; secondary: string; font: FontStyle; tone: string; logo?: string };
  audience: { who: string; struggles: string; goals: string; objections: string };
  offer: {
    type: 'app' | 'coaching' | 'hybrid';
    productName: string;
    location: 'gym' | 'home' | 'both';
    daysPerWeek: string; // "3–5"
    sessionLength: string; // "20 min"
    features: string[];
    freeTrialDays: number;
    plans: { name: string; price: string; period: 'week' | 'month' | 'quarter' | 'year' | 'once'; popular: boolean }[];
    programmes: { name: string; meta: string; price: string; description: string; image?: string }[];
    appScreens: string[];
  };
  proof: {
    yearsCoaching: string;
    qualification: string;
    clientsCoached: string;
    rating: string; // "4.9"
    reviewCount: string; // "300"
    stories: { name: string; label: string; quote: string; before?: string; after?: string }[];
    reviews: { quote: string; name: string; detail: string }[];
  };
  about: { story: string; heroPhoto?: string; aboutPhoto?: string; coachPhoto?: string; planPhotos: string[] };
  leadMagnet: { name: string; description: string };
  /** The app launch: drives the pre-registration page and both email sequences. */
  launch: LaunchAnswers;
  extra: string;
}

export interface LaunchAnswers {
  date: string; // YYYY-MM-DD
  offer: string; // what pre-registered people get, e.g. "30% off your first 3 months"
  code: string; // discount code, if there is one
  offerDays: '4' | '5' | '7'; // how long the launch offer stays open
  websiteUrl: string; // main website, linked from the launch emails
  listSize: string; // rough size of their general email list
}

export const emptyLaunch = (): LaunchAnswers => ({ date: '', offer: '', code: '', offerDays: '5', websiteUrl: '', listSize: '' });

/** Older submissions were made before the launch questions existed. */
export const launchOf = (a: Pick<OnboardingAnswers, 'launch'>): LaunchAnswers => ({ ...emptyLaunch(), ...(a.launch ?? {}) });

/** A date a few weeks from today, as YYYY-MM-DD. */
export const weeksFromNow = (w: number) => new Date(Date.now() + w * 7 * 864e5).toISOString().slice(0, 10);

export const FEATURE_OPTIONS = [
  'Workout plans', 'Exercise video demos', 'Meal plans', 'Recipes', 'Calorie & macro tracking', 'Barcode scanner',
  'Habit tracking', 'Weekly check-ins', 'Progress photos', 'Community group', 'Live classes', 'Period / cycle tracking',
  'Apple & Google Health sync', 'Coach messaging', 'Goal setting', 'Injury support',
];

export function emptyAnswers(): OnboardingAnswers {
  return {
    contact: { name: '', email: '', phone: '' },
    business: { brandName: '', coachName: '', instagram: '', publicEmail: '' },
    brand: { primary: '#5BB6F0', secondary: '#FBDD8A', font: 'bold', tone: '' },
    audience: { who: '', struggles: '', goals: '', objections: '' },
    offer: {
      type: 'app', productName: '', location: 'both', daysPerWeek: '3–5', sessionLength: '30 min', features: [], freeTrialDays: 7,
      plans: [
        { name: 'Monthly', price: '', period: 'month', popular: false },
        { name: 'Quarterly', price: '', period: 'quarter', popular: true },
        { name: 'Annual', price: '', period: 'year', popular: false },
      ],
      programmes: [], appScreens: [],
    },
    proof: { yearsCoaching: '', qualification: '', clientsCoached: '', rating: '', reviewCount: '', stories: [], reviews: [] },
    about: { story: '', planPhotos: [] },
    leadMagnet: { name: '', description: '' },
    launch: emptyLaunch(),
    extra: '',
  };
}

/** Example answers, used by "Fill with example answers" in preview mode. All invented. */
export function exampleAnswers(): OnboardingAnswers {
  const a = emptyAnswers();
  return {
    ...a,
    contact: { name: 'Danielle Cole', email: 'dani@example.com', phone: '07700 900555' },
    business: { brandName: 'Strong With Dani', coachName: 'Dani', instagram: '@strongwithdani', publicEmail: 'hello@strongwithdani.co.uk' },
    brand: { primary: '#E2557A', secondary: '#F7D9C4', font: 'bold', tone: 'Warm, direct, no-nonsense' },
    audience: {
      who: 'Busy mums aged 28 to 45 who used to train and want to feel strong again',
      struggles: 'No time, starting again every Monday, confused by conflicting advice online',
      goals: 'Lose a stone, feel strong, have energy for the kids, build a routine that sticks',
      objections: 'Worried they are too unfit to start, think they need a gym, tried apps before and quit',
    },
    offer: {
      ...a.offer,
      type: 'app',
      productName: 'Strong With Dani app',
      location: 'both',
      daysPerWeek: '3–4',
      sessionLength: '25 min',
      features: ['Workout plans', 'Exercise video demos', 'Meal plans', 'Calorie & macro tracking', 'Habit tracking', 'Community group', 'Weekly check-ins', 'Progress photos'],
      freeTrialDays: 7,
      plans: [
        { name: 'Monthly', price: '19.99', period: 'month', popular: false },
        { name: 'Quarterly', price: '49.99', period: 'quarter', popular: true },
        { name: 'Annual', price: '159.99', period: 'year', popular: false },
      ],
      programmes: [
        { name: 'Mum Strong 8', meta: '8 weeks · Home', price: '45', description: 'Eight weeks of short home sessions that rebuild your strength from the ground up.' },
        { name: 'Glute Builder', meta: '6 weeks · Gym', price: '39', description: 'A focused lower-body plan with progressive overload built in.' },
      ],
    },
    proof: {
      yearsCoaching: '7', qualification: 'Level 3 PT & nutrition coach', clientsCoached: '2,000+', rating: '4.9', reviewCount: '350',
      stories: [{ name: 'Laura', label: '16 weeks', quote: 'Three sessions a week around two kids, and I am stronger now than before I had them.' }],
      reviews: [
        { quote: 'The first plan I have ever stuck to past February.', name: 'Becky T', detail: 'Member 9 months' },
        { quote: 'Short workouts that actually fit my day. I have lost 11lbs.', name: 'Sian M', detail: 'Member 5 months' },
        { quote: 'Dani checks in every week. It feels like having a coach in my pocket.', name: 'Hayley R', detail: 'Member 1 year' },
      ],
    },
    about: {
      story: 'After my second baby I felt like a stranger in my own body. I knew how to train, but I did not have the time I used to. I built short, structured sessions I could do at home, and the women I coached wanted the same thing. That became Strong With Dani.',
      planPhotos: [],
    },
    leadMagnet: { name: '5 day kickstart plan', description: 'Five 20 minute home workouts and a simple meal guide.' },
    launch: { date: weeksFromNow(3), offer: '30% off your first 3 months', code: 'STRONG30', offerDays: '5', websiteUrl: 'strongwithdani.co.uk', listSize: 'About 1,200' },
    extra: '',
  };
}
