// 백업 경고 배너 + 저장 상태 (Req 14.1-14.5).

import { useEffect, useState } from 'react';
import {
  detectStorageStatus,
  daysSinceBackup,
  getLastBackupAt,
  formatBytes,
  requestPersistence,
  type StorageStatus,
} from '../../data/storage';
import { exportFullBackup, downloadJson, markBackupNow } from '../../data/transfer';

export function BackupBanner({ onChanged }: { onChanged?: () => void }) {
  const [status, setStatus] = useState<StorageStatus | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [days, setDays] = useState<number | null>(null);

  async function refresh() {
    setStatus(await detectStorageStatus());
    setLastBackup(await getLastBackupAt());
    setDays(await daysSinceBackup());
  }

  useEffect(() => {
    // 첫 실행 시 지속성 요청 (Req 14.1)
    requestPersistence().then(refresh);
  }, []);

  async function doBackup() {
    const backup = await exportFullBackup();
    downloadJson(backup, `pisa-전체백업-${new Date().toISOString().slice(0, 10)}.json`);
    await markBackupNow();
    await refresh();
    onChanged?.();
  }

  const backupStale = days == null || days >= 7;
  const quotaHigh = status != null && status.usageRatio > 0.8;

  return (
    <div className="backup-banner">
      <div className="backup-row">
        <div>
          <strong>저장 상태</strong>
          <div className="muted text-sm">
            {status ? (
              <>
                지속성 {status.persisted ? '허용됨' : '미허용'} · 사용량{' '}
                {formatBytes(status.usageBytes)} / {formatBytes(status.quotaBytes)} (
                {Math.round(status.usageRatio * 100)}%)
              </>
            ) : (
              '확인 중...'
            )}
          </div>
          <div className="muted text-sm">
            마지막 전체 백업:{' '}
            {lastBackup ? new Date(lastBackup).toLocaleString('ko-KR') : '기록 없음'}
          </div>
        </div>
        <button className="btn btn-primary" onClick={doBackup}>
          전체 백업
        </button>
      </div>

      {backupStale && (
        <p className="notice notice-warn mt-sm" role="status">
          마지막 전체 백업이 7일 이상 지났거나 없습니다. 데이터 보호를 위해 백업을 권장합니다.
        </p>
      )}
      {quotaHigh && (
        <p className="notice notice-danger mt-sm" role="alert">
          저장 용량 사용률이 80%를 넘었습니다. 불필요한 소검사·결과를 정리하거나 백업 후 삭제하세요.
        </p>
      )}
      {status && !status.indexedDbSupported && (
        <p className="notice notice-danger mt-sm" role="alert">
          이 브라우저는 IndexedDB를 지원하지 않아 데이터가 보존되지 않습니다.
        </p>
      )}
      {status?.likelyPrivate && (
        <p className="notice notice-warn mt-sm" role="status">
          시크릿(비공개) 모드로 보입니다. 창을 닫으면 데이터가 사라질 수 있습니다.
        </p>
      )}
    </div>
  );
}
