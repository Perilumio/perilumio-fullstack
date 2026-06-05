import Link from 'next/link';

export const metadata = { title: 'Datenschutz - Perilumio' };

export default function DatenschutzPage() {
  return (
    <main className="container">
      <section className="card stack" style={{ maxWidth: 720, margin: '8vh auto' }}>
        <span className="pill">● Datenschutz</span>
        <h1>Datenschutzerklaerung</h1>
        <p className="muted">
          Diese Seite ist ein Platzhalter. Der rechtsverbindliche Datenschutztext
          wird vor der Veroeffentlichung im App-Store noch finalisiert.
        </p>
        <p className="muted">
          TODO: Verantwortliche Stelle, Art der bearbeiteten Daten, Zweck der
          Bearbeitung, Rechtsgrundlagen, Aufbewahrungsdauer, Rechte der betroffenen
          Personen und Kontaktangaben ergaenzen.
        </p>
        <div className="stack">
          <Link href="/" className="btn">Zurueck zur Startseite</Link>
        </div>
      </section>
    </main>
  );
}
