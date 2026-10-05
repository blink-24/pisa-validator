// 사용자 안내 화면 (Req 10.1-10.2). 활성 소검사 안내 + 익명 코드 입력 → 응시 시작.

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { getActiveSubtest } from '../../data/active';
import { detectStorageStatus } from '../../data/storage';
import { AnonCodeForm } from './AnonCodeForm';
import { findResumableSession, createSession } from '../../data/sessionEngine';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import type { Session } from '../../types';

export function IntroScreen() {
  const navigate = useNavigate();
  const { data: subtest, loading } = useAsync(() => getActiveSubtest(), []);
  const { data: storage } = useAsync(() => detectStorageStatus(), []);
  const [started, setStarted] = useState(false);
  const [resumable, setResumable] = useState<Session | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);

  async function begin(code: string) {
    if (!subtest) return;
    const existing = await findResumableSession(subtest.id, code);
    if (existing) {
      setPendingCode(code);
      setResumable(existing);
      return;
    }
    const s = await createSession(subtest.id, code);
    navigate(`/test?sid=${s.id}`);
  }

  async function resume(doResume: boolean) {
    if (!subtest || !pendingCode) return;
    if (doResume && resumable) {
      navigate(`/test?sid=${resumable.id}`);
    } else {
      const s = await createSession(subtest.id, pendingCode);
      navigate(`/test?sid=${s.id}`);
    }
    setResumable(null);
    setPendingCode(null);
  }

  if (loading) return <p className="muted">불러오는 중...</p>;

  if (!subtest) {
    return (
      <section>
        <h2>안내</h2>
        <p className="notice notice-warn">현재 응시 가능한 소검사가 없습니다.</p>
        <p className="muted">관리자가 소검사를 활성화하면 이곳에서 응시를 시작할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <section>
      <h2>{subtest.title}</h2>
      {subtest.description && <p>{subtest.description}</p>}
      <p className="muted">대상: {subtest.target}</p>

      {storage && (!storage.indexedDbSupported || storage.likelyPrivate) && (
        <p className="notice notice-warn">
          {!storage.indexedDbSupported
            ? '이 브라우저는 데이터 저장을 지원하지 않습니다. 결과가 보존되지 않을 수 있습니다.'
            : '시크릿(비공개) 모드로 보입니다. 창을 닫으면 응시 기록이 사라질 수 있습니다.'}
        </p>
      )}

      {!started ? (
        <button className="btn btn-primary" onClick={() => setStarted(true)}>
          응시 시작
        </button>
      ) : (
        <AnonCodeForm onSubmit={begin} />
      )}

      {resumable && (
        <ConfirmDialog
          title="이어서 응시"
          message={'같은 코드로 진행 중인 응시가 있습니다.\n이어서 응시할까요? (아니오를 누르면 새로 시작합니다.)'}
          confirmLabel="이어서"
          cancelLabel="새로 시작"
          onConfirm={() => resume(true)}
          onCancel={() => resume(false)}
        />
      )}
    </section>
  );
}
