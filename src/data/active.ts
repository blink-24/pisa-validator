// 활성(사용자 응시) 소검사 설정 (Req 9).

import { db, getMeta, setMeta, loadBundle } from './db';
import { runConformance, hasBlockingError } from '../core/conformance';
import type { Subtest } from '../types';

export async function getActiveSubtestId(): Promise<string | null> {
  return (await getMeta('activeSubtestId')) ?? null;
}

export async function setActiveSubtestId(id: string | null): Promise<void> {
  await setMeta('activeSubtestId', id ?? '');
}

export async function getActiveSubtest(): Promise<Subtest | null> {
  const id = await getActiveSubtestId();
  if (!id) return null;
  return (await db.subtests.get(id)) ?? null;
}

/** 정합성 오류가 없는 소검사만 활성화 가능 (Req 9.1). */
export async function isActivatable(subtestId: string): Promise<boolean> {
  const bundle = await loadBundle(subtestId);
  if (!bundle) return false;
  const results = runConformance({
    subtest: bundle.subtest,
    units: bundle.units,
    passages: bundle.passages,
    items: bundle.items,
  });
  return !hasBlockingError(results);
}
