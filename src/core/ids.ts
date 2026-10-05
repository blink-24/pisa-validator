// ID 생성·파싱 유틸. 문항 ID: CR{unit:3}Q{item:2} (structure steering).

/** 범용 고유 ID (레코드 PK용) */
export function uid(prefix = ''): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36);
  return prefix ? `${prefix}_${rand}` : rand;
}

/** 문항 ID 조합: CR901Q03 */
export function makeItemId(unitNo: number, itemNo: number): string {
  const u = String(unitNo).padStart(3, '0');
  const q = String(itemNo).padStart(2, '0');
  return `CR${u}Q${q}`;
}

const ITEM_ID_RE = /^CR(\d{3})Q(\d{2})$/;

export function parseItemId(id: string): { unitNo: number; itemNo: number } | null {
  const m = ITEM_ID_RE.exec(id);
  if (!m) return null;
  return { unitNo: Number(m[1]), itemNo: Number(m[2]) };
}

export function isValidItemId(id: string): boolean {
  return ITEM_ID_RE.test(id);
}

/** 결정적 시드 난수 (mulberry32). routing의 확률형 재현성에 사용 */
export function seedFromString(s: string): number {
  let h = 1779033703 ^ s.length;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^= h >>> 16) >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
