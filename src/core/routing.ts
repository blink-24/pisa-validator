// 단계·묶음 결정 (design §3.2). 자동 채점 문항만 사용 (Req 6.5).

import type { Item, ResponseRecord, RoutingConfig, Block } from '../types';
import { responseScore } from './scoring';
import { mulberry32, seedFromString } from './ids';

export type FirstClass = 'high' | 'mid' | 'low';

/**
 * 자동 채점 문항들의 정답률(0~1).
 * 구성형(open_human) 문항은 분기 계산에서 제외한다 (Req 6.5).
 * 자동 채점 대상이 하나도 없으면 null (분모 0 → 판정 불가).
 */
export function autoRate(
  items: Item[],
  responses: ResponseRecord[],
): { rate: number; correct: number; total: number } | null {
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  let sum = 0;
  let total = 0;
  for (const it of items) {
    if (it.responseFormat === 'open_human') continue;
    const r = byId.get(it.id);
    if (!r) continue;
    const s = responseScore(it, r);
    if (s == null) continue;
    sum += s;
    total++;
  }
  if (total === 0) return null;
  return { rate: sum / total, correct: Math.round(sum), total };
}

/** 정답률을 컷으로 상/중/하 분류 */
export function classify(rate: number, cut: { high: number; mid: number }): FirstClass {
  if (rate >= cut.high) return 'high';
  if (rate >= cut.mid) return 'mid';
  return 'low';
}

/**
 * 1차/2차 분류를 다음 단계 묶음으로 매핑.
 * - deterministic: high→high, low→low, mid→cfg.midGoesTo
 * - pisa_probabilistic: 상 90/10, 하 90/10, 중 50/50 (design §3.2)
 * rng: 0~1 결정적 난수 1개.
 */
export function pickBlock(
  cls: FirstClass,
  cfg: RoutingConfig,
  rng: number,
): Extract<Block, 'low' | 'high'> {
  if (cfg.assign === 'deterministic') {
    if (cls === 'high') return 'high';
    if (cls === 'low') return 'low';
    return cfg.midGoesTo;
  }
  // pisa_probabilistic
  if (cls === 'high') return rng < 0.9 ? 'high' : 'low';
  if (cls === 'low') return rng < 0.9 ? 'low' : 'high';
  return rng < 0.5 ? 'high' : 'low';
}

export interface RouteDecision {
  stage: 'stage1' | 'stage2';
  cls: FirstClass;
  block: Extract<Block, 'low' | 'high'>;
  rate: number;
  correct: number;
  total: number;
  reason: string;
}

/** 세션 ID + 단계로부터 결정적 난수 하나 생성 (재현 가능) */
export function stageRng(sessionId: string, stage: string): number {
  const rng = mulberry32(seedFromString(`${sessionId}:${stage}`));
  return rng();
}

const CLASS_LABEL: Record<FirstClass, string> = { high: '상', mid: '중', low: '하' };
const BLOCK_LABEL: Record<'low' | 'high', string> = { low: '하', high: '상' };

/**
 * 특정 단계 종료 시 다음 단계 묶음을 결정한다.
 * accumulatedItems/responses: 판정에 쓸 누적 문항·응답(core 또는 core∪stage1).
 */
export function decideNextBlock(
  nextStage: 'stage1' | 'stage2',
  accumulatedItems: Item[],
  accumulatedResponses: ResponseRecord[],
  cfg: RoutingConfig,
  sessionId: string,
): RouteDecision | null {
  const r = autoRate(accumulatedItems, accumulatedResponses);
  if (!r) return null; // 자동 채점 문항 없음 → 분기 불가
  const cls = classify(r.rate, cfg.firstCut);
  const rng = stageRng(sessionId, nextStage);
  const block = pickBlock(cls, cfg, rng);
  const pct = Math.round(r.rate * 100);
  const reason =
    `정답률 ${pct}% → '${CLASS_LABEL[cls]}' 분류 → ` +
    `${nextStage === 'stage1' ? '1단계' : '2단계'} '${BLOCK_LABEL[block]} 묶음' 배정` +
    (cfg.assign === 'pisa_probabilistic' ? ' (확률형)' : '');
  return { stage: nextStage, cls, block, rate: r.rate, correct: r.correct, total: r.total, reason };
}
