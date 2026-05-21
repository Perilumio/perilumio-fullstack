// Minimaler Mail-Versand über Resend (https://resend.com/docs/api-reference/emails/send-email).
// Erwartet zwei Server-Env-Variablen:
//   RESEND_API_KEY  – API-Key des Resend-Workspaces (server-only).
//   EMAIL_FROM      – Absenderadresse, z. B. "Perilumio <no-reply@perilumio.ch>".
// Optional:
//   EMAIL_REPLY_TO  – Antwortadresse, falls Empfänger zurückschreiben können soll.
//
// Wenn RESEND_API_KEY oder EMAIL_FROM fehlt, wird ein Fehler zurückgegeben –
// die aufrufende Route muss diesen Fall behandeln (z. B. Löschung blockieren).

export type SendMailResult =
  | { ok: true; id: string | null }
  | { ok: false; code: 'not_configured' | 'send_failed'; message: string };

export async function sendMail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<SendMailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    return {
      ok: false,
      code: 'not_configured',
      message: 'Mailversand nicht konfiguriert (RESEND_API_KEY oder EMAIL_FROM fehlt).',
    };
  }
  const replyTo = opts.replyTo ?? process.env.EMAIL_REPLY_TO ?? undefined;
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        reply_to: replyTo,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return {
        ok: false,
        code: 'send_failed',
        message: `Mailversand fehlgeschlagen (${res.status}): ${errText.slice(0, 300)}`,
      };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { ok: true, id: data.id ?? null };
  } catch (err) {
    return {
      ok: false,
      code: 'send_failed',
      message: `Mailversand-Fehler: ${err instanceof Error ? err.message : 'unbekannt'}`,
    };
  }
}
