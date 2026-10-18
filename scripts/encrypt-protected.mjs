// 보호 지문 암호화 (Req 3.9). public/content/protected.json을 만든다.
//
// 사용법 (원문 파일은 커밋하지 말 것 — .gitignore의 *.local.html):
//   PROTECTED_CODE='<허용할 응시 코드>' node scripts/encrypt-protected.mjs "{소설 원문}" 원문.local.html
//   → public/content/protected.json 의 같은 marker 항목을 새 암호문으로 바꾸거나 추가한다.
//
// 코드는 명령행 인자가 아니라 환경변수로 받는다(셸 기록·프로세스 목록 노출 줄이기).
// 알고리즘은 src/core/protectedText.ts와 같다: PBKDF2-SHA256(600000회) → AES-GCM-256.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { webcrypto as crypto } from 'node:crypto';

const ITER = 600_000;
const OUT = 'public/content/protected.json';

const [marker, srcPath] = process.argv.slice(2);
const code = process.env.PROTECTED_CODE;
if (!marker || !srcPath || !code) {
  console.error(
    '사용법: PROTECTED_CODE=<코드> node scripts/encrypt-protected.mjs "<자리표시>" <원문.local.html>',
  );
  process.exit(1);
}

const b64 = (u8) => Buffer.from(u8).toString('base64');
const plaintext = readFileSync(srcPath, 'utf-8').trim();
const salt = crypto.getRandomValues(new Uint8Array(16));
const iv = crypto.getRandomValues(new Uint8Array(12));
const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(code), 'PBKDF2', false, [
  'deriveKey',
]);
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITER },
  base,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
);
const ct = new Uint8Array(
  await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext)),
);

const file = existsSync(OUT)
  ? JSON.parse(readFileSync(OUT, 'utf-8'))
  : { format: 'pisa-validator', kind: 'protected', version: 1, entries: [] };
const entry = { marker, salt: b64(salt), iv: b64(iv), iter: ITER, ct: b64(ct) };
file.entries = [...file.entries.filter((e) => e.marker !== marker), entry];
writeFileSync(OUT, JSON.stringify(file, null, 2) + '\n');
console.log(`${OUT}: '${marker}' 항목 갱신 (원문 ${plaintext.length}자)`);
