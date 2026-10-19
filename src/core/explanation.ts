// 사유 문장 생성 (design §3.4). 템플릿 변수 치환만, 자유 생성 금지 (product steering 5).

import type { Item, ResponseRecord, Subtest, Grade, PathStep } from '../types';
import { byProcessGroup, scoredRate } from './grading';
import { autoRate } from './routing';
import { itemScore } from './scoring';
import {
  gradeLabel,
  processGroupLabel,
  blockLabel,
  stageLabel,
  groupOfProcess,
} from '../data/taxonomy';
import type { ProcessGroupCode } from '../data/taxonomy';

export interface ExplanationInput {
  subtest: Subtest;
  items: Item[]; // 응시 문항 전체
  responses: ResponseRecord[];
  grade: Grade;
  firstGrade: Grade;
  provisional: boolean;
  path: PathStep[]; // 세션 경로 기록
}

function pct(n: number): number {
  return Math.round(n * 100);
}

/** 점수 표기: 소수 첫째 자리까지, 정수면 '.0' 없이 (1.5 → "1.5", 2 → "2") */
function fmtPoints(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** 등급 뒤 조사: 받침이 없거나 ㄹ 받침이면 '로', 그 밖의 받침이면 '으로' (상·중 → 으로, 하 → 로) */
function ro(word: string): string {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  if (code < 0 || code > 11171) return '로';
  const jong = code % 28;
  return jong === 0 || jong === 8 ? '로' : '으로';
}

/** ③ 표기용: 대분류별 부분 점수(0 < 점수 < 1) 문항 수. 미채점 서술형은 제외 */
function partialCounts(
  items: Item[],
  responses: ResponseRecord[],
): Partial<Record<ProcessGroupCode, number>> {
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  const out: Partial<Record<ProcessGroupCode, number>> = {};
  for (const it of items) {
    const g = groupOfProcess(it.cognitiveProcess);
    if (!g) continue;
    const s = itemScore(it, byId.get(it.id));
    if (s != null && s > 0 && s < 1) out[g] = (out[g] ?? 0) + 1;
  }
  return out;
}

/** 경로 요약: "1단계 상 묶음 → 2단계 상 묶음" (blockLabel이 이미 '… 묶음'을 돌려준다) */
function summarizePath(path: PathStep[]): string {
  const parts = path
    .filter((p) => p.stage !== 'core')
    .map((p) => `${stageLabel(p.stage)} ${blockLabel(p.block)}`);
  return parts.join(' → ');
}

/**
 * ④ 판단용 대분류별 득점률 = itemScore 합 / 채점된 문항 수.
 * ③의 byProcessGroup(0.5 이상을 '맞힘'으로 세는 개수)과 달리 부분 점수를 그대로 반영한다.
 * 미채점 서술형은 제외하고, 채점된 문항이 없는 대분류는 결과에 넣지 않는다.
 */
function groupScoreRates(
  items: Item[],
  responses: ResponseRecord[],
): Partial<Record<ProcessGroupCode, { rate: number; total: number }>> {
  const byId = new Map(responses.map((r) => [r.itemId, r]));
  const acc: Partial<Record<ProcessGroupCode, { sum: number; total: number }>> = {};
  for (const it of items) {
    const g = groupOfProcess(it.cognitiveProcess);
    if (!g) continue;
    const s = itemScore(it, byId.get(it.id));
    if (s == null) continue; // 미채점 서술형
    const a = acc[g] ?? (acc[g] = { sum: 0, total: 0 });
    a.sum += s;
    a.total++;
  }
  const out: Partial<Record<ProcessGroupCode, { rate: number; total: number }>> = {};
  for (const g of Object.keys(acc) as ProcessGroupCode[]) {
    const a = acc[g]!;
    out[g] = { rate: a.sum / a.total, total: a.total };
  }
  return out;
}

/** ④ 문장. 모두 득점률 1이면 '모두 해결', 아니면 득점률 최저(동률이면 문항 수가 많은 쪽) 대분류. */
function supplementLine(items: Item[], responses: ResponseRecord[]): string | null {
  const rates = groupScoreRates(items, responses);
  const groups = (['locate', 'understand', 'evaluate_reflect'] as ProcessGroupCode[]).filter(
    (g) => rates[g],
  );
  if (groups.length === 0) return null;
  if (groups.every((g) => rates[g]!.rate === 1)) {
    return '④ 모든 인지 과정의 문항을 해결하였습니다.';
  }
  let weak = groups[0]!;
  for (const g of groups) {
    const a = rates[g]!;
    const b = rates[weak]!;
    if (a.rate < b.rate || (a.rate === b.rate && a.total > b.total)) weak = g;
  }
  return `④ 득점률이 가장 낮은 '${processGroupLabel(weak)}' 문항 유형의 보완이 필요합니다.`;
}

export function buildExplanation(input: ExplanationInput): string {
  const { subtest, items, responses, grade, firstGrade, provisional, path } = input;
  const lines: string[] = [];

  const prov = provisional ? '(잠정)' : '';
  lines.push(`첫 소검사(${subtest.title})에서 '${gradeLabel(grade)}' 등급${prov}을 받았습니다.`);
  lines.push('그 사유는 다음과 같습니다.');

  // ① 핵심단계 1차 판정
  const coreItems = items.filter((i) => i.stage === 'core');
  const coreR = autoRate(coreItems.length ? coreItems : items, responses);
  const hi = pct(subtest.routing.firstCut.high);
  const mid = pct(subtest.routing.firstCut.mid);
  if (coreR) {
    lines.push(
      `① 핵심단계 ${coreR.correct}/${coreR.total}문항(${pct(coreR.rate)}%)을 해결하여 1차로 '${gradeLabel(
        firstGrade,
      )}'(기준: 상 ${hi}% 이상, 중 ${mid}% 이상)${ro(gradeLabel(firstGrade))} 판정되었습니다.`,
    );
  }

  // ② 경로 및 최종 묶음
  if (subtest.structure === 'msat3') {
    // 등급 계산(computeGrade)과 같은 집계 함수를 써서 문장과 판정이 어긋나지 않게 한다.
    const stage2Items = items.filter((i) => i.stage === 'stage2');
    const { sum, total } = scoredRate(stage2Items, responses);
    const r2 = total ? sum / total : 0;
    const finalBlock = path.filter((p) => p.stage === 'stage2')[0]?.block;
    const cut =
      finalBlock === 'high'
        ? pct(subtest.gradeRule.highBlockCut)
        : pct(subtest.gradeRule.lowBlockCut);
    // 부분 점수(서술형 Code 1 = 0.5점)가 있어 '문항 수'로 반올림하면 비율과 어긋난다 → 점수로 쓴다.
    // 잠정이면 미채점 서술형이 만점에서 빠지므로, 채점된 문항 기준임을 밝힌다.
    const basis = provisional ? ', 채점된 문항 기준' : '';
    lines.push(
      `② 이에 따라 ${summarizePath(path)}으로 응시했고, 최종 묶음에서 ${total}점 만점에 ${fmtPoints(
        sum,
      )}점(${pct(r2)}%${basis})을 얻어 기준(${cut}%)에 따라 '${gradeLabel(grade)}'${ro(
        gradeLabel(grade),
      )} 판정되었습니다.`,
    );
  }

  // ③ 인지 과정 대분류별 성취
  const groups = byProcessGroup(items, responses);
  const partial = partialCounts(items, responses);
  const g3: string[] = [];
  (['locate', 'understand', 'evaluate_reflect'] as ProcessGroupCode[]).forEach((g) => {
    const { correct, total } = groups[g];
    if (total === 0) return; // 0개 대분류는 생략
    // byProcessGroup은 0.5점 이상을 '맞힘'으로 센다 → 부분 점수 문항은 따로 밝힌다.
    const pc = partial[g] ? `(부분 점수 ${partial[g]}문항)` : '';
    g3.push(`${processGroupLabel(g)} ${correct}/${total}${pc}`);
  });
  if (g3.length) {
    lines.push(`③ 인지 과정별로는 ${g3.join(', ')}입니다.`);
  }

  // ④ 보완 필요 유형 (부분 점수 반영 득점률 기준). 잠정이면 채점된 문항만 본 판단임을 밝힌다.
  const line4 = supplementLine(items, responses);
  if (line4) {
    lines.push(provisional ? `${line4} (채점된 문항 기준)` : line4);
  }

  // 등급별 설명문 (있으면)
  const desc = subtest.gradeDescriptors?.[grade];
  if (desc && desc.trim()) {
    lines.push(`[등급 특성] ${desc.trim()}`);
  }

  // 잠정 문구
  if (provisional) {
    lines.push('서술형 문항 채점 후 등급이 확정됩니다.');
  }

  return lines.join('\n');
}
