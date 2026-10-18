// 보호 지문 불러오기 (Req 3.9). 같은 출처의 정적 파일 public/content/protected.json만 읽는다.
// 파일이 없거나 형식이 틀리면 보호 지문은 모두 잠금 안내로 보인다(응시는 계속 가능).

import {
  DEFAULT_MARKERS,
  unlockAll,
  validateProtected,
  type ProtectedFile,
} from '../core/protectedText';

export const PROTECTED_PATH = 'content/protected.json';

let filePromise: Promise<ProtectedFile | null> | null = null;

export function fetchProtected(): Promise<ProtectedFile | null> {
  if (!filePromise) {
    filePromise = (async () => {
      try {
        const res = await fetch(`${import.meta.env.BASE_URL}${PROTECTED_PATH}`, {
          cache: 'no-cache',
        });
        if (!res.ok) return null;
        return validateProtected(await res.json());
      } catch {
        return null;
      }
    })();
  }
  return filePromise;
}

export interface ProtectedState {
  markers: string[];
  unlocked: Map<string, string>;
}

/** 응시 코드로 보호 지문을 풀어 본다. 실패해도 예외 없이 빈 결과. */
export async function unlockForCode(code: string): Promise<ProtectedState> {
  const file = await fetchProtected();
  if (!file) return { markers: [...DEFAULT_MARKERS], unlocked: new Map() };
  const markers = [...new Set([...DEFAULT_MARKERS, ...file.entries.map((e) => e.marker)])];
  return { markers, unlocked: await unlockAll(file, code.trim()) };
}
