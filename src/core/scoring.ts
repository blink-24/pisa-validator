// 자동 채점 (design §3.1). 순수 함수. UI 비의존.

import type { Item, ResponseRecord, CodingValue } from '../types';

/** 단답 정규화 */
function normalizeAnswer(
  s: string,
  opt?: { ignoreSpace: boolean; ignoreCase: boolean },
): string {
  let out = s.trim();
  if (opt?.ignoreSpace) out = out.replace(/\s+/g, '');
  if (opt?.ignoreCase) out = out.toLowerCase();
  return out;
}

/**
 * 응답 하나의 자동 채점 결과(0~1)를 반환.
 * 자동 채점 대상이 아니면(open_human) undefined.
 */
export function autoScore(item: Item, answer: unknown): number | undefined {
  switch (item.responseFormat) {
    case 'simple_mc': {
      return answer != null && answer === item.answer ? 1 : 0;
    }
    case 'complex_mc': {
      const m = item.matrix;
      if (!m) return 0;
      // answer: Record<rowId, selectedColValue>
      const picks = (answer ?? {}) as Record<string, string>;
      let correct = 0;
      for (const row of m.rows) {
        if (picks[row.id] === row.answer) correct++;
      }
      const need = m.fullCredit === 'all' ? m.rows.length : m.fullCredit;
      return correct >= need ? 1 : 0;
    }
    case 'short_auto': {
      if (typeof answer !== 'string') return 0;
      const got = normalizeAnswer(answer, item.normalize);
      const accepted = (item.acceptedAnswers ?? []).map((a) => normalizeAnswer(a, item.normalize));
      return accepted.includes(got) ? 1 : 0;
    }
    case 'open_human':
      return undefined;
    default:
      return undefined;
  }
}

/** 구성형 교사 코드 → 득점비율. 9(무응답)=0, 그 외 code/최고코드(2). */
export function humanCodeToScore(code: CodingValue): number {
  if (code === 9) return 0;
  return code / 2;
}

/**
 * 응답의 최종 득점비율(0~1).
 * 자동 채점 문항은 autoScore, 구성형은 humanCode 기반. 미채점 구성형은 undefined.
 */
export function responseScore(item: Item, resp: ResponseRecord): number | undefined {
  if (item.responseFormat === 'open_human') {
    return resp.humanCode == null ? undefined : humanCodeToScore(resp.humanCode);
  }
  if (resp.autoScore != null) return resp.autoScore;
  return autoScore(item, resp.answer);
}

/** 응답 레코드에 autoScore를 채워 반환(자동 채점 문항만). */
export function withAutoScore(item: Item, resp: ResponseRecord): ResponseRecord {
  if (item.responseFormat === 'open_human') return resp;
  return { ...resp, autoScore: autoScore(item, resp.answer) };
}
