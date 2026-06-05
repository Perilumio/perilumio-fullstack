import Link from 'next/link';

export const metadata = { title: 'Impressum - Perilumio' };

export default function ImpressumPage() {
  return (
    <main className="container">
      <section className="card stack" style={{ maxWidth: 720, margin: '8vh auto' }}>
        <span className="pill">● Impressum</span>
        <h1>Impressum</h1>
        <p className="muted">
          Diese Seite ist ein Platzhalter. Die rechtsverbindlichen Angaben werden
          vor der Veroeffentlichung im App-Store noch finalisiert.
        </p>
        <p className="muted">
          TODO: Betreiberin oder Betreiber, Rechtsform, Adresse, Kontaktangaben
          und allfaellige Registereintraege ergaenzen.
        </p>
        <div className="stack">
          <Link href="/" className="btn">Zurueck zur Startseite</Link>
        </div>
      </section>
    </main>
  );
}
