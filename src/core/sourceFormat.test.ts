import { describe, it, expect } from 'vitest';
import { formatSource } from './sourceFormat';

describe('formatSource', () => {
  it("쪽수(숫자 범위)에는 '쪽'을 붙인다", () => {
    expect(
      formatSource({
        author: '김이환',
        work: '「친절한 존」, 『오늘의 SF 1호』',
        publisher: '아르테',
        year: '2019',
        pages: '75-77',
      }),
    ).toBe('김이환, 「친절한 존」, 『오늘의 SF 1호』, 아르테, 2019, 75-77쪽');
    expect(formatSource({ pages: '12' })).toBe('12쪽');
    expect(formatSource({ pages: '75 ~ 77' })).toBe('75 ~ 77쪽');
  });

  it("쪽수가 아닌 값에는 '쪽'을 붙이지 않는다", () => {
    expect(formatSource({ work: '기사', pages: '가상' })).toBe('기사, 가상');
  });

  it('비고가 있으면 끝에 " (비고: …)"', () => {
    expect(
      formatSource({ author: '학습용 가상 기사', year: '2026', note: '교사 발언은 가상' }),
    ).toBe('학습용 가상 기사, 2026 (비고: 교사 발언은 가상)');
  });

  it('출처가 모두 비어 있으면 빈 문자열 (비고만 있어도 출처로 보지 않는다)', () => {
    expect(formatSource({})).toBe('');
    expect(formatSource(undefined)).toBe('');
    expect(formatSource({ author: '  ', pages: '' })).toBe('');
    expect(formatSource({ note: '비고만' })).toBe('');
  });
});
