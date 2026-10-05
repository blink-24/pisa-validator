// 문항 통계 (design §3.6, Req 13.3-13.6). 순수 함수.
// 적응형이라 문항마다 응시자 집합이 다름 → "해당 문항을 본 학생만" 대상.

import type { Item, Session, CodingValue } from '../types';
import { responseScore } from './scoring';

export interface ItemStat {
  itemId: string;
  n: number; // 응시자 수(해당 문항을 본)
  p: number; // 평균 득점비율
  discrimination: number | null; // 교정된 문항-총점 상관
  timeMeanMs: number;
  timeMedianMs: number;
  timeIqrMs: number;
  codingDist?: Record<CodingValue, number>; // 구성형 코드 분포
  choiceDist?: Record<string, number>; // 선택지별 선택률(simple_mc)
}

function median(sorted: number[]): number {
  const n = sorted.length;
  if (n === 0) return 0;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  const lo = sorted[base]!;
  const hi = sorted[base + 1];
  return hi !== undefined ? lo + rest * (hi - lo) : lo;
}

/** 피어슨 상관 */
function pearson(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i]! - mx;
    const b = ys[i]! - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

/** 세션의 채점된 응답 득점 합계와 개수 — 교정 총점 계산용 */
function sessionScoredSum(session: Session, itemsById: Map<string, Item>): { sum: number; count: number } {
  let sum = 0;
  let count = 0;
  for (const r of session.responses) {
    const it = itemsById.get(r.itemId);
    if (!it) continue;
    const s = responseScore(it, r);
    if (s == null) continue; // 미채점 구성형 제외
    sum += s;
    count++;
  }
  return { sum, count };
}

export function computeItemStats(items: Item[], sessions: Session[]): ItemStat[] {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  const out: ItemStat[] = [];
  // 세션별 응답 색인과 채점 합계는 문항과 무관하므로 한 번만 계산 (문항 수 × 세션 수 × 응답 수 반복 방지)
  const perSession = sessions.map((sess) => ({
    byItem: new Map(sess.responses.map((r) => [r.itemId, r])),
    ...sessionScoredSum(sess, itemsById),
  }));

  for (const item of items) {
    const scores: number[] = [];
    const times: number[] = [];
    // 변별도 전용 index-aligned 쌍. 교정 총점을 낼 수 없는 세션(채점 응답 1개)은 제외하므로
    // scores/times보다 짧을 수 있다.
    const discScores: number[] = [];
    const discTotals: number[] = [];
    const coding: Record<CodingValue, number> = { 2: 0, 1: 0, 0: 0, 9: 0 };
    const choice: Record<string, number> = {};

    for (const sess of perSession) {
      const r = sess.byItem.get(item.id);
      if (!r) continue; // 이 문항을 보지 않은 학생 제외
      const s = responseScore(item, r);
      if (s == null) continue; // 미채점 구성형 제외
      scores.push(s);
      times.push(r.timeMs);
      // 교정된 문항-총점 상관(design §3.6): 총점에서 해당 문항 자신의 점수를 뺀
      // 나머지 득점비율 = (채점 응답 득점 합 − 이 문항 점수) / (채점 응답 수 − 1).
      // 채점 응답이 이 문항 하나뿐이면(분모 0) 나머지가 없으므로 변별도 입력에서 제외한다.
      const { sum: scoredSum, count: scoredCount } = sess;
      const restCount = scoredCount - 1;
      if (restCount > 0) {
        discScores.push(s);
        discTotals.push((scoredSum - s) / restCount);
      }
      if (item.responseFormat === 'open_human' && r.humanCode != null) {
        coding[r.humanCode]++;
      }
      if (item.responseFormat === 'simple_mc' && typeof r.answer === 'string') {
        choice[r.answer] = (choice[r.answer] ?? 0) + 1;
      }
    }

    const n = scores.length;
    const p = n ? scores.reduce((a, b) => a + b, 0) / n : 0;
    const sortedTimes = [...times].sort((a, b) => a - b);
    const disc = pearson(discScores, discTotals);

    out.push({
      itemId: item.id,
      n,
      p,
      discrimination: disc,
      timeMeanMs: n ? times.reduce((a, b) => a + b, 0) / n : 0,
      timeMedianMs: median(sortedTimes),
      timeIqrMs: quantile(sortedTimes, 0.75) - quantile(sortedTimes, 0.25),
      ...(item.responseFormat === 'open_human' ? { codingDist: coding } : {}),
      ...(item.responseFormat === 'simple_mc' ? { choiceDist: choice } : {}),
    });
  }

  return out;
}

/** 설계 난도와 실제 정답률 불일치 (Req 13.4). 기본: '상'인데 p>0.8 또는 '하'인데 p<0.2 */
export function difficultyMismatches(
  items: Item[],
  stats: ItemStat[],
  thresholds = { highMaxP: 0.8, lowMinP: 0.2 },
): string[] {
  const statById = new Map(stats.map((s) => [s.itemId, s]));
  const bad: string[] = [];
  for (const it of items) {
    const st = statById.get(it.id);
    if (!st || st.n === 0) continue;
    if (it.difficulty === 'high' && st.p > thresholds.highMaxP) bad.push(it.id);
    if (it.difficulty === 'low' && st.p < thresholds.lowMinP) bad.push(it.id);
  }
  return bad;
}

/** 경로별 학생 수와 최종 등급 분포 (Req 13.5) */
export function pathDistribution(sessions: Session[]): Record<string, { count: number; grades: Record<string, number> }> {
  const out: Record<string, { count: number; grades: Record<string, number> }> = {};
  for (const s of sessions) {
    const key = s.path
      .filter((p) => p.stage !== 'core')
      .map((p) => `${p.stage}:${p.block}`)
      .join(' → ') || '(단일 단계)';
    const entry = out[key] ?? (out[key] = { count: 0, grades: {} });
    entry.count++;
    const g = s.result?.grade ?? '미정';
    entry.grades[g] = (entry.grades[g] ?? 0) + 1;
  }
  return out;
}

/** 태그별 평균 p·변별도·문항 수 (Req 13.6) */
export function tagComparison(
  items: Item[],
  stats: ItemStat[],
): Record<string, { count: number; avgP: number; avgDisc: number | null }> {
  const statById = new Map(stats.map((s) => [s.itemId, s]));
  const acc: Record<string, { ps: number[]; discs: number[] }> = {};
  for (const it of items) {
    const st = statById.get(it.id);
    if (!st) continue;
    for (const tag of it.tags ?? []) {
      const a = acc[tag] ?? (acc[tag] = { ps: [], discs: [] });
      a.ps.push(st.p);
      if (st.discrimination != null) a.discs.push(st.discrimination);
    }
  }
  const out: Record<string, { count: number; avgP: number; avgDisc: number | null }> = {};
  for (const [tag, a] of Object.entries(acc)) {
    out[tag] = {
      count: a.ps.length,
      avgP: a.ps.length ? a.ps.reduce((x, y) => x + y, 0) / a.ps.length : 0,
      avgDisc: a.discs.length ? a.discs.reduce((x, y) => x + y, 0) / a.discs.length : null,
    };
  }
  return out;
}
