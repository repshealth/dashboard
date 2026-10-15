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
  /** Where the site is saved from Claude. */
  repo: string;
  branch: string;
}

import type { EmailCampaign } from './emails/types';
import { physiqueXCalculatorFlow } from './emails/flows/physique-x-calculator';

/** Follow-up email flows written for starting clients. Each is added once, as a draft for the REPS team. */
export const STARTER_FLOWS: { clientId: string; flowId: string; make: (clientId: string, versionId: string) => EmailCampaign }[] = [
  { clientId: 'physique-x', flowId: 'calculator', make: physiqueXCalculatorFlow },
];

export const STARTER_CLIENTS: StarterClient[] = [
  { id: 'physique-x', slug: 'physique-x', name: 'Physique X', contactName: 'Kieran', repo: 'repshealth/physique-x', branch: 'main' },
  { id: 'dailey-demolition', slug: 'dailey-demolition', name: 'Dailey Demolition', contactName: 'Kate Dailey', repo: 'repshealth/dailey', branch: 'main' },
];
