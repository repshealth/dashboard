import type { Metadata } from 'next';
import FunnelsView from '@/components/funnels/FunnelsView';

export const metadata: Metadata = { title: 'Funnels' };

export default function FunnelsPage() {
  return <FunnelsView />;
}
