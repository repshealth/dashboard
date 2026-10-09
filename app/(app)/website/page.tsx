import type { Metadata } from 'next';
import WebsiteView from '@/components/website/WebsiteView';

export const metadata: Metadata = { title: 'Website' };

export default function WebsitePage() {
  return <WebsiteView />;
}
