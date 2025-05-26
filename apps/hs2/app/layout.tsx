import type { Metadata } from 'next';
import { Inter } from 'next/font/google';

import { Provider } from '@ui/components/provider';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'HS2',
  description: 'HS2 Construction',
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
