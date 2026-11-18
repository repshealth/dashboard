import type { Metadata } from 'next';
import MetaConnection from '@/components/agency/MetaConnection';

export const metadata: Metadata = { title: 'Meta connection · Agency' };

export default function AgencyMetaPage() {
  return <MetaConnection />;
}
