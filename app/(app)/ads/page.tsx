import type { Metadata } from 'next';
import AdsView from '@/components/ads/AdsView';

export const metadata: Metadata = { title: 'Meta ads' };

export default function AdsPage() {
  return <AdsView />;
}
