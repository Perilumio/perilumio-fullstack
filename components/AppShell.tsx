import Link from 'next/link';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { AnalyticsTracker } from '@/components/AnalyticsTracker';
function HomeIcon(){ return <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false"><path d="M12 3.2 2.6 11.1a1 1 0 0 0 .65 1.76H5v7.05a1 1 0 0 0 1 1h3.5v-5.4a2.5 2.5 0 0 1 5 0v5.4H18a1 1 0 0 0 1-1V12.86h1.75a1 1 0 0 0 .65-1.76L12 3.2z" fill="currentColor"/></svg>; }
function HomeButton({ href = '/dashboard', label = 'Zum Menü' }: { href?: string; label?: string }){ return <Link href={href} className="home-btn" aria-label={label} title={label} data-testid="home-button"><HomeIcon /></Link>; }
function BrandLogoHeader(){ return <Link href="/dashboard" className="brand-logo-header" aria-label="Perilumio" title="Perilumio" data-testid="brand-logo-header"><Image src="/brand/perilumio-icon.png" alt="Perilumio" width={44} height={44} priority className="brand-logo-header-img" /></Link>; }
function AppFooter(){ return <footer className="app-footer"><Link href="/datenschutz" className="app-footer-link">Datenschutz</Link><span aria-hidden="true">·</span><Link href="/impressum" className="app-footer-link">Impressum</Link></footer>; }
export function AppShell({ children, showHomeButton = true }: { children: ReactNode; showHomeButton?: boolean }) { return <div className="shell-simple"><AnalyticsTracker />{showHomeButton && <HomeButton />}<BrandLogoHeader /><main className="container">{children}</main><AppFooter /></div>; }
export { HomeButton, BrandLogoHeader };
