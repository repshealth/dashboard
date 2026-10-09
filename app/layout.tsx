import type { Metadata, Viewport } from 'next';
import './globals.css';
import '@/components/site/template.css';
import { FONTS_URL } from '@/lib/fonts';

export const metadata: Metadata = {
  title: { default: 'REPS Scaling OS', template: '%s | REPS Scaling OS' },
  description: 'Leads, pipeline and website approvals for REPS clients.',
  icons: { icon: '/reps-logo.png' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Montserrat for the dashboard, plus the faces the client website templates use. */}
        <link rel="stylesheet" href={FONTS_URL} />
      </head>
      <body>{children}</body>
    </html>
  );
}
