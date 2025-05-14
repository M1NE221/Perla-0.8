import './globals.css';
import type { Metadata } from 'next';
import AuthGate from '@/components/AuthGate';
import Header from '@/components/Header';

// Global CSS imports should go here

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
        <AuthGate>
          <Header />
          <main>{children}</main>
        </AuthGate>
      </body>
    </html>
  );
} 