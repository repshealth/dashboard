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

export const STARTER_CLIENTS: StarterClient[] = [
  { id: 'physique-x', slug: 'physique-x', name: 'Physique X', contactName: 'Kieran', repo: 'repshealth/physique-x', branch: 'main' },
];
