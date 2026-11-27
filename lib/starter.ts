/**
 * The clients the dashboard starts with. Live mode adds them to an empty database the first
 * time the REPS team signs in, connects each website to its GitHub repo and pulls the latest
 * commit. Example mode shows the same clients.
 */
export interface StarterClient {
  id: string;
  slug: string;
  name: string;
  contactName: string;
  /** Where the site is saved from Claude. Leave out for an account that only collects leads. */
  repo?: string;
  branch?: string;
}

import type { EmailCampaign } from './emails/types';
import { physiqueXCalculatorFlow } from './emails/flows/physique-x-calculator';
import { leanBodyVslNoCallFlow } from './emails/flows/lean-body-vsl-no-call';
import { leanBodyBlackFridayFlow } from './emails/flows/lean-body-black-friday';

/** Follow-up email flows written for starting clients. Each is added once, as a draft for the REPS team. */
/**
 * reopen: a one-off instruction (any new text runs it once) to put the flow back in front of the client
 * for comments: status "Ready to review", commenting unlocked. If a revised version is waiting, it becomes the latest.
 */
export const STARTER_FLOWS: { clientId: string; flowId: string; make: (clientId: string, versionId: string) => EmailCampaign; reopen?: string }[] = [
  { clientId: 'physique-x', flowId: 'calculator', make: physiqueXCalculatorFlow },
  { clientId: 'lean-body-academy', flowId: 'vsl-no-call', make: leanBodyVslNoCallFlow, reopen: '2026-10-30 open for Josh to comment again (asked by James)' },
  { clientId: 'lean-body-academy', flowId: 'black-friday-shred-in-7', make: leanBodyBlackFridayFlow },
];

export const STARTER_CLIENTS: StarterClient[] = [
  { id: 'physique-x', slug: 'physique-x', name: 'Physique X', contactName: 'Kieran', repo: 'repshealth/physique-x', branch: 'main' },
  { id: 'dailey-demolition', slug: 'dailey-demolition', name: 'Dailey Demolition', contactName: 'Kate Dailey', repo: 'repshealth/dailey', branch: 'main' },
  { id: 'shape-up-with-gabby', slug: 'shape-up-with-gabby', name: 'Shape Up with Gabby', contactName: 'Gabby Allen', repo: 'repshealth/shapeupwithgabby', branch: 'main' },
  { id: 'berri', slug: 'berri', name: 'Berri', contactName: 'Bela Fernandez', repo: 'repshealth/bella', branch: 'main' },
  { id: 'lean-body-academy', slug: 'lean-body-academy', name: 'Lean Body Academy', contactName: 'Josh Bell', repo: 'repshealth/joshbell', branch: 'main' },
  { id: 'rebuild', slug: 'rebuild', name: 'Rebuild', contactName: 'James Haskell', repo: 'repshealth/rebuild', branch: 'main' },
  { id: 'kim-weston', slug: 'kim-weston', name: 'Kim Weston', contactName: 'Kim Weston', repo: 'repshealth/kimwestoncalories', branch: 'main' },
  { id: 'apex', slug: 'apex', name: 'Apex', contactName: 'Rory', repo: 'repshealth/apex', branch: 'main' },
  // James's own private 1-1 consulting page. Its application form posts here as client "james".
  { id: 'james', slug: 'james', name: 'James', contactName: 'James', repo: 'repshealth/fitpreneurjames', branch: 'main' },
  // The REPS Health website (repshealth.com, hosted on Firebase). Every form on it posts here as client "reps-website".
  { id: 'reps-website', slug: 'reps-website', name: 'REPS Website', contactName: 'James' },
];

/**
 * Clients who signed up through the intake form, whose website lives in a repo with a different
 * name from the one the dashboard expects. The first time the REPS team opens the dashboard after
 * one is added here, that client's Website section is connected to the repo and the latest commit
 * pulled in. Matched by the business name they gave.
 */
export const SITE_REPOS: { name: string; repo: string; branch: string; publish?: string }[] = [
  // publish: a one-off instruction to pull the latest commit and show it in the Website preview
  // straight away (skipping Approvals). Change the tag to do it again.
  { name: 'Ellena Fit Ltd', repo: 'repshealth/els', branch: 'main', publish: '2026-11-09 approved: quiz per Josh comments (contact second, multiple choice, occupation last)' },
  { name: 'Lean Body Academy', repo: 'repshealth/joshbell', branch: 'main', publish: '2026-11-05 approved: Josh amends round 2 (headline, buttons, You could be next)' },  { name: 'Berri', repo: 'repshealth/bella', branch: 'main', publish: '2026-11-12 approved: real Berri app screens (1d0025e)' },
];
