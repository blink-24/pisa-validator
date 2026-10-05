// Dexie 데이터 계층 (Task 2.1, design §2). 소검사별 레코드 분리 저장.
// 모든 영속 데이터는 IndexedDB. 서버 없음.

import Dexie, { type Table } from 'dexie';
import type {
  Subtest,
  Unit,
  Passage,
  Item,
  Session,
  Asset,
  AppMeta,
  AppMetaKey,
} from '../types';

export class PisaDB extends Dexie {
  subtests!: Table<Subtest, string>;
  units!: Table<Unit, string>;
  passages!: Table<Passage, string>;
  items!: Table<Item, string>;
  sessions!: Table<Session, string>;
  assets!: Table<Asset, string>;
  meta!: Table<AppMeta, AppMetaKey>;

  constructor() {
    super('pisa-validator');
    this.version(1).stores({
      subtests: 'id, updatedAt',
      units: 'id, subtestId, unitNo',
      passages: 'id, unitId',
      // 복합 인덱스로 단계·묶음별 조회
      items: 'id, subtestId, unitId, [subtestId+stage+block]',
      sessions: 'id, subtestId, anonCode, submittedAt',
      assets: 'id',
      meta: 'key',
    });
  }
}

export const db = new PisaDB();

// ---- meta 헬퍼 ----

export async function getMeta(key: AppMetaKey): Promise<string | undefined> {
  const row = await db.meta.get(key);
  return row?.value;
}

export async function setMeta(key: AppMetaKey, value: string): Promise<void> {
  await db.meta.put({ key, value });
}

// ---- 소검사 집계 조회 (목록 표시용) ----

export interface SubtestSummary {
  subtest: Subtest;
  unitCount: number;
  itemCount: number;
  resultCount: number;
}

export async function listSubtestSummaries(): Promise<SubtestSummary[]> {
  const subtests = await db.subtests.orderBy('updatedAt').reverse().toArray();
  const summaries: SubtestSummary[] = [];
  for (const st of subtests) {
    const [unitCount, itemCount, resultCount] = await Promise.all([
      db.units.where('subtestId').equals(st.id).count(),
      db.items.where('subtestId').equals(st.id).count(),
      db.sessions.where('subtestId').equals(st.id).count(),
    ]);
    summaries.push({ subtest: st, unitCount, itemCount, resultCount });
  }
  return summaries;
}

// ---- 소검사 묶음(subtest + 하위 전체) 로드 ----

export interface SubtestBundle {
  subtest: Subtest;
  units: Unit[];
  passages: Passage[];
  items: Item[];
}

export async function loadBundle(subtestId: string): Promise<SubtestBundle | null> {
  const subtest = await db.subtests.get(subtestId);
  if (!subtest) return null;
  const units = await db.units.where('subtestId').equals(subtestId).sortBy('unitNo');
  const unitIds = new Set(units.map((u) => u.id));
  const allPassages = await db.passages.toArray();
  const passages = allPassages.filter((p) => unitIds.has(p.unitId));
  const items = await db.items.where('subtestId').equals(subtestId).sortBy('order');
  return { subtest, units, passages, items };
}

export async function listSessions(subtestId: string): Promise<Session[]> {
  return db.sessions.where('subtestId').equals(subtestId).toArray();
}
