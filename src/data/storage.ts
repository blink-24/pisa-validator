// 저장 지속성·용량·시크릿 모드 감지 (Task 2.4, Req 14.1/14.4/14.5).

import { getMeta, setMeta } from './db';

export interface StorageStatus {
  persisted: boolean;
  usageBytes: number;
  quotaBytes: number;
  usageRatio: number; // 0~1
  indexedDbSupported: boolean;
  likelyPrivate: boolean; // 시크릿 모드 추정
}

/** navigator.storage.persist() 요청 (Req 14.1). 지원 안 하면 false. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage && 'persist' in navigator.storage) {
      const already = await navigator.storage.persisted();
      const granted = already || (await navigator.storage.persist());
      await setMeta('persisted', granted ? '1' : '0');
      return granted;
    }
  } catch {
    /* ignore */
  }
  return false;
}

async function estimate(): Promise<{ usage: number; quota: number }> {
  try {
    if (navigator.storage && 'estimate' in navigator.storage) {
      const e = await navigator.storage.estimate();
      return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
    }
  } catch {
    /* ignore */
  }
  return { usage: 0, quota: 0 };
}

function indexedDbSupported(): boolean {
  return typeof indexedDB !== 'undefined';
}

/**
 * 시크릿 모드 추정: IndexedDB를 열어 쓰고 지우는 방식은 번거로우므로
 * quota가 비정상적으로 작거나(≈<120MB) persisted 거부 + estimate 실패를 신호로 삼는다.
 * 완벽하지 않음(브라우저별 차이) — 경고용 휴리스틱.
 */
export async function detectStorageStatus(): Promise<StorageStatus> {
  const supported = indexedDbSupported();
  const persistedMeta = await getMeta('persisted');
  const { usage, quota } = await estimate();
  const ratio = quota > 0 ? usage / quota : 0;
  const likelyPrivate = supported && quota > 0 && quota < 120 * 1024 * 1024;
  return {
    persisted: persistedMeta === '1',
    usageBytes: usage,
    quotaBytes: quota,
    usageRatio: ratio,
    indexedDbSupported: supported,
    likelyPrivate,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

/** 마지막 백업 이후 경과일. 백업 기록 없으면 null. */
export async function daysSinceBackup(): Promise<number | null> {
  const last = await getMeta('lastBackupAt');
  if (!last) return null;
  const diff = Date.now() - new Date(last).getTime();
  return diff / (1000 * 60 * 60 * 24);
}

export async function getLastBackupAt(): Promise<string | null> {
  return (await getMeta('lastBackupAt')) ?? null;
}
