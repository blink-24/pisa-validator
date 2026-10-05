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
      if (m.rows.length === 0) return 0;
      // 숫자 기준은 1~행 수 범위로 보정 (0 이하면 무조건 정답, 행 수 초과면 영원히 오답이 되는 것 방지)
      const need =
        m.fullCredit === 'all' ? m.rows.length : Math.min(Math.max(1, m.fullCredit), m.rows.length);
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
 * 자동 채점 문항은 현재 문항 정의(정답 키)로 다시 채점한다. 저장된 autoScore는 응시 당시의
 * 캐시일 뿐이라, 시범 시행 뒤 정답 키를 고쳐도 통계·재채점에 반영되도록 한다.
 * 구성형은 humanCode 기반. 미채점 구성형은 undefined.
 */
export function responseScore(item: Item, resp: ResponseRecord): number | undefined {
  if (item.responseFormat === 'open_human') {
    return resp.humanCode == null ? undefined : humanCodeToScore(resp.humanCode);
  }
  return autoScore(item, resp.answer) ?? resp.autoScore;
}

/**
 * 경로상(응시 대상) 문항의 득점비율.
 * 응답 기록이 없으면(학생이 건너뜀) 0점으로 본다 — 분모에서 빼면 어려운 문항을
 * 건너뛸수록 정답률이 올라가는 왜곡이 생긴다. 미채점 구성형은 undefined.
 */
export function itemScore(item: Item, resp: ResponseRecord | undefined): number | undefined {
  if (!resp) return 0;
  return responseScore(item, resp);
}

/** 학생이 실제로 답을 입력했는지 (빈 문자열·빈 객체·null은 미응답) */
export function hasAnswer(answer: unknown): boolean {
  if (answer == null) return false;
  if (typeof answer === 'string') return answer.trim() !== '';
  if (typeof answer === 'object') return Object.keys(answer as object).length > 0;
  return true;
}

/** 응답 레코드에 autoScore를 채워 반환(자동 채점 문항만). */
export function withAutoScore(item: Item, resp: ResponseRecord): ResponseRecord {
  if (item.responseFormat === 'open_human') return resp;
  return { ...resp, autoScore: autoScore(item, resp.answer) };
}
