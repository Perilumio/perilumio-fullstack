import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { courseLabel, COURSES } from '@/lib/courses-constants';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type ExportType = 'dropoffs' | 'users' | 'progress' | 'courses';

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [headers.map(csvEscape).join(';')];
  for (const row of rows) lines.push(row.map(csvEscape).join(';'));
  return '﻿' + lines.join('\r\n') + '\r\n';
}

function fileName(type: ExportType): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `perilumio-analytics-${type}-${stamp}.csv`;
}

function csvResponse(body: string, type: ExportType) {
  return new NextResponse(body, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName(type)}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: Request) {
  const access = await requireAdmin();
  if (!access.ok) {
    return NextResponse.json({ message: 'Nicht autorisiert.' }, { status: 403 });
  }

  const url = new URL(request.url);
  const typeParam = url.searchParams.get('type') ?? 'dropoffs';
  const type: ExportType =
    typeParam === 'users' || typeParam === 'progress' || typeParam === 'dropoffs' || typeParam === 'courses'
      ? typeParam
      : 'dropoffs';

  if (type === 'courses') {
    const [profilesRes, progressRes, lessonsRes, modulesRes] = await Promise.all([
      supabaseAdmin.from('profiles').select('id,active_course_key,xp'),
      supabaseAdmin.from('lesson_progress').select('passed,lesson_id'),
      supabaseAdmin.from('lessons').select('id,module_id'),
      supabaseAdmin.from('modules').select('id,course_key'),
    ]);
    const profs = (profilesRes.data ?? []) as { id: string; active_course_key: string | null; xp: number | null }[];
    const prog = (progressRes.data ?? []) as { passed: boolean; lesson_id: string }[];
    const less = (lessonsRes.data ?? []) as { id: string; module_id: string }[];
    const mods = (modulesRes.data ?? []) as { id: string; course_key: string | null }[];

    const modById = new Map(mods.map((m) => [m.id, m]));
    const lessonCourse = new Map<string, string | null>();
    for (const l of less) lessonCourse.set(l.id, modById.get(l.module_id)?.course_key ?? null);

    const passedByCourse = new Map<string, number>();
    for (const p of prog) {
      if (!p.passed) continue;
      const key = lessonCourse.get(p.lesson_id);
      if (!key) continue;
      passedByCourse.set(key, (passedByCourse.get(key) ?? 0) + 1);
    }
    const enrolledByCourse = new Map<string, number>();
    const xpSumByCourse = new Map<string, number>();
    for (const prof of profs) {
      const key = prof.active_course_key;
      if (!key) continue;
      enrolledByCourse.set(key, (enrolledByCourse.get(key) ?? 0) + 1);
      xpSumByCourse.set(key, (xpSumByCourse.get(key) ?? 0) + (prof.xp ?? 0));
    }
    const headers = ['Kurs', 'Eingeschriebene User', 'Abgeschlossene Sequenzen', 'Durchschnittliche XP'];
    const rows = COURSES.map((c) => {
      const enrolled = enrolledByCourse.get(c.key) ?? 0;
      const xpSum = xpSumByCourse.get(c.key) ?? 0;
      return [c.label, enrolled, passedByCourse.get(c.key) ?? 0, enrolled > 0 ? Math.round(xpSum / enrolled) : 0];
    });
    return csvResponse(buildCsv(headers, rows), type);
  }

  if (type === 'users') {
    const { data } = await supabaseAdmin.from('analytics_user_summary').select('*');
    const rows = (data ?? []) as Array<{
      user_id: string;
      username: string | null;
      display_name: string | null;
      role: string | null;
      xp: number | null;
      level: number | null;
      battle_points: number | null;
      active_course_key: string | null;
      session_count: number;
      total_seconds: number;
      avg_seconds: number;
      total_page_views: number;
      last_seen_at: string | null;
    }>;
    const headers = [
      'Nutzer-ID', 'Benutzername', 'Anzeigename', 'Rolle', 'Aktiver Kurs',
      'XP', 'Level', 'Battle Points',
      'Sitzungen', 'Gesamtzeit (Sek.)', 'Ø Sitzung (Sek.)', 'Seitenaufrufe',
      'Letzte Aktivität',
    ];
    const body = buildCsv(headers, rows.map((r) => [
      r.user_id,
      r.username ?? '',
      r.display_name ?? '',
      r.role ?? '',
      r.active_course_key ? courseLabel(r.active_course_key) : '',
      r.xp ?? 0,
      r.level ?? 0,
      r.battle_points ?? 0,
      r.session_count ?? 0,
      r.total_seconds ?? 0,
      r.avg_seconds ?? 0,
      r.total_page_views ?? 0,
      r.last_seen_at ?? '',
    ]));
    return csvResponse(body, type);
  }

  const [progressRes, lessonsRes, modulesRes, profilesRes, questionsRes] = await Promise.all([
    supabaseAdmin.from('lesson_progress').select('user_id,lesson_id,best_score,passed,last_question_index,updated_at'),
    supabaseAdmin.from('lessons').select('id,title,module_id,pass_score'),
    supabaseAdmin.from('modules').select('id,title,course_key'),
    supabaseAdmin.from('profiles').select('id,username,display_name'),
    supabaseAdmin.from('questions').select('lesson_id'),
  ]);

  type Progress = { user_id: string; lesson_id: string; best_score: number; passed: boolean; last_question_index: number; updated_at: string };
  type Lesson = { id: string; title: string; module_id: string; pass_score: number };
  type Module = { id: string; title: string; course_key: string | null };
  type Profile = { id: string; username: string | null; display_name: string | null };
  type Question = { lesson_id: string };

  const progress = (progressRes.data ?? []) as Progress[];
  const lessons = (lessonsRes.data ?? []) as Lesson[];
  const modules = (modulesRes.data ?? []) as Module[];
  const profiles = (profilesRes.data ?? []) as Profile[];
  const questions = (questionsRes.data ?? []) as Question[];

  const lessonById = new Map(lessons.map((l) => [l.id, l]));
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  const profileById = new Map(profiles.map((p) => [p.id, p]));
  const totalQuestionsByLesson = new Map<string, number>();
  for (const q of questions) totalQuestionsByLesson.set(q.lesson_id, (totalQuestionsByLesson.get(q.lesson_id) ?? 0) + 1);

  if (type === 'progress') {
    const headers = [
      'Nutzer-ID', 'Benutzername', 'Anzeigename',
      'Kurs', 'Modul', 'Lektion', 'Lektions-ID',
      'Best Score', 'Pass Score', 'Bestanden',
      'Letzte Frage', 'Fragen gesamt', 'Fortschritt (%)',
      'Aktualisiert',
    ];
    const rows = progress.map((p) => {
      const lesson = lessonById.get(p.lesson_id);
      const mod = lesson ? moduleById.get(lesson.module_id) : null;
      const profile = profileById.get(p.user_id);
      const total = totalQuestionsByLesson.get(p.lesson_id) ?? 0;
      const percent = total > 0 ? Math.round((Math.min(p.last_question_index, total) / total) * 100) : 0;
      return [
        p.user_id,
        profile?.username ?? '',
        profile?.display_name ?? '',
        mod?.course_key ? courseLabel(mod.course_key) : '',
        mod?.title ?? '',
        lesson?.title ?? '',
        p.lesson_id,
        p.best_score,
        lesson?.pass_score ?? 70,
        p.passed ? 'ja' : 'nein',
        p.last_question_index,
        total,
        percent,
        p.updated_at,
      ];
    });
    return csvResponse(buildCsv(headers, rows), type);
  }

  // dropoffs
  const headers = [
    'Nutzer-ID', 'Benutzername', 'Anzeigename',
    'Kurs', 'Modul', 'Lektion', 'Lektions-ID',
    'Letzte Frage', 'Fragen gesamt', 'Fortschritt (%)',
    'Best Score', 'Letzter Fortschritt',
  ];
  const rows = progress
    .filter((p) => !p.passed && p.last_question_index > 0 && lessonById.has(p.lesson_id))
    .map((p) => {
      const lesson = lessonById.get(p.lesson_id)!;
      const mod = moduleById.get(lesson.module_id);
      const profile = profileById.get(p.user_id);
      const total = totalQuestionsByLesson.get(p.lesson_id) ?? 0;
      const percent = total > 0 ? Math.round((Math.min(p.last_question_index, total) / total) * 100) : 0;
      return {
        row: [
          p.user_id,
          profile?.username ?? '',
          profile?.display_name ?? '',
          mod?.course_key ? courseLabel(mod.course_key) : '',
          mod?.title ?? '',
          lesson.title,
          p.lesson_id,
          p.last_question_index,
          total,
          percent,
          p.best_score,
          p.updated_at,
        ] as (string | number)[],
        ts: new Date(p.updated_at).getTime(),
      };
    });
  rows.sort((a, b) => b.ts - a.ts);
  return csvResponse(buildCsv(headers, rows.map((r) => r.row)), type);
}
