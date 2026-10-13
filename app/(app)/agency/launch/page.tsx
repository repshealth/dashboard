import type { Metadata } from 'next';
import LaunchSetupPage from '@/components/agency/LaunchSetupPage';

export const metadata: Metadata = { title: 'Launch setup · Agency' };

export default function LaunchPage() {
  return <LaunchSetupPage />;
}
