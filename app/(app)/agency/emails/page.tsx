import type { Metadata } from 'next';
import AgencyEmails from '@/components/agency/AgencyEmails';

export const metadata: Metadata = { title: 'Emails · Agency' };

export default function AgencyEmailsPage() {
  return <AgencyEmails />;
}
