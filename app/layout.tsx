import './globals.css';
import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { CapacitorInit } from '@/components/CapacitorInit';
export const metadata: Metadata = {
  title: 'Perilumio',
  description: 'Lernplattform für Schweizer Berufslehrlinge',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Perilumio' },
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }]
  }
};
export const viewport: Viewport = { themeColor: '#0a1428', width: 'device-width', initialScale: 1 };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="de"><body><CapacitorInit />{children}</body></html>; }
