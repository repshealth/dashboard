import type { Metadata } from 'next';
import LoginsPage from '@/components/agency/LoginsPage';

export const metadata: Metadata = { title: 'Logins · Agency' };

export default function AgencyLoginsPage() {
  return <LoginsPage />;
}
