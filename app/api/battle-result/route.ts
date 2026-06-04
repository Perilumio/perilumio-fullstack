import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Veralteter Endpunkt. Die fruehere Version hat Punkte (score, enemyScore) direkt
// aus dem Client-Payload uebernommen und daraus BP vergeben. Das ist nicht
// anti-cheat-sicher: ein Client koennte beliebige Scores melden. Battle-Scoring
// und BP-Vergabe laufen jetzt ausschliesslich serverseitig ueber
// app/api/battle/answer und lib/battle.ts (gegen questions.correct_option).
// Der Endpunkt bleibt als 410 erhalten, falls noch alte Clients ihn aufrufen.
export async function POST() {
  return NextResponse.json(
    { message: 'Dieser Endpunkt wird nicht mehr verwendet. Battle-Resultate werden serverseitig berechnet.' },
    { status: 410 },
  );
}
