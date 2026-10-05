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
      <section className="empty-state">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
        <h2>지금은 응시할 수 있는 검사가 없습니다</h2>
        <p className="muted">
          선생님이 검사를 열면 이 화면에서 바로 시작할 수 있습니다. 잠시 기다리거나 선생님께 알려
          주세요.
        </p>
      </section>
    );
  }

  return (
    <section>
      <header className="page-head">
        <p className="eyebrow">오늘의 검사</p>
        <h2>{subtest.title}</h2>
        {subtest.description && <p className="lead">{subtest.description}</p>}
        {subtest.target && (
          <ul className="meta-list" aria-label="검사 정보">
            <li className="chip">
              대상 <strong>{subtest.target}</strong>
            </li>
          </ul>
        )}
      </header>

      <div className="start-layout">
        <div className="sheet start-panel stack">
          <div>
            <h3>{started ? '응시 코드를 입력하세요' : '준비되면 시작하세요'}</h3>
            <p className="muted text-sm flush">
              {started
                ? '선생님이 알려 준 익명 코드를 입력합니다.'
                : '응답은 자동으로 저장되며, 끝까지 마치면 결과를 바로 확인할 수 있습니다.'}
            </p>
          </div>

          {storage && (!storage.indexedDbSupported || storage.likelyPrivate) && (
            <p className="notice notice-warn">
              {!storage.indexedDbSupported
                ? '이 브라우저는 데이터 저장을 지원하지 않습니다. 결과가 보존되지 않을 수 있습니다.'
                : '시크릿(비공개) 모드로 보입니다. 창을 닫으면 응시 기록이 사라질 수 있습니다.'}
            </p>
          )}

          {!started ? (
            <div>
              <button className="btn btn-primary btn-lg" onClick={() => setStarted(true)}>
                응시 시작
              </button>
            </div>
          ) : (
            <AnonCodeForm onSubmit={begin} />
          )}
        </div>

        <aside className="sheet" aria-label="응시 순서">
          <h3>응시 순서</h3>
          <ol className="steps">
            <li>
              <div>
                익명 코드 입력<span>실명이나 학번은 쓰지 않습니다.</span>
              </div>
            </li>
            <li>
              <div>
                상황 읽기<span>각 단위마다 어떤 상황인지 먼저 안내합니다.</span>
              </div>
            </li>
            <li>
              <div>
                지문 읽고 답하기<span>왼쪽 지문을 보며 오른쪽 문항에 답합니다.</span>
              </div>
            </li>
            <li>
              <div>
                제출과 결과 확인<span>결과는 한 번만 볼 수 있습니다.</span>
              </div>
            </li>
          </ol>
        </aside>
      </div>

      {resumable && (
        <ConfirmDialog
          title="이어서 응시"
          message={
            '같은 코드로 진행 중인 응시가 있습니다.\n이어서 응시할까요? (아니오를 누르면 새로 시작합니다.)'
          }
          confirmLabel="이어서"
          cancelLabel="새로 시작"
          onConfirm={() => resume(true)}
          onCancel={() => resume(false)}
        />
      )}
    </section>
  );
}
