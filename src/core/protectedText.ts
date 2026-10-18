// 보호 지문 (Req 3.9). 저작권 지문을 암호문으로만 배포하고, 응시 코드가 맞는 사용자만 복호화해 본다.
//
// 동작: 지문 본문에 자리표시(marker, 예: "{소설 원문}")를 두고, 원문은 public/content/protected.json에
//       AES-GCM 암호문으로 둔다. 키는 응시 코드에서 PBKDF2-SHA256으로 만든다. 허용된 코드는
//       어디에도 평문으로 저장하지 않는다 — 복호화에 성공하는 것이 곧 허용 여부다.
// 한계: 정적 사이트의 클라이언트 측 보호다. 암호문은 공개되므로, 보호 강도는 그 코드를
//       남이 짐작하기 어려운 정도와 같다. 코드를 아는 사람은 누구나 원문을 볼 수 있다.

export const PROTECTED_FORMAT = 'pisa-validator';
export const DEFAULT_ITERATIONS = 600_000;
/** protected.json을 못 읽어도 잠금 안내로 바꿀 기본 자리표시 */
export const DEFAULT_MARKERS = ['{소설 원문}'];
export const LOCKED_NOTICE_HTML =
  '<p class="muted">🔒 이 지문은 권한이 있는 응시 코드로 접속한 경우에만 표시됩니다.</p>';

export interface ProtectedEntry {
  /** 지문 본문에서 바꿔 넣을 자리표시 문자열 */
  marker: string;
  /** base64 */
  salt: string;
  /** base64 (AES-GCM 12바이트) */
  iv: string;
  iter: number;
  /** base64 암호문(GCM 태그 포함) */
  ct: string;
}

export interface ProtectedFile {
  format: typeof PROTECTED_FORMAT;
  kind: 'protected';
  version: 1;
  entries: ProtectedEntry[];
}

function subtle(): SubtleCrypto {
  const c = globalThis.crypto;
  if (!c?.subtle) throw new Error('이 브라우저는 Web Crypto를 지원하지 않습니다.');
  return c.subtle;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
  iter: number,
): Promise<CryptoKey> {
  const base = await subtle().importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: iter },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** 원문(HTML)을 암호화한다. 배포본 갱신 스크립트와 테스트에서 쓴다. */
export async function encryptText(
  marker: string,
  plaintextHtml: string,
  password: string,
  iter: number = DEFAULT_ITERATIONS,
): Promise<ProtectedEntry> {
  const salt = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16)));
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const key = await deriveKey(password, salt, iter);
  const ct = new Uint8Array(
    await subtle().encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintextHtml)),
  );
  return { marker, salt: toB64(salt), iv: toB64(iv), iter, ct: toB64(ct) };
}

/** 복호화. 코드가 틀리면(GCM 인증 실패) null. */
export async function decryptEntry(
  entry: ProtectedEntry,
  password: string,
): Promise<string | null> {
  if (!password) return null;
  try {
    const key = await deriveKey(password, fromB64(entry.salt), entry.iter);
    const pt = await subtle().decrypt(
      { name: 'AES-GCM', iv: fromB64(entry.iv) },
      key,
      fromB64(entry.ct),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

/** 모든 항목 복호화 시도 → 성공한 것만 marker→원문 */
export async function unlockAll(
  file: ProtectedFile,
  password: string,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (const e of file.entries) {
    const html = await decryptEntry(e, password);
    if (html != null) out.set(e.marker, html);
  }
  return out;
}

/** 지문 본문의 자리표시를 원문(풀린 경우) 또는 잠금 안내로 바꾼다. 자리표시가 없으면 그대로. */
export function applyProtected(
  bodyHtml: string,
  markers: string[],
  unlocked: Map<string, string>,
): string {
  let html = bodyHtml;
  for (const m of markers) {
    if (!html.includes(m)) continue;
    const replacement = unlocked.get(m);
    if (replacement != null) {
      // 자리표시를 감싼 <p> 안에 블록 원문을 넣지 않도록 <p>{marker}</p> 전체를 먼저 바꾼다.
      html = html.split(`<p>${m}</p>`).join(replacement).split(m).join(replacement);
    } else {
      html = html.split(`<p>${m}</p>`).join(LOCKED_NOTICE_HTML).split(m).join(LOCKED_NOTICE_HTML);
    }
  }
  return html;
}

export function validateProtected(data: unknown): ProtectedFile {
  const d = data as Partial<ProtectedFile> | null;
  if (!d || typeof d !== 'object') throw new Error('protected: 객체가 아닙니다.');
  if (d.format !== PROTECTED_FORMAT)
    throw new Error("protected.format: 'pisa-validator'이어야 합니다.");
  if (d.kind !== 'protected') throw new Error("protected.kind: 'protected'이어야 합니다.");
  if (!Array.isArray(d.entries)) throw new Error('protected.entries: 배열이어야 합니다.');
  d.entries.forEach((e, i) => {
    for (const k of ['marker', 'salt', 'iv', 'ct'] as const) {
      if (typeof e?.[k] !== 'string' || !e[k])
        throw new Error(`protected.entries[${i}].${k}: 문자열이어야 합니다.`);
    }
    if (typeof e.iter !== 'number' || e.iter < 100_000) {
      throw new Error(`protected.entries[${i}].iter: 100000 이상이어야 합니다.`);
    }
  });
  return { format: PROTECTED_FORMAT, kind: 'protected', version: 1, entries: d.entries };
}
