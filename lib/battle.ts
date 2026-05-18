import { supabaseAdmin } from '@/lib/supabase-admin';
import type { CourseKey } from '@/lib/courses-constants';

export const BATTLE_QUESTION_COUNT = 5;
// Inactivity (no new answer / no poll updating heartbeat) → match counts as stale.
export const BATTLE_INACTIVITY_MS = 60_000;
// Per-question time hint for the UI; server doesn't strictly enforce this.
export const BATTLE_QUESTION_TIMEOUT_MS = 30_000;

export const BP_WIN = 25;
export const BP_DRAW = 10;
export const BP_LOSS = 5;

export const OPTION_KEYS = ['A', 'B', 'C', 'D'] as const;
export type OptionKey = typeof OPTION_KEYS[number];

export type BattleStatus = 'waiting' | 'active' | 'finished' | 'cancelled';

export type BattleQuestionPublic = {
  id: string;
  prompt: string;
  options: { key: OptionKey; text: string }[];
};

export type BattlePlayerPublic = {
  id: string;
  username: string;
  display_name: string;
  avatar_key: string;
};

export type BattleStatePublic = {
  match_id: string;
  status: BattleStatus;
  course_key: CourseKey;
  question_count: number;
  current_question_index: number;
  you: { id: string; role: 'player1' | 'player2'; score: number; answered_current: boolean };
  opponent: (BattlePlayerPublic & { score: number; answered_current: boolean }) | null;
  self_profile: BattlePlayerPublic;
  question: BattleQuestionPublic | null;
  last_correct_option: OptionKey | null;
  finished: boolean;
  result: 'win' | 'loss' | 'draw' | null;
  bp_reward: number | null;
};

async function loadProfiles(ids: string[]): Promise<Record<string, BattlePlayerPublic>> {
  const filtered = ids.filter(Boolean);
  if (filtered.length === 0) return {};
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('id, username, display_name, avatar_key')
    .in('id', filtered);
  const out: Record<string, BattlePlayerPublic> = {};
  for (const row of data ?? []) {
    out[row.id] = {
      id: row.id,
      username: row.username ?? 'lumio',
      display_name: row.display_name ?? 'Lehrling',
      avatar_key: row.avatar_key ?? 'lumio',
    };
  }
  return out;
}

async function pickQuestionIds(courseKey: CourseKey): Promise<string[]> {
  const { data: modules } = await supabaseAdmin
    .from('modules')
    .select('id')
    .eq('course_key', courseKey);
  const moduleIds = (modules ?? []).map((m) => m.id);
  if (moduleIds.length === 0) return [];
  const { data: lessons } = await supabaseAdmin
    .from('lessons')
    .select('id')
    .in('module_id', moduleIds);
  const lessonIds = (lessons ?? []).map((l) => l.id);
  if (lessonIds.length === 0) return [];
  const { data: questions } = await supabaseAdmin
    .from('questions')
    .select('id')
    .in('lesson_id', lessonIds);
  const ids = (questions ?? []).map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, BATTLE_QUESTION_COUNT);
}

export async function findOrCreateMatch(userId: string, courseKey: CourseKey) {
  // 1. Sweep stale matches (waiting or active without recent activity).
  const cutoff = new Date(Date.now() - BATTLE_INACTIVITY_MS).toISOString();
  await supabaseAdmin
    .from('battle_matches')
    .update({ status: 'cancelled', finished_at: new Date().toISOString() })
    .eq('status', 'waiting')
    .lt('last_activity_at', cutoff);

  // 2. If the user is already in an active or waiting match for this course, reuse it.
  const { data: existing } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('course_key', courseKey)
    .in('status', ['waiting', 'active'])
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order('created_at', { ascending: false })
    .limit(1);
  if (existing && existing.length > 0) {
    await touchActivity(existing[0].id);
    return existing[0];
  }

  // 3. Try to join an open waiting match created by someone else.
  const { data: openMatches } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('course_key', courseKey)
    .eq('status', 'waiting')
    .neq('player1_id', userId)
    .is('player2_id', null)
    .order('created_at', { ascending: true })
    .limit(5);

  for (const candidate of openMatches ?? []) {
    // Atomic-ish claim: only update if still waiting and unclaimed.
    const questionIds = candidate.question_ids && Array.isArray(candidate.question_ids) && candidate.question_ids.length > 0
      ? candidate.question_ids
      : await pickQuestionIds(courseKey);
    if (questionIds.length === 0) {
      // No questions available; cancel and abort.
      await supabaseAdmin
        .from('battle_matches')
        .update({ status: 'cancelled', finished_at: new Date().toISOString() })
        .eq('id', candidate.id);
      return null;
    }
    const { data: claimed } = await supabaseAdmin
      .from('battle_matches')
      .update({
        player2_id: userId,
        status: 'active',
        question_ids: questionIds,
        question_count: questionIds.length,
        started_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', candidate.id)
      .eq('status', 'waiting')
      .is('player2_id', null)
      .select('*')
      .maybeSingle();
    if (claimed) return claimed;
  }

  // 4. No partner — create a new waiting match.
  const { data: created, error } = await supabaseAdmin
    .from('battle_matches')
    .insert({
      course_key: courseKey,
      status: 'waiting',
      player1_id: userId,
      question_ids: [],
      question_count: 0,
      last_activity_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (error) throw error;
  return created;
}

export async function touchActivity(matchId: string) {
  await supabaseAdmin
    .from('battle_matches')
    .update({ last_activity_at: new Date().toISOString() })
    .eq('id', matchId);
}

export async function recordAnswer(params: {
  matchId: string;
  userId: string;
  questionIndex: number;
  selectedOption: OptionKey | null;
}) {
  const { matchId, userId, questionIndex, selectedOption } = params;
  const { data: match } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return { error: 'not_found' as const };
  if (match.status !== 'active') return { error: 'not_active' as const };
  if (match.player1_id !== userId && match.player2_id !== userId) {
    return { error: 'forbidden' as const };
  }
  if (questionIndex !== match.current_question_index) {
    return { error: 'wrong_index' as const };
  }
  const questionIds: string[] = Array.isArray(match.question_ids) ? match.question_ids : [];
  const questionId = questionIds[questionIndex];
  if (!questionId) return { error: 'no_question' as const };

  const { data: question } = await supabaseAdmin
    .from('questions')
    .select('id, correct_option')
    .eq('id', questionId)
    .maybeSingle();
  if (!question) return { error: 'no_question' as const };

  const isCorrect = selectedOption !== null && selectedOption === question.correct_option;

  // Idempotent insert: ignore conflicts on (match_id, user_id, question_index).
  const { error: insertError } = await supabaseAdmin
    .from('battle_answers')
    .insert({
      match_id: matchId,
      user_id: userId,
      question_index: questionIndex,
      question_id: questionId,
      selected_option: selectedOption,
      is_correct: isCorrect,
    });
  // 23505 = unique violation; treat as already-answered (idempotent).
  if (insertError && (insertError as any).code !== '23505') {
    return { error: 'insert_failed' as const, detail: insertError.message };
  }

  await advanceMatchIfReady(matchId);
  return { ok: true as const };
}

async function advanceMatchIfReady(matchId: string) {
  const { data: match } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (!match || match.status !== 'active') return;

  const idx = match.current_question_index as number;
  const { data: answers } = await supabaseAdmin
    .from('battle_answers')
    .select('user_id, is_correct, question_index')
    .eq('match_id', matchId)
    .eq('question_index', idx);

  const userIds = new Set((answers ?? []).map((a) => a.user_id));
  if (!userIds.has(match.player1_id) || !userIds.has(match.player2_id)) {
    // Still waiting on the other player.
    await touchActivity(matchId);
    return;
  }

  // Both answered. Compute new scores.
  const p1Correct = (answers ?? []).some((a) => a.user_id === match.player1_id && a.is_correct);
  const p2Correct = (answers ?? []).some((a) => a.user_id === match.player2_id && a.is_correct);
  const newP1 = (match.player1_score as number) + (p1Correct ? 1 : 0);
  const newP2 = (match.player2_score as number) + (p2Correct ? 1 : 0);
  const total = (match.question_count as number) || (match.question_ids?.length ?? BATTLE_QUESTION_COUNT);
  const nextIndex = idx + 1;
  const isFinal = nextIndex >= total;

  if (!isFinal) {
    await supabaseAdmin
      .from('battle_matches')
      .update({
        player1_score: newP1,
        player2_score: newP2,
        current_question_index: nextIndex,
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', matchId)
      .eq('current_question_index', idx);
    return;
  }

  // Final round: compute result and award BP atomically.
  let result: 'player1' | 'player2' | 'draw';
  let winnerId: string | null = null;
  if (newP1 > newP2) { result = 'player1'; winnerId = match.player1_id; }
  else if (newP2 > newP1) { result = 'player2'; winnerId = match.player2_id; }
  else { result = 'draw'; }

  const { data: finalized } = await supabaseAdmin
    .from('battle_matches')
    .update({
      player1_score: newP1,
      player2_score: newP2,
      current_question_index: nextIndex,
      status: 'finished',
      result,
      winner_id: winnerId,
      finished_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .eq('id', matchId)
    .eq('status', 'active')
    .eq('bp_awarded', false)
    .select('*')
    .maybeSingle();

  if (!finalized) return; // already finalized by another invocation

  await awardBp(finalized);
}

async function awardBp(match: any) {
  // Re-check idempotency: only award once.
  const { data: lock } = await supabaseAdmin
    .from('battle_matches')
    .update({ bp_awarded: true })
    .eq('id', match.id)
    .eq('bp_awarded', false)
    .select('id')
    .maybeSingle();
  if (!lock) return; // already awarded

  const p1Reward = match.result === 'draw' ? BP_DRAW : match.result === 'player1' ? BP_WIN : BP_LOSS;
  const p2Reward = match.result === 'draw' ? BP_DRAW : match.result === 'player2' ? BP_WIN : BP_LOSS;

  for (const [playerId, reward] of [
    [match.player1_id, p1Reward],
    [match.player2_id, p2Reward],
  ] as const) {
    if (!playerId) continue;
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('battle_points')
      .eq('id', playerId)
      .maybeSingle();
    const next = (prof?.battle_points ?? 0) + (reward ?? 0);
    await supabaseAdmin
      .from('profiles')
      .update({ battle_points: next })
      .eq('id', playerId);
  }
}

export async function buildState(matchId: string, userId: string): Promise<BattleStatePublic | null> {
  await touchActivity(matchId);

  const { data: match } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return null;
  if (match.player1_id !== userId && match.player2_id !== userId) return null;

  const role: 'player1' | 'player2' = match.player1_id === userId ? 'player1' : 'player2';
  const opponentId: string | null = role === 'player1' ? match.player2_id : match.player1_id;
  const yourScore = role === 'player1' ? match.player1_score : match.player2_score;
  const opponentScore = role === 'player1' ? match.player2_score : match.player1_score;

  const profileMap = await loadProfiles([userId, opponentId].filter(Boolean) as string[]);
  const selfProfile = profileMap[userId] ?? {
    id: userId, username: 'lumio', display_name: 'Du', avatar_key: 'lumio',
  };
  const opponentProfileBase = opponentId ? profileMap[opponentId] : null;

  const questionIds: string[] = Array.isArray(match.question_ids) ? match.question_ids : [];
  const idx: number = match.current_question_index;

  let question: BattleQuestionPublic | null = null;
  if (match.status === 'active' && questionIds[idx]) {
    const { data: q } = await supabaseAdmin
      .from('questions')
      .select('id, prompt, option_a, option_b, option_c, option_d')
      .eq('id', questionIds[idx])
      .maybeSingle();
    if (q) {
      question = {
        id: q.id,
        prompt: q.prompt,
        options: [
          { key: 'A', text: q.option_a },
          { key: 'B', text: q.option_b },
          { key: 'C', text: q.option_c },
          { key: 'D', text: q.option_d },
        ],
      };
    }
  }

  // Has the current user answered the current question?
  let answeredCurrent = false;
  let opponentAnswered = false;
  let lastCorrect: OptionKey | null = null;

  if (match.status === 'active' || match.status === 'finished') {
    const { data: answers } = await supabaseAdmin
      .from('battle_answers')
      .select('user_id, question_index')
      .eq('match_id', matchId)
      .eq('question_index', match.status === 'finished' ? Math.max(0, idx - 1) : idx);
    for (const a of answers ?? []) {
      if (a.user_id === userId) answeredCurrent = true;
      else if (a.user_id === opponentId) opponentAnswered = true;
    }
  }

  // If self has answered and opponent hasn't, expose the correct answer for the current Q.
  if (match.status === 'active' && answeredCurrent && questionIds[idx]) {
    const { data: q } = await supabaseAdmin
      .from('questions')
      .select('correct_option')
      .eq('id', questionIds[idx])
      .maybeSingle();
    lastCorrect = (q?.correct_option as OptionKey) ?? null;
  }

  let result: 'win' | 'loss' | 'draw' | null = null;
  let bpReward: number | null = null;
  if (match.status === 'finished') {
    if (match.result === 'draw') result = 'draw';
    else if (match.result === role) result = 'win';
    else result = 'loss';
    bpReward = result === 'win' ? BP_WIN : result === 'draw' ? BP_DRAW : BP_LOSS;
  }

  return {
    match_id: match.id,
    status: match.status,
    course_key: match.course_key,
    question_count: match.question_count || questionIds.length,
    current_question_index: idx,
    you: { id: userId, role, score: yourScore, answered_current: answeredCurrent },
    opponent: opponentProfileBase
      ? { ...opponentProfileBase, score: opponentScore, answered_current: opponentAnswered }
      : null,
    self_profile: selfProfile,
    question,
    last_correct_option: lastCorrect,
    finished: match.status === 'finished',
    result,
    bp_reward: bpReward,
  };
}

export async function leaveMatch(matchId: string, userId: string) {
  const { data: match } = await supabaseAdmin
    .from('battle_matches')
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (!match) return;
  if (match.player1_id !== userId && match.player2_id !== userId) return;
  if (match.status === 'waiting') {
    await supabaseAdmin
      .from('battle_matches')
      .update({ status: 'cancelled', finished_at: new Date().toISOString() })
      .eq('id', match.id)
      .eq('status', 'waiting');
    return;
  }
  if (match.status === 'active') {
    // Forfeit: the other player wins. Award BP then mark finished.
    const role: 'player1' | 'player2' = match.player1_id === userId ? 'player1' : 'player2';
    const opponentRole = role === 'player1' ? 'player2' : 'player1';
    const winnerId = opponentRole === 'player1' ? match.player1_id : match.player2_id;
    const { data: finalized } = await supabaseAdmin
      .from('battle_matches')
      .update({
        status: 'finished',
        result: opponentRole,
        winner_id: winnerId,
        finished_at: new Date().toISOString(),
        last_activity_at: new Date().toISOString(),
      })
      .eq('id', match.id)
      .eq('status', 'active')
      .eq('bp_awarded', false)
      .select('*')
      .maybeSingle();
    if (finalized) await awardBp(finalized);
  }
}
