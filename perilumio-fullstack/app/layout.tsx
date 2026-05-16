import './globals.css';
import type { ReactNode } from 'react';
export const metadata = { title: 'Perilumio MVP', description: 'Lernplattform für Lehrlinge im Strassenbau' };
export default function RootLayout({ children }: { children: ReactNode }) { return <html lang="de"><body>{children}</body></html>; }
