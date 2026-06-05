import Link from 'next/link';

export const metadata = { title: 'Datenschutz - Perilumio' };

export default function DatenschutzPage() {
  return (
    <main className="container">
      <section className="card stack" style={{ maxWidth: 760, margin: '6vh auto' }}>
        <span className="pill">Datenschutz</span>
        <h1>Datenschutzerklaerung</h1>
        <p className="muted">Stand: Juni 2026</p>

        <h2>1. Verantwortliche Stelle</h2>
        <p>
          Verantwortlich fuer die Bearbeitung der Personendaten im Rahmen von Perilumio ist:
        </p>
        <p className="muted">
          {/* TODO Roger: Name, Strasse, PLZ Ort, Land */}
          Roger Bleuler<br />
          {/* Strasse */}<br />
          {/* PLZ Ort */}<br />
          Schweiz<br />
          E-Mail: <a href="mailto:datenschutz@perilumio.ch">datenschutz@perilumio.ch</a>
        </p>

        <h2>2. Geltungsbereich</h2>
        <p>
          Diese Datenschutzerklaerung gilt fuer die Website
          {' '}<a href="https://perilumio-fullstack-ftmf.vercel.app">perilumio-fullstack-ftmf.vercel.app</a>{' '}
          sowie fuer die mobilen Apps Perilumio fuer iOS und Android.
        </p>

        <h2>3. Welche Daten wir bearbeiten</h2>
        <h3>3.1 Konto- und Profildaten</h3>
        <p>
          Bei der Registrierung erfassen wir deine E-Mail-Adresse und ein selbst gewaehltes Passwort
          (gehasht gespeichert). Optional kannst du einen Anzeigenamen, einen Avatar und einen Kurs auswaehlen.
        </p>
        <h3>3.2 Lern- und Spieldaten</h3>
        <p>
          Wir speichern deinen Lernfortschritt, deine erworbenen Erfahrungspunkte (XP), Streaks, Battle-Ergebnisse
          sowie die Antworten auf einzelne Quizfragen, damit du deinen Fortschritt jederzeit fortsetzen kannst.
        </p>
        <h3>3.3 Technische Daten</h3>
        <p>
          Beim Zugriff werden technische Daten wie IP-Adresse, Browser- und Geraetetyp, Betriebssystem,
          Referrer-URL, Zeitpunkt des Zugriffs sowie Crash-Logs an unsere Infrastruktur-Anbieter uebermittelt.
        </p>

        <h2>4. Zwecke der Bearbeitung</h2>
        <ul>
          <li>Bereitstellung und Betrieb der Plattform und der mobilen Apps</li>
          <li>Speichern und Anzeigen deines Lernfortschritts</li>
          <li>Sicherheit, Missbrauchspraevention, Fehleranalyse</li>
          <li>Anonymisierte Auswertung der Nutzung zur Verbesserung des Angebots</li>
        </ul>

        <h2>5. Rechtsgrundlagen</h2>
        <p>
          Die Bearbeitung erfolgt gestuetzt auf das schweizerische Datenschutzgesetz (revDSG)
          und, soweit anwendbar, die EU-Datenschutz-Grundverordnung (DSGVO). Rechtsgrundlagen
          sind insbesondere die Erfuellung des Nutzungsvertrags sowie das berechtigte
          Interesse am sicheren und stabilen Betrieb der Plattform.
        </p>

        <h2>6. Empfaenger und Auftragsbearbeiter</h2>
        <p>Wir nutzen die folgenden Dienstleister:</p>
        <ul>
          <li><strong>Supabase</strong> (Datenbank und Authentifizierung, Hosting in der EU)</li>
          <li><strong>Vercel</strong> (Hosting der Webplattform)</li>
          <li><strong>Resend</strong> (Versand transaktionaler E-Mails)</li>
        </ul>
        <p>
          Mit allen Auftragsbearbeitern bestehen entsprechende Vertraege, welche das angemessene Schutzniveau sicherstellen.
        </p>

        <h2>7. Datenweitergabe ins Ausland</h2>
        <p>
          Personendaten koennen in Laender ausserhalb der Schweiz und der EU uebertragen werden,
          insbesondere in die USA (Vercel, teilweise Resend). Wir stuetzen die Uebermittlung auf
          Standardvertragsklauseln oder vergleichbare Garantien.
        </p>

        <h2>8. Aufbewahrungsdauer</h2>
        <p>
          Wir speichern deine Daten, solange dein Konto besteht. Nach Loeschung des Kontos werden
          deine Personendaten innerhalb von 30 Tagen geloescht oder anonymisiert. Gesetzliche
          Aufbewahrungspflichten bleiben vorbehalten.
        </p>

        <h2>9. Deine Rechte</h2>
        <p>Du hast jederzeit das Recht auf:</p>
        <ul>
          <li>Auskunft ueber die ueber dich bearbeiteten Daten</li>
          <li>Berichtigung unrichtiger Daten</li>
          <li>Loeschung deiner Daten (Recht auf Vergessenwerden)</li>
          <li>Einschraenkung der Bearbeitung</li>
          <li>Datenuebertragbarkeit</li>
          <li>Widerruf einer erteilten Einwilligung</li>
          <li>Beschwerde bei der zustaendigen Aufsichtsbehoerde (in der Schweiz: EDOEB)</li>
        </ul>
        <p>
          Anfragen richtest du bitte an <a href="mailto:datenschutz@perilumio.ch">datenschutz@perilumio.ch</a>.
        </p>

        <h2>10. Cookies und vergleichbare Technologien</h2>
        <p>
          Wir verwenden technisch notwendige Cookies fuer die Authentifizierung und die Speicherung
          deiner Praeferenzen. Es werden keine Werbe- oder Tracking-Cookies von Drittanbietern eingesetzt.
        </p>

        <h2>11. Push-Benachrichtigungen (mobile Apps)</h2>
        <p>
          In den mobilen Apps koennen wir dir mit deiner Einwilligung Push-Benachrichtigungen senden
          (z. B. Streak-Erinnerungen). Du kannst die Erlaubnis jederzeit in den Geraete-Einstellungen widerrufen.
        </p>

        <h2>12. Aenderungen dieser Datenschutzerklaerung</h2>
        <p>
          Wir koennen diese Datenschutzerklaerung anpassen. Die jeweils aktuelle Fassung ist auf dieser Seite
          verfuegbar.
        </p>

        <div className="stack" style={{ marginTop: 16 }}>
          <Link href="/" className="btn">Zurueck zur Startseite</Link>
        </div>
      </section>
    </main>
  );
}
