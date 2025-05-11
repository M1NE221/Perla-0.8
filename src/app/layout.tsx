import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Perla',
  description: 'A minimalist AI sales tracker',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
} 