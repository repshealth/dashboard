import type { Metadata } from 'next';
import AgencyMeetings from '@/components/agency/AgencyMeetings';

export const metadata: Metadata = { title: 'Meetings · Agency' };

export default function AgencyMeetingsPage() {
  return <AgencyMeetings />;
}
