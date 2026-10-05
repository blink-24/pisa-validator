// 이미지 자산 저장/조회 + base64 직렬화 (Task 2.3: 내보내기에 이미지 포함).

import { db } from './db';
import { uid } from '../core/ids';
import type { Asset } from '../types';

/** Blob → data URL (base64). 내보내기 직렬화용. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(blob);
  });
}

/** data URL → Blob. 가져오기 역직렬화용. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, b64] = dataUrl.split(',');
  const mimeMatch = /data:([^;]+);base64/.exec(header ?? '');
  const mime = mimeMatch?.[1] ?? 'application/octet-stream';
  const bin = atob(b64 ?? '');
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

/** 파일 입력에서 받은 이미지를 자산으로 저장하고 id 반환. */
export async function saveImageFile(file: File): Promise<string> {
  const id = uid('img');
  const asset: Asset = { id, blob: file, mime: file.type || 'image/png', name: file.name };
  await db.assets.put(asset);
  return id;
}

/** 자산 id → 미리보기용 Object URL. 사용 후 revoke 책임은 호출자. */
export async function assetObjectUrl(id: string): Promise<string | null> {
  const a = await db.assets.get(id);
  if (!a) return null;
  return URL.createObjectURL(a.blob);
}

export interface SerializedAsset {
  id: string;
  mime: string;
  name: string;
  dataUrl: string;
}

export async function serializeAssets(ids: string[]): Promise<SerializedAsset[]> {
  const out: SerializedAsset[] = [];
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const a = await db.assets.get(id);
    if (!a) continue;
    out.push({ id: a.id, mime: a.mime, name: a.name, dataUrl: await blobToDataUrl(a.blob) });
  }
  return out;
}

export async function restoreAssets(serialized: SerializedAsset[], idMap?: Map<string, string>): Promise<void> {
  for (const s of serialized) {
    const newId = idMap?.get(s.id) ?? s.id;
    await db.assets.put({ id: newId, blob: dataUrlToBlob(s.dataUrl), mime: s.mime, name: s.name });
  }
}
