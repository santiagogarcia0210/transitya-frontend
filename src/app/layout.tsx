import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import SplashScreen from '@/components/SplashScreen';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title:       'Transit·Ya',
  description: 'Sistema multi-tenant de gestión de transporte: transporte especial, paquetería y traslados.',
  icons: {
    icon:  '/assets/logo-circular.png',
    apple: '/assets/logo-circular.png',
  },
};

export const viewport: Viewport = {
  width:        'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor:   '#0a0e1a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={inter.variable}>
      <body style={{ margin: 0, minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', fontFamily: 'var(--font)' }}>
        <SplashScreen />
        {children}
      </body>
    </html>
  );
}
