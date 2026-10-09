import type { Metadata } from 'next';
import EmailsView from '@/components/emails/EmailsView';

export const metadata: Metadata = { title: 'Emails' };

export default function EmailsPage() {
  return <EmailsView />;
}
