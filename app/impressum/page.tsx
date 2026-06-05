import Link from 'next/link';

export const metadata = { title: 'Impressum - Perilumio' };

export default function ImpressumPage() {
  return (
    <main className="container">
      <section className="card stack" style={{ maxWidth: 760, margin: '6vh auto' }}>
        <span className="pill">Impressum</span>
        <h1>Impressum</h1>

        <h2>Betreiberin / Betreiber</h2>
        <p className="muted">
          {/* TODO Roger: vollstaendige Angaben ergaenzen */}
          Roger Bleuler<br />
          {/* Strasse und Hausnummer */}<br />
          {/* PLZ und Ort */}<br />
          Schweiz
        </p>

        <h2>Kontakt</h2>
        <p>
          E-Mail: <a href="mailto:perilumio@outlook.com">perilumio@outlook.com</a>
        </p>

        <h2>Verantwortlich fuer den Inhalt</h2>
        <p>
          Roger Bleuler
        </p>

        <h2>Haftungsausschluss</h2>
        <p>
          Trotz sorgfaeltiger inhaltlicher Kontrolle uebernehmen wir keine Haftung fuer die Inhalte
          externer Links. Fuer den Inhalt der verlinkten Seiten sind ausschliesslich deren Betreiber verantwortlich.
        </p>
        <p>
          Die Inhalte von Perilumio dienen dem Lernen und der Pruefungsvorbereitung. Wir uebernehmen
          keine Gewaehr fuer die Richtigkeit, Vollstaendigkeit und Aktualitaet der Fragen und Antworten.
        </p>

        <h2>Urheberrecht</h2>
        <p>
          Alle Inhalte auf Perilumio sind urheberrechtlich geschuetzt. Eine Verwendung ueber den
          persoenlichen Lernzweck hinaus bedarf der schriftlichen Zustimmung des Betreibers.
        </p>

        <div className="stack" style={{ marginTop: 16 }}>
          <Link href="/" className="btn">Zurueck zur Startseite</Link>
        </div>
      </section>
    </main>
  );
}
