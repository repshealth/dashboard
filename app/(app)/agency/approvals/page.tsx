import type { Metadata } from 'next';
import Approvals from '@/components/agency/Approvals';

export const metadata: Metadata = { title: 'Approvals' };

/** REPS only: amends waiting for approval before the client sees them. */
export default function ApprovalsPage() {
  return <Approvals />;
}
