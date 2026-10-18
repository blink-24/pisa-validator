// 지문 출처 문자열 (학생 화면 '출처:'와 보고서 Ⅶ이 같은 규칙을 쓴다). 순수 함수.

import type { PassageSource } from '../types';

/** 쪽수로 볼 수 있는 값: 숫자 또는 숫자 범위(75-77, 75–77, 75~77) */
const PAGES_RE = /^\d+(\s*[-–~]\s*\d+)?$/;

/**
 * "저자, 작품명, 발행처, 연도, 쪽" 순으로 잇는다.
 * - pages는 숫자·숫자 범위일 때만 '쪽'을 붙이고, 그 밖의 값은 그대로 쓴다.
 * - note(비고)가 있으면 끝에 " (비고: …)"를 붙인다.
 * - 출처 항목(저자~쪽)이 모두 비어 있으면 빈 문자열. 비고만으로는 출처로 보지 않는다
 *   (정합성 점검의 '출처 정보 기재'와 같은 기준). 빈 값 처리는 호출하는 쪽이 정한다.
 */
export function formatSource(source: PassageSource | undefined): string {
  const s = source ?? {};
  const pages = s.pages?.trim() ?? '';
  const parts = [
    s.author?.trim(),
    s.work?.trim(),
    s.publisher?.trim(),
    s.year?.trim(),
    pages && PAGES_RE.test(pages) ? `${pages}쪽` : pages,
  ].filter(Boolean);
  if (parts.length === 0) return '';
  const note = s.note?.trim();
  return parts.join(', ') + (note ? ` (비고: ${note})` : '');
}
