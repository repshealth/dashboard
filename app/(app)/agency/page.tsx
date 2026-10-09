import type { Metadata } from 'next';
import AgencyOverview from '@/components/agency/AgencyOverview';

export const metadata: Metadata = { title: 'Agency overview' };

/** REPS only: every client's leads and websites. Client logins are sent to their own Leads page. */
export default function AgencyPage() {
  return <AgencyOverview />;
}
