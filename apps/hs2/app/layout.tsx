import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Provider } from '@ui/components/provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'High Speed Progress',
    template: '%s | HSP',
  },
  description:
    'Track the construction progress of the High Speed Progress railway project. View real-time updates on stations, bridges, tunnels, and viaducts across the UK with photos, videos, and detailed construction status.',
  keywords: [
    'High Speed Rail',
    'HS2',
    'High Speed 2',
    'railway construction',
    'UK infrastructure',
    'HS2 progress',
    'railway tracker',
    'construction updates',
    'HS2 stations',
    'HS2 tunnels',
    'HS2 viaducts',
  ],
  authors: [{ name: 'Isaac Raskin' }],
  creator: 'Isaac Raskin',
  openGraph: {
    type: 'website',
    locale: 'en_GB',
    url: 'https://hs2.highspeedprogress.com',
    title: 'HS2 Progress Tracker | High Speed 2 Construction Updates',
    description:
      'Track the construction progress of HS2 railway project with real-time updates, photos, and videos of stations, bridges, tunnels, and viaducts.',
    siteName: 'HS2 Progress Tracker',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HS2 Progress Tracker',
    description:
      'Track HS2 construction progress with real-time updates, photos, and videos.',
    creator: '@isaacraskin',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang='en' suppressHydrationWarning>
      <body className={inter.className}>
        <Provider>{children}</Provider>
      </body>
    </html>
  );
}
