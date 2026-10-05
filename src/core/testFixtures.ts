// 테스트용 픽스처 생성 헬퍼. 자작 데이터만 사용(저작권 지문 없음).

import type { Item, Subtest, ResponseRecord, Session } from '../types';

export function makeSubtest(partial: Partial<Subtest> = {}): Subtest {
  return {
    id: 'st1',
    title: '샘플 소검사',
    description: '',
    target: '고1(만 15세)',
    structure: 'msat3',
    routing: { firstCut: { high: 0.7, mid: 0.4 }, assign: 'deterministic', midGoesTo: 'low' },
    gradeRule: { highBlockCut: 0.5, lowBlockCut: 0.7 },
    allowWithinUnitNav: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

export function makeItem(partial: Partial<Item> & { id: string }): Item {
  return {
    subtestId: 'st1',
    unitId: 'u1',
    order: 1,
    stage: 'core',
    block: 'none',
    stem: '발문',
    cognitiveProcess: 'literal',
    responseFormat: 'simple_mc',
    sourceRequirement: 'single',
    difficulty: 'mid',
    choices: [
      { id: 'a', text: '보기 A' },
      { id: 'b', text: '보기 B' },
    ],
    answer: 'a',
    ...partial,
  };
}

export function resp(itemId: string, answer: unknown, extra: Partial<ResponseRecord> = {}): ResponseRecord {
  return { itemId, answer, timeMs: 10000, ...extra };
}

export function makeSession(partial: Partial<Session> & { id: string }): Session {
  return {
    subtestId: 'st1',
    anonCode: 'A-01',
    startedAt: '2026-01-01T00:00:00.000Z',
    path: [],
    responses: [],
    source: 'local',
    ...partial,
  };
}
