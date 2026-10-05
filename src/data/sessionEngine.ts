// 응시 세션 엔진 (Req 10·11). core → routing → stage1 → routing → stage2 → 제출.

import { db, loadBundle, type SubtestBundle } from './db';
import { uid } from '../core/ids';
import { withAutoScore, hasAnswer } from '../core/scoring';
import { decideNextBlock } from '../core/routing';
import { computeGrade, hasUngradedOpen, byProcessGroup } from '../core/grading';
import { buildExplanation } from '../core/explanation';
import type { Item, Session, ResponseRecord, Result, Stage, Block } from '../types';

export interface StagePlan {
  stage: Stage;
  block: Block;
  items: Item[];
}

/** 진행 중(미제출) 세션 조회 — 같은 소검사+코드로 이어서 응시 (Req 10.6). */
export async function findResumableSession(subtestId: string, anonCode: string): Promise<Session | null> {
  const sessions = await db.sessions.where('subtestId').equals(subtestId).toArray();
  return sessions.find((s) => s.anonCode === anonCode && !s.submittedAt) ?? null;
}

export async function createSession(subtestId: string, anonCode: string): Promise<Session> {
  const session: Session = {
    id: uid('sess'),
    subtestId,
    anonCode,
    startedAt: new Date().toISOString(),
    path: [{ stage: 'core', block: 'none', reason: '시작' }],
    responses: [],
    source: 'local',
  };
  await db.sessions.put(session);
  return session;
}

export async function saveSession(session: Session): Promise<void> {
  await db.sessions.put(session);
}

/** 단계별 문항 묶음. core는 전부, stage1/stage2는 결정된 block만. */
export function stageItems(bundle: SubtestBundle, stage: Stage, block: Block): Item[] {
  return bundle.items
    .filter((i) => i.stage === stage && (stage === 'core' ? true : i.block === block))
    .sort((a, b) => {
      // 단위 순서 → 문항 순서
      if (a.unitId !== b.unitId) {
        const ua = bundle.units.find((u) => u.id === a.unitId)?.unitNo ?? 0;
        const ub = bundle.units.find((u) => u.id === b.unitId)?.unitNo ?? 0;
        return ua - ub;
      }
      return a.order - b.order;
    });
}

/** 학생이 해당 단계를 끝냈다고 표시('단계 완료' 버튼). 이미 표시돼 있으면 그대로 반환. */
export function markStageCompleted(session: Session, stage: Stage): Session {
  const done = session.completedStages ?? [];
  if (done.includes(stage)) return session;
  return { ...session, completedStages: [...done, stage] };
}

/**
 * 단계 완료 판정: 학생이 '단계 완료'를 눌렀거나, 문항이 없거나, 모든 문항에 응답 기록이 있음.
 * 예전에는 '모든 문항 응답'만 기준이라, 한 문항이라도 건너뛰면 다음 단계 대신 같은 단계 처음으로 되돌아갔다.
 */
function isStageDone(session: Session, stage: Stage, items: Item[], answered: Set<string>): boolean {
  if (session.completedStages?.includes(stage)) return true;
  return items.length === 0 || items.every((i) => answered.has(i.id));
}

/**
 * 현재 세션의 경로를 바탕으로 다음에 응시할 단계 계획을 돌려준다.
 * - 아직 core 미완료: core
 * - core 완료, stage1 미배정: routing으로 stage1 block 결정 후 반환
 * - stage1 완료, stage2 미배정: routing으로 stage2 block 결정
 * - 모두 완료: null (제출 가능)
 */
export async function nextStagePlan(
  bundle: SubtestBundle,
  session: Session,
): Promise<{ plan: StagePlan | null; session: Session }> {
  const answered = new Set(session.responses.map((r) => r.itemId));

  const coreItems = stageItems(bundle, 'core', 'none');
  if (!isStageDone(session, 'core', coreItems, answered)) {
    return { plan: { stage: 'core', block: 'none', items: coreItems }, session };
  }

  if (bundle.subtest.structure === 'single') {
    return { plan: null, session };
  }

  // stage1
  let s1 = session.path.find((p) => p.stage === 'stage1');
  if (!s1) {
    const decision = decideNextBlock('stage1', coreItems, session.responses, bundle.subtest.routing, session.id);
    const block: Block = decision ? decision.block : 'low';
    const reason = decision ? decision.reason : '자동 채점 문항 없음 → 하 묶음 기본 배정';
    session = { ...session, path: [...session.path, { stage: 'stage1', block, reason }] };
    await saveSession(session);
    s1 = { stage: 'stage1', block, reason };
  }
  const s1Items = stageItems(bundle, 'stage1', s1.block as Block);
  if (!isStageDone(session, 'stage1', s1Items, answered)) {
    return { plan: { stage: 'stage1', block: s1.block as Block, items: s1Items }, session };
  }

  // stage2
  let s2 = session.path.find((p) => p.stage === 'stage2');
  if (!s2) {
    const accItems = [...coreItems, ...s1Items];
    const decision = decideNextBlock('stage2', accItems, session.responses, bundle.subtest.routing, session.id);
    const block: Block = decision ? decision.block : 'low';
    const reason = decision ? decision.reason : '자동 채점 문항 없음 → 하 묶음 기본 배정';
    session = { ...session, path: [...session.path, { stage: 'stage2', block, reason }] };
    await saveSession(session);
    s2 = { stage: 'stage2', block, reason };
  }
  const s2Items = stageItems(bundle, 'stage2', s2.block as Block);
  if (!isStageDone(session, 'stage2', s2Items, answered)) {
    return { plan: { stage: 'stage2', block: s2.block as Block, items: s2Items }, session };
  }

  return { plan: null, session };
}

/** 모든 응시 문항(경로상) 모으기 — 채점·등급·사유용. */
export function itineraryItems(bundle: SubtestBundle, session: Session): Item[] {
  const items = stageItems(bundle, 'core', 'none');
  if (bundle.subtest.structure === 'single') return items;
  const s1 = session.path.find((p) => p.stage === 'stage1');
  const s2 = session.path.find((p) => p.stage === 'stage2');
  if (s1) items.push(...stageItems(bundle, 'stage1', s1.block as Block));
  if (s2) items.push(...stageItems(bundle, 'stage2', s2.block as Block));
  return items;
}

/** 응답을 기록하고 자동 채점을 채운다. 기존 응답은 교체. */
export function recordResponse(session: Session, item: Item, answer: unknown, timeMs: number): Session {
  const base: ResponseRecord = { itemId: item.id, answer, timeMs };
  const scored = withAutoScore(item, base);
  const others = session.responses.filter((r) => r.itemId !== item.id);
  // 같은 문항 재응답 시 체류 시간 누적
  const prev = session.responses.find((r) => r.itemId === item.id);
  if (prev) scored.timeMs = prev.timeMs + timeMs;
  return { ...session, responses: [...others, scored] };
}

/** 미응답 문항 수(경로상 전체 기준). 빈 답(지운 답)도 미응답으로 센다 — 화면의 응답 수 표시와 같은 기준. */
export function unansweredCount(bundle: SubtestBundle, session: Session): number {
  const answered = new Set(session.responses.filter((r) => hasAnswer(r.answer)).map((r) => r.itemId));
  return itineraryItems(bundle, session).filter((i) => !answered.has(i.id)).length;
}

/** 제출 → 등급·사유 계산 후 저장 (Req 11). */
export async function submitSession(subtestId: string, sessionId: string): Promise<Session> {
  const bundle = await loadBundle(subtestId);
  const session = await db.sessions.get(sessionId);
  if (!bundle || !session) throw new Error('세션 또는 소검사를 찾을 수 없습니다.');

  const items = itineraryItems(bundle, session);
  const result = computeResult(bundle, session, items);
  const finalized: Session = {
    ...session,
    submittedAt: new Date().toISOString(),
    result,
  };
  await db.sessions.put(finalized);
  return finalized;
}

export function computeResult(
  bundle: SubtestBundle,
  session: Session,
  items: Item[],
): Result {
  const finalBlockStep = session.path.find((p) => p.stage === 'stage2');
  const finalBlock = finalBlockStep ? (finalBlockStep.block as 'low' | 'high') : undefined;

  const { grade, firstGrade, first } = computeGrade(
    { subtest: bundle.subtest, items, responses: session.responses },
    finalBlock,
  );
  const provisional = hasUngradedOpen(items, session.responses);
  const groups = byProcessGroup(items, session.responses);

  const explanation = buildExplanation({
    subtest: bundle.subtest,
    items,
    responses: session.responses,
    grade,
    firstGrade,
    provisional,
    path: session.path,
  });

  return {
    grade,
    provisional,
    firstJudgement: { grade: firstGrade, correct: first.correct, total: first.total, rate: first.rate },
    byProcessGroup: groups,
    explanation,
  };
}
