// 배포본: 관리자가 설정한 시험 정보(소검사·지문·문항·활성 소검사)를 모든 사용자에게 공유한다.
// 저장 위치는 저장소의 public/content/published.json — GitHub Pages가 앱과 같은 출처에서 제공하는 정적 파일.
// 학생 응답(세션)은 포함하지 않는다. 응답은 지금처럼 각 기기 브라우저에만 남는다.
//
// 흐름: 관리자 '배포' 탭에서 published.json 내려받기 → 저장소 public/content/에 올려 커밋
//       → GitHub Actions가 다시 배포 → 각 기기가 앱을 열 때 syncPublishedContent()로 반영.

import { db, getMeta, setMeta } from './db';
import { setActiveSubtestId } from './active';
import {
  FORMAT,
  exportSubtest,
  importOverwrite,
  validateSubtestExport,
  type SubtestExport,
} from './transfer';
import type { Subtest } from '../types';

/** BASE_URL 기준 상대 경로 (저장소의 public/content/published.json) */
export const PUBLISHED_PATH = 'content/published.json';
export const PUBLISHED_FILENAME = 'published.json';

export interface PublishedContent {
  format: typeof FORMAT;
  kind: 'published';
  version: 1;
  /** 배포 시각(ISO). 빈 문자열이면 아직 배포한 적 없음 → 아무것도 바꾸지 않는다. */
  publishedAt: string;
  /** 학생 화면에 열 소검사. null이면 비활성(응시 불가). */
  activeSubtestId: string | null;
  subtests: SubtestExport[];
}

function fail(path: string, msg: string): never {
  throw new Error(`배포 파일 오류: ${path} ${msg}`);
}

export function validatePublished(data: unknown): PublishedContent {
  if (!data || typeof data !== 'object') fail('(root)', '객체가 아닙니다.');
  const d = data as Record<string, unknown>;
  if (d.format !== FORMAT) fail('format', `'${FORMAT}'이어야 합니다.`);
  if (d.kind !== 'published') fail('kind', "'published'이어야 합니다.");
  if (typeof d.publishedAt !== 'string') fail('publishedAt', '문자열이어야 합니다.');
  if (d.activeSubtestId !== null && typeof d.activeSubtestId !== 'string') {
    fail('activeSubtestId', '문자열 또는 null이어야 합니다.');
  }
  if (!Array.isArray(d.subtests)) fail('subtests', '배열이어야 합니다.');
  const subtests = d.subtests.map((s, i) => {
    try {
      return validateSubtestExport(s);
    } catch (e) {
      fail(`subtests[${i}]`, e instanceof Error ? e.message : String(e));
    }
  });
  const ids = subtests.map((s) => s.subtest.id);
  if (new Set(ids).size !== ids.length) fail('subtests', '같은 ID의 소검사가 두 번 들어 있습니다.');
  const active = (d.activeSubtestId as string | null) || null;
  if (active && !ids.includes(active))
    fail('activeSubtestId', `'${active}'가 subtests에 없습니다.`);
  return {
    format: FORMAT,
    kind: 'published',
    version: 1,
    publishedAt: d.publishedAt,
    activeSubtestId: active,
    subtests,
  };
}

/** 관리자가 고른 소검사로 배포 파일 내용을 만든다. 수정 시각은 그대로 보존된다. */
export async function buildPublished(
  subtestIds: string[],
  activeSubtestId: string | null,
): Promise<PublishedContent> {
  if (activeSubtestId && !subtestIds.includes(activeSubtestId)) {
    throw new Error('학생에게 열 소검사는 배포 대상에 포함되어야 합니다.');
  }
  const subtests: SubtestExport[] = [];
  for (const id of subtestIds) subtests.push(await exportSubtest(id));
  return {
    format: FORMAT,
    kind: 'published',
    version: 1,
    publishedAt: new Date().toISOString(),
    activeSubtestId,
    subtests,
  };
}

/** 사이트에 올라가 있는 배포본을 읽는다. 없거나(개발 서버·오프라인) 형식이 틀리면 null. */
export async function fetchPublished(): Promise<PublishedContent | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${PUBLISHED_PATH}`, { cache: 'no-cache' });
    if (!res.ok) return null;
    return validatePublished(await res.json());
  } catch {
    return null;
  }
}

export interface SyncResult {
  status: 'applied' | 'unchanged' | 'empty' | 'unavailable';
  /** 배포본으로 교체(또는 새로 추가)한 소검사 ID */
  updated: string[];
  /** 이 기기에서 배포 이후 수정한 기록이 있어 덮어쓰지 않은 소검사 ID (관리자 기기) */
  keptLocal: string[];
}

/**
 * 배포본을 이 기기의 IndexedDB에 반영한다.
 * - 이미 반영한 배포본(같은 publishedAt)이면 아무것도 하지 않는다.
 * - 소검사별로 이 기기의 수정 시각이 배포본보다 늦으면(관리자가 배포 후 더 고친 경우) 덮어쓰지 않는다.
 * - 활성 소검사는 배포본을 따른다.
 * - 학생 응답(세션)은 건드리지 않는다.
 */
export async function applyPublished(pub: PublishedContent): Promise<SyncResult> {
  const result: SyncResult = { status: 'unchanged', updated: [], keptLocal: [] };
  if (!pub.publishedAt) return { ...result, status: 'empty' };
  if ((await getMeta('publishedAt')) === pub.publishedAt) return result;

  for (const exp of pub.subtests) {
    const local = await db.subtests.get(exp.subtest.id);
    if (local && local.updatedAt > exp.subtest.updatedAt) {
      result.keptLocal.push(exp.subtest.id);
      continue;
    }
    if (local && local.updatedAt === exp.subtest.updatedAt) continue; // 이미 같은 내용
    await importOverwrite(exp, { preserveUpdatedAt: true });
    result.updated.push(exp.subtest.id);
  }

  const active = pub.activeSubtestId;
  await setActiveSubtestId(active && (await db.subtests.get(active)) ? active : null);
  await setMeta('publishedAt', pub.publishedAt);
  return { ...result, status: 'applied' };
}

let inFlight: Promise<SyncResult> | null = null;

/** 앱 시작 시 1회 호출. 동시에 여러 번 불려도(StrictMode 등) 한 번만 실행된다. */
export function syncPublishedContent(): Promise<SyncResult> {
  if (!inFlight) {
    inFlight = (async () => {
      const pub = await fetchPublished();
      if (!pub) return { status: 'unavailable', updated: [], keptLocal: [] } as SyncResult;
      try {
        return await applyPublished(pub);
      } catch {
        // 반영 실패 시에도 이 기기의 기존 데이터로 계속 동작한다.
        return { status: 'unavailable', updated: [], keptLocal: [] } as SyncResult;
      }
    })();
  }
  return inFlight;
}

export type PublishState = 'same' | 'local_newer' | 'published_newer' | 'not_published';

/** 이 기기의 소검사와 배포본 비교 (관리자 '배포' 탭 표시용) */
export function compareWithPublished(local: Subtest, pub: PublishedContent | null): PublishState {
  const p = pub?.subtests.find((s) => s.subtest.id === local.id);
  if (!p) return 'not_published';
  if (local.updatedAt === p.subtest.updatedAt) return 'same';
  return local.updatedAt > p.subtest.updatedAt ? 'local_newer' : 'published_newer';
}

/**
 * GitHub Pages(https://<owner>.github.io/<repo>/)에서 실행 중이면
 * 배포 파일을 올릴 저장소 업로드 페이지 주소를 돌려준다. 그 외 환경은 null.
 */
export function githubUploadUrl(loc: { hostname: string } = window.location): string | null {
  const m = /^([a-z0-9-]+)\.github\.io$/i.exec(loc.hostname);
  const repo = import.meta.env.BASE_URL.replace(/^\/|\/$/g, '');
  if (!m || !repo) return null;
  return `https://github.com/${m[1]}/${repo}/upload/main/public/content`;
}
