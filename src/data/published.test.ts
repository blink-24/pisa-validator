import 'fake-indexeddb/auto';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import committedRaw from '../../public/content/published.json?raw';
import { db, getMeta } from './db';
import { getActiveSubtestId } from './active';
import {
  applyPublished,
  compareWithPublished,
  githubUploadUrl,
  validatePublished,
  type PublishedContent,
} from './published';
import { FORMAT, type SubtestExport } from './transfer';
import { makeItem, makeSession, makeSubtest } from '../core/testFixtures';

function subtestExport(updatedAt: string, title = '배포 소검사'): SubtestExport {
  return {
    format: FORMAT,
    kind: 'subtest',
    version: 1,
    exportedAt: updatedAt,
    subtest: makeSubtest({ id: 'st1', title, updatedAt }),
    units: [
      { id: 'u1', subtestId: 'st1', unitNo: 901, title: '단위', scenarioIntro: '', passageIds: [] },
    ],
    passages: [],
    items: [makeItem({ id: 'CR901Q01' })],
    assets: [],
  };
}

function pub(partial: Partial<PublishedContent> = {}): PublishedContent {
  return {
    format: FORMAT,
    kind: 'published',
    version: 1,
    publishedAt: '2026-10-05T10:00:00.000Z',
    activeSubtestId: 'st1',
    subtests: [subtestExport('2026-10-05T09:00:00.000Z')],
    ...partial,
  };
}

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('저장소의 배포 파일', () => {
  it('public/content/published.json이 올바른 형식이다 (잘못 올리면 배포 전 테스트에서 멈춤)', () => {
    expect(() => validatePublished(JSON.parse(committedRaw))).not.toThrow();
  });
});

describe('validatePublished', () => {
  it('활성 소검사가 배포 대상에 없으면 거부', () => {
    expect(() => validatePublished({ ...pub(), activeSubtestId: 'nope' })).toThrow(
      /activeSubtestId/,
    );
  });
  it('형식이 다르면 거부', () => {
    expect(() => validatePublished({ ...pub(), kind: 'backup' })).toThrow(/kind/);
  });
});

describe('applyPublished', () => {
  it('새 기기: 소검사를 추가하고 활성 소검사를 설정하며, 같은 배포본은 다시 적용하지 않는다', async () => {
    const r = await applyPublished(pub());
    expect(r).toEqual({ status: 'applied', updated: ['st1'], keptLocal: [] });
    expect((await db.subtests.get('st1'))?.updatedAt).toBe('2026-10-05T09:00:00.000Z'); // 수정 시각 보존
    expect(await db.items.count()).toBe(1);
    expect(await getActiveSubtestId()).toBe('st1');
    expect(await getMeta('publishedAt')).toBe('2026-10-05T10:00:00.000Z');

    expect((await applyPublished(pub())).status).toBe('unchanged');
  });

  it('더 새로운 배포본은 이전 배포본을 교체한다', async () => {
    await applyPublished(pub());
    const r = await applyPublished(
      pub({
        publishedAt: '2026-10-06T10:00:00.000Z',
        subtests: [subtestExport('2026-10-06T09:00:00.000Z', '고친 제목')],
      }),
    );
    expect(r.updated).toEqual(['st1']);
    expect((await db.subtests.get('st1'))?.title).toBe('고친 제목');
  });

  it('이 기기에서 배포 이후 더 수정한 소검사(관리자 기기)는 덮어쓰지 않는다', async () => {
    await db.subtests.put(
      makeSubtest({ id: 'st1', title: '작업 중', updatedAt: '2026-10-07T00:00:00.000Z' }),
    );
    const r = await applyPublished(pub());
    expect(r.keptLocal).toEqual(['st1']);
    expect((await db.subtests.get('st1'))?.title).toBe('작업 중');
  });

  it('학생 응답(세션)은 건드리지 않는다', async () => {
    await db.sessions.put(makeSession({ id: 'sess1' }));
    await applyPublished(pub());
    expect(await db.sessions.get('sess1')).toBeDefined();
  });

  it('아직 배포한 적 없는 빈 배포본은 아무것도 바꾸지 않는다', async () => {
    const r = await applyPublished(pub({ publishedAt: '', activeSubtestId: null, subtests: [] }));
    expect(r.status).toBe('empty');
    expect(await getMeta('publishedAt')).toBeUndefined();
  });

  it('활성 소검사 null이면 비활성으로 바꾼다', async () => {
    await applyPublished(pub());
    await applyPublished(pub({ publishedAt: '2026-10-06T10:00:00.000Z', activeSubtestId: null }));
    expect(await getActiveSubtestId()).toBeFalsy();
  });
});

describe('compareWithPublished', () => {
  it('수정 시각으로 배포본과 비교', () => {
    const p = pub();
    const at = (updatedAt: string) => makeSubtest({ id: 'st1', updatedAt });
    expect(compareWithPublished(at('2026-10-05T09:00:00.000Z'), p)).toBe('same');
    expect(compareWithPublished(at('2026-10-05T11:00:00.000Z'), p)).toBe('local_newer');
    expect(compareWithPublished(at('2026-10-05T08:00:00.000Z'), p)).toBe('published_newer');
    expect(compareWithPublished(makeSubtest({ id: 'other' }), p)).toBe('not_published');
  });
});

describe('githubUploadUrl', () => {
  it('GitHub Pages 주소에서 저장소 업로드 페이지를 만든다', () => {
    vi.stubEnv('BASE_URL', '/pisa-validator/');
    expect(githubUploadUrl({ hostname: 'blink-24.github.io' })).toBe(
      'https://github.com/blink-24/pisa-validator/upload/main/public/content',
    );
    expect(githubUploadUrl({ hostname: 'localhost' })).toBeNull();
    vi.unstubAllEnvs();
  });
});
