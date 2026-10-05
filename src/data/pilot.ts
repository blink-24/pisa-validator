// 파일럿 결과 내보내기/가져오기 (Req 13.1-13.2). 중복 세션 제거, ID 검증.

import { db, listSessions, loadBundle } from './db';
import type { Session } from '../types';

export interface ResultExport {
  format: 'pisa-validator';
  kind: 'results';
  version: 1;
  subtestId: string;
  itemIds: string[]; // 검증용
  exportedAt: string;
  sessions: Session[];
}

export async function exportResults(subtestId: string): Promise<ResultExport> {
  const bundle = await loadBundle(subtestId);
  const sessions = (await listSessions(subtestId)).filter((s) => s.submittedAt);
  return {
    format: 'pisa-validator',
    kind: 'results',
    version: 1,
    subtestId,
    itemIds: bundle ? bundle.items.map((i) => i.id) : [],
    exportedAt: new Date().toISOString(),
    sessions,
  };
}

export interface ImportResultSummary {
  added: number;
  duplicates: number;
  mismatchedItems: number;
}

/**
 * 결과 JSON 가져오기 (Req 13.2).
 * - 소검사 ID 일치 확인
 * - 문항 ID 집합 일치(교집합) 확인 — 완전히 다르면 거부
 * - 같은 세션 ID 중복은 한 번만 반영
 */
export async function importResults(data: unknown, targetSubtestId: string): Promise<ImportResultSummary> {
  const exp = validateResultExport(data);
  if (exp.subtestId !== targetSubtestId) {
    throw new Error('가져오기 실패: 소검사 ID가 현재 소검사와 다릅니다.');
  }
  const bundle = await loadBundle(targetSubtestId);
  const localItemIds = new Set(bundle ? bundle.items.map((i) => i.id) : []);

  const existing = new Set((await listSessions(targetSubtestId)).map((s) => s.id));
  let added = 0;
  let duplicates = 0;
  let mismatchedItems = 0;

  for (const s of exp.sessions) {
    if (existing.has(s.id)) {
      duplicates++;
      continue;
    }
    // 문항 ID 일치 확인: 응답 문항이 로컬 소검사에 전혀 없으면 건너뜀
    const known = s.responses.filter((r) => localItemIds.has(r.itemId)).length;
    if (s.responses.length > 0 && known === 0) {
      mismatchedItems++;
      continue;
    }
    const marked: Session = { ...s, source: 'imported', importedFrom: exp.exportedAt };
    await db.sessions.put(marked);
    existing.add(s.id);
    added++;
  }
  return { added, duplicates, mismatchedItems };
}

export function validateResultExport(data: unknown): ResultExport {
  if (!data || typeof data !== 'object') throw new Error('가져오기 실패: 객체가 아닙니다.');
  const d = data as Record<string, unknown>;
  if (d.format !== 'pisa-validator' || d.kind !== 'results') {
    throw new Error('가져오기 실패: 결과 파일 형식이 아닙니다.');
  }
  if (typeof d.subtestId !== 'string') throw new Error('가져오기 실패: subtestId 누락');
  if (!Array.isArray(d.sessions)) throw new Error('가져오기 실패: sessions 배열이 없습니다.');
  return {
    format: 'pisa-validator',
    kind: 'results',
    version: 1,
    subtestId: d.subtestId,
    itemIds: Array.isArray(d.itemIds) ? (d.itemIds as string[]) : [],
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    sessions: d.sessions as Session[],
  };
}
