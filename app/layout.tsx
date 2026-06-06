import './globals.css';
import type { ReactNode } from 'react';
import { CapacitorInit } from '@/components/CapacitorInit';
export const metadata = { title: 'Perilumio MVP', description: 'Lernplattform für Schweizer Berufslehrlinge' };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="de"><body><CapacitorInit />{children}</body></html>; }
