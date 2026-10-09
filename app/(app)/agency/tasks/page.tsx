import type { Metadata } from 'next';
import AgencyTasks from '@/components/agency/AgencyTasks';

export const metadata: Metadata = { title: 'Tasks · Agency' };

export default function AgencyTasksPage() {
  return <AgencyTasks />;
}
