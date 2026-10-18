// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  applyProtected,
  decryptEntry,
  encryptText,
  LOCKED_NOTICE_HTML,
  unlockAll,
  validateProtected,
} from './protectedText';

const M = '{소설 원문}';
const ITER = 100_000; // 테스트 속도용 (배포본은 600000)

describe('protectedText (Req 3.9)', () => {
  it('맞는 코드로만 복호화된다', async () => {
    const e = await encryptText(M, '<p>원문</p>', 'test-code-ok', ITER);
    expect(await decryptEntry(e, 'test-code-ok')).toBe('<p>원문</p>');
    expect(await decryptEntry(e, 'test-code-no')).toBeNull();
    expect(await decryptEntry(e, '')).toBeNull();
    // 대소문자·공백도 다른 코드로 취급
    expect(await decryptEntry(e, 'TEST-CODE-OK')).toBeNull();
  });

  it('암호문에 원문과 코드가 평문으로 남지 않는다', async () => {
    const e = await encryptText(M, '<p>비밀 원문 문장</p>', 'test-code-ok', ITER);
    const json = JSON.stringify(e);
    expect(json).not.toContain('비밀');
    expect(json).not.toContain('test-code-ok');
  });

  it('자리표시를 원문 또는 잠금 안내로 바꾼다', async () => {
    const e = await encryptText(M, '<p>원문</p>', 'test-code-ok', ITER);
    const file = validateProtected({
      format: 'pisa-validator',
      kind: 'protected',
      version: 1,
      entries: [e],
    });
    const ok = await unlockAll(file, 'test-code-ok');
    expect(applyProtected(`<p>${M}</p>`, [M], ok)).toBe('<p>원문</p>');
    const no = await unlockAll(file, 'someone');
    expect(applyProtected(`<p>${M}</p>`, [M], no)).toBe(LOCKED_NOTICE_HTML);
    expect(applyProtected('<p>다른 지문</p>', [M], no)).toBe('<p>다른 지문</p>');
  });

  it('형식 검증: 잘못된 파일은 거부', () => {
    expect(() => validateProtected({ format: 'x' })).toThrow();
    expect(() =>
      validateProtected({
        format: 'pisa-validator',
        kind: 'protected',
        version: 1,
        entries: [{ marker: M }],
      }),
    ).toThrow();
  });

  it('저장소의 public/content/protected.json은 형식이 맞고 원문 평문이 없다', () => {
    const raw = JSON.parse(readFileSync('public/content/protected.json', 'utf-8'));
    const file = validateProtected(raw);
    expect(file.entries.length).toBeGreaterThan(0);
    for (const e of file.entries) expect(e.iter).toBeGreaterThanOrEqual(600_000);
    const text = readFileSync('public/content/protected.json', 'utf-8');
    expect(text).not.toMatch(/[가-힣]{6,}/); // 자리표시 외의 긴 한글(원문)이 없어야 함
  });
});
