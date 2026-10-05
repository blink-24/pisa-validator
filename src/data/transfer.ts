// 백업/복원, 소검사 단위 내보내기/가져오기, 스키마 검증 (Task 2.3, Req 2.6-2.7, 14).

import { db, loadBundle, setMeta } from './db';
import {
  serializeAssets,
  restoreAssets,
  type SerializedAsset,
} from './assets';
import { uid } from '../core/ids';
import type { Subtest, Unit, Passage, Item, Session } from '../types';

export const FORMAT = 'pisa-validator';

// ---- 소검사 단위 내보내기 ----

export interface SubtestExport {
  format: typeof FORMAT;
  kind: 'subtest';
  version: 1;
  exportedAt: string;
  subtest: Subtest;
  units: Unit[];
  passages: Passage[];
  items: Item[];
  assets: SerializedAsset[];
}

function collectImageIds(passages: Passage[]): string[] {
  const ids: string[] = [];
  for (const p of passages) ids.push(...(p.imageIds ?? []));
  return ids;
}

export async function exportSubtest(subtestId: string): Promise<SubtestExport> {
  const bundle = await loadBundle(subtestId);
  if (!bundle) throw new Error('소검사를 찾을 수 없습니다.');
  const assets = await serializeAssets(collectImageIds(bundle.passages));
  return {
    format: FORMAT,
    kind: 'subtest',
    version: 1,
    exportedAt: new Date().toISOString(),
    subtest: bundle.subtest,
    units: bundle.units,
    passages: bundle.passages,
    items: bundle.items,
    assets,
  };
}

// ---- 전체 백업 ----

export interface FullBackup {
  format: typeof FORMAT;
  kind: 'backup';
  version: 1;
  exportedAt: string;
  subtests: Subtest[];
  units: Unit[];
  passages: Passage[];
  items: Item[];
  sessions: Session[];
  assets: SerializedAsset[];
}

export async function exportFullBackup(): Promise<FullBackup> {
  const [subtests, units, passages, items, sessions, assets] = await Promise.all([
    db.subtests.toArray(),
    db.units.toArray(),
    db.passages.toArray(),
    db.items.toArray(),
    db.sessions.toArray(),
    db.assets.toArray(),
  ]);
  const serializedAssets = await serializeAssets(assets.map((a) => a.id));
  return {
    format: FORMAT,
    kind: 'backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    subtests,
    units,
    passages,
    items,
    sessions,
    assets: serializedAssets,
  };
}

export async function restoreFullBackup(data: unknown): Promise<void> {
  const b = validateBackup(data);
  await db.transaction('rw', [db.subtests, db.units, db.passages, db.items, db.sessions, db.assets], async () => {
    await Promise.all([
      db.subtests.clear(),
      db.units.clear(),
      db.passages.clear(),
      db.items.clear(),
      db.sessions.clear(),
      db.assets.clear(),
    ]);
    await db.subtests.bulkPut(b.subtests);
    await db.units.bulkPut(b.units);
    await db.passages.bulkPut(b.passages);
    await db.items.bulkPut(b.items);
    await db.sessions.bulkPut(b.sessions);
    await restoreAssets(b.assets);
  });
}

// ---- 스키마 검증 ----

function fail(path: string, msg: string): never {
  throw new Error(`가져오기 실패: ${path} ${msg}`);
}

function expectArray(v: unknown, path: string): unknown[] {
  if (!Array.isArray(v)) fail(path, '배열이어야 합니다.');
  return v;
}

function expectString(v: unknown, path: string): string {
  if (typeof v !== 'string') fail(path, '문자열이어야 합니다.');
  return v;
}

export function validateSubtestExport(data: unknown): SubtestExport {
  if (!data || typeof data !== 'object') fail('(root)', '객체가 아닙니다.');
  const d = data as Record<string, unknown>;
  if (d.format !== FORMAT) fail('format', `'${FORMAT}'이어야 합니다.`);
  if (d.kind !== 'subtest') fail('kind', "'subtest'이어야 합니다.");
  if (!d.subtest || typeof d.subtest !== 'object') fail('subtest', '필수입니다.');
  expectString((d.subtest as Record<string, unknown>).id, 'subtest.id');
  expectArray(d.units, 'units');
  expectArray(d.passages, 'passages');
  expectArray(d.items, 'items');
  if (d.assets !== undefined) expectArray(d.assets, 'assets');
  return {
    format: FORMAT,
    kind: 'subtest',
    version: 1,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    subtest: d.subtest as Subtest,
    units: d.units as Unit[],
    passages: d.passages as Passage[],
    items: d.items as Item[],
    assets: (d.assets as SerializedAsset[]) ?? [],
  };
}

export function validateBackup(data: unknown): FullBackup {
  if (!data || typeof data !== 'object') fail('(root)', '객체가 아닙니다.');
  const d = data as Record<string, unknown>;
  if (d.format !== FORMAT) fail('format', `'${FORMAT}'이어야 합니다.`);
  if (d.kind !== 'backup') fail('kind', "'backup'이어야 합니다.");
  for (const k of ['subtests', 'units', 'passages', 'items', 'sessions']) {
    expectArray(d[k], k);
  }
  return {
    format: FORMAT,
    kind: 'backup',
    version: 1,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : new Date().toISOString(),
    subtests: d.subtests as Subtest[],
    units: d.units as Unit[],
    passages: d.passages as Passage[],
    items: d.items as Item[],
    sessions: d.sessions as Session[],
    assets: (d.assets as SerializedAsset[]) ?? [],
  };
}

// ---- 소검사 가져오기 (ID 충돌 처리) ----

export type ImportMode = 'new_copy' | 'overwrite';

/** 소검사 ID가 이미 존재하는지 */
export async function subtestExists(id: string): Promise<boolean> {
  return (await db.subtests.get(id)) != null;
}

/**
 * 소검사 가져오기. mode:
 * - new_copy: 모든 레코드에 새 ID 부여(참조 재배선), 제목에 "(사본)" 추가
 * - overwrite: 같은 ID로 덮어쓰기(기존 하위 레코드 삭제 후 삽입)
 */
export async function importSubtest(exp: SubtestExport, mode: ImportMode): Promise<string> {
  if (mode === 'overwrite') {
    return importOverwrite(exp);
  }
  return importAsNewCopy(exp);
}

/**
 * 같은 ID로 덮어쓰기. preserveUpdatedAt이면 파일의 수정 시각을 그대로 둔다
 * (배포본 동기화에서 '이 기기에서 배포 이후 수정했는지'를 수정 시각으로 비교하기 때문).
 */
export async function importOverwrite(
  exp: SubtestExport,
  opts: { preserveUpdatedAt?: boolean } = {},
): Promise<string> {
  const stId = exp.subtest.id;
  await db.transaction('rw', [db.subtests, db.units, db.passages, db.items, db.sessions, db.assets], async () => {
    const oldUnits = await db.units.where('subtestId').equals(stId).toArray();
    const oldUnitIds = new Set(oldUnits.map((u) => u.id));
    const oldPassages = (await db.passages.toArray()).filter((p) => oldUnitIds.has(p.unitId));
    await db.passages.bulkDelete(oldPassages.map((p) => p.id));
    await db.units.bulkDelete([...oldUnitIds]);
    await db.items.where('subtestId').equals(stId).delete();

    await db.subtests.put(
      opts.preserveUpdatedAt ? exp.subtest : { ...exp.subtest, updatedAt: new Date().toISOString() },
    );
    await db.units.bulkPut(exp.units);
    await db.passages.bulkPut(exp.passages);
    await db.items.bulkPut(exp.items);
    await restoreAssets(exp.assets);
  });
  return stId;
}

async function importAsNewCopy(exp: SubtestExport): Promise<string> {
  const newStId = uid('st');
  const unitIdMap = new Map<string, string>();
  const assetIdMap = new Map<string, string>();

  for (const u of exp.units) unitIdMap.set(u.id, uid('u'));
  for (const a of exp.assets) assetIdMap.set(a.id, uid('img'));

  const now = new Date().toISOString();
  const subtest: Subtest = {
    ...exp.subtest,
    id: newStId,
    title: `${exp.subtest.title} (사본)`,
    createdAt: now,
    updatedAt: now,
  };
  const units: Unit[] = exp.units.map((u) => ({
    ...u,
    id: unitIdMap.get(u.id)!,
    subtestId: newStId,
  }));
  const passages: Passage[] = exp.passages.map((p) => ({
    ...p,
    unitId: unitIdMap.get(p.unitId) ?? p.unitId,
    imageIds: (p.imageIds ?? []).map((imgId) => assetIdMap.get(imgId) ?? imgId),
  }));
  const items: Item[] = exp.items.map((it) => ({
    ...it,
    subtestId: newStId,
    unitId: unitIdMap.get(it.unitId) ?? it.unitId,
  }));

  await db.transaction('rw', db.subtests, db.units, db.passages, db.items, db.assets, async () => {
    await db.subtests.put(subtest);
    await db.units.bulkPut(units);
    await db.passages.bulkPut(passages);
    await db.items.bulkPut(items);
    await restoreAssets(exp.assets, assetIdMap);
  });
  return newStId;
}

// ---- 파일 다운로드/업로드 유틸 ----

export function downloadJson(data: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('가져오기 실패: JSON 파싱 오류');
  }
}

export async function markBackupNow(): Promise<void> {
  await setMeta('lastBackupAt', new Date().toISOString());
}
