// 응시 화면 (Task 8, Req 10). 단계 진행·시나리오·분할 화면·시간 기록·제출.

import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db, loadBundle, type SubtestBundle } from '../../data/db';
import {
  markStageCompleted,
  nextStagePlan,
  recordResponse,
  saveSession,
  submitSession,
  unansweredCount,
  type StagePlan,
} from '../../data/sessionEngine';
import { ScenarioIntro } from './ScenarioIntro';
import { PassageView } from './PassageView';
import { ItemPlayer } from './ItemPlayer';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { stageLabel, blockLabel } from '../../data/taxonomy';
import type { Session, Item, Unit } from '../../types';

type Phase = 'loading' | 'scenario' | 'answering' | 'error';

export function TestScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sid = params.get('sid') ?? '';

  const [bundle, setBundle] = useState<SubtestBundle | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [plan, setPlan] = useState<StagePlan | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [unitCursor, setUnitCursor] = useState(0); // 현재 단계의 단위 인덱스
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const enterTime = useRef<number>(Date.now());
  // 최신 세션을 항상 보관 — 빠른 연속 응답 시 state 클로저가 오래된 값을 쓰는 버그 방지.
  const sessionRef = useRef<Session | null>(null);
  const submittingRef = useRef(false);
  const [justSaved, setJustSaved] = useState(false);

  function applySession(s: Session) {
    sessionRef.current = s;
    setSession(s);
  }

  // '자동 저장됨' 표시를 잠시 뒤 숨김
  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1500);
    return () => clearTimeout(t);
  }, [justSaved]);

  // 응시 중 새로고침·창 닫기 경고 (실수로 인한 중단 방지). 제출 완료 시에는 경고 안 함.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      const s = sessionRef.current;
      if (s && !s.submittedAt && !submittingRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  // 초기 로드
  useEffect(() => {
    (async () => {
      const s = await db.sessions.get(sid);
      if (!s) {
        setPhase('error');
        return;
      }
      if (s.submittedAt) {
        navigate(`/result?sid=${s.id}`, { replace: true });
        return;
      }
      const b = await loadBundle(s.subtestId);
      if (!b) {
        setPhase('error');
        return;
      }
      setBundle(b);
      const { plan: p, session: s2 } = await nextStagePlan(b, s);
      applySession(s2);
      setPlan(p);
      setUnitCursor(0);
      setPhase(p ? 'scenario' : 'answering');
      if (!p) {
        // 응시할 문항이 없음 → 바로 제출 확인
        setConfirmSubmit(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sid]);

  // 현재 단계의 단위 목록(순서대로)
  const unitsInStage = useMemo<Unit[]>(() => {
    if (!bundle || !plan) return [];
    const unitIds: string[] = [];
    for (const it of plan.items) if (!unitIds.includes(it.unitId)) unitIds.push(it.unitId);
    return unitIds.map((id) => bundle.units.find((u) => u.id === id)).filter((u): u is Unit => !!u);
  }, [bundle, plan]);

  const currentUnit = unitsInStage[unitCursor] ?? null;
  const currentUnitItems = useMemo<Item[]>(
    () => (plan && currentUnit ? plan.items.filter((i) => i.unitId === currentUnit.id) : []),
    [plan, currentUnit],
  );

  function answerFor(itemId: string): unknown {
    return session?.responses.find((r) => r.itemId === itemId)?.answer;
  }

  async function onAnswer(item: Item, value: unknown) {
    const current = sessionRef.current;
    if (!current) return;
    const now = Date.now();
    const spent = now - enterTime.current;
    enterTime.current = now;
    const next = recordResponse(current, item, value, spent);
    applySession(next);
    await saveSession(next);
    setJustSaved(true);
  }

  async function advanceStage() {
    const before = sessionRef.current;
    if (!bundle || !before) return;
    // 건너뛴 문항이 있어도 현재 단계를 끝난 것으로 기록해야 다음 단계로 넘어간다.
    const current = plan ? markStageCompleted(before, plan.stage) : before;
    if (current !== before) await saveSession(current);
    const { plan: p, session: s2 } = await nextStagePlan(bundle, current);
    applySession(s2);
    setPlan(p);
    setUnitCursor(0);
    enterTime.current = Date.now();
    if (!p) {
      setConfirmSubmit(true);
      setPhase('answering');
    } else {
      setPhase('scenario');
    }
  }

  function nextUnit() {
    if (unitCursor < unitsInStage.length - 1) {
      setUnitCursor((c) => c + 1);
      setPhase('scenario');
      enterTime.current = Date.now();
    } else {
      // 단계의 마지막 단위 완료 → 다음 단계 결정
      advanceStage();
    }
  }

  async function doSubmit() {
    const current = sessionRef.current;
    if (!current) return;
    submittingRef.current = true; // beforeunload 경고 해제
    // 제출 직전 최신 응답을 반드시 저장(연속 입력 중 미저장분 방지).
    await saveSession(current);
    const finalized = await submitSession(current.subtestId, current.id);
    navigate(`/result?sid=${finalized.id}`, { replace: true });
  }

  if (phase === 'loading') return <p className="muted">불러오는 중...</p>;
  if (phase === 'error' || !bundle || !session) {
    return (
      <div>
        <p className="notice notice-danger">응시 세션을 찾을 수 없습니다.</p>
        <button className="btn" onClick={() => navigate('/')}>
          처음으로
        </button>
      </div>
    );
  }

  // 제출 확인만 남은 상태
  if (!plan) {
    return (
      <div className="submit-panel sheet stack">
        <div>
          <p className="eyebrow">마지막 단계</p>
          <h2>모든 문항에 대한 응시가 끝났습니다</h2>
          <p className="muted flush">제출하면 답을 고칠 수 없습니다. 준비되면 제출하세요.</p>
        </div>
        <div>
          <button className="btn btn-primary btn-lg" onClick={() => setConfirmSubmit(true)}>
            제출하기
          </button>
        </div>
        {confirmSubmit && (
          <SubmitDialog
            unanswered={unansweredCount(bundle, session)}
            onConfirm={doSubmit}
            onCancel={() => setConfirmSubmit(false)}
          />
        )}
      </div>
    );
  }

  const stageTitle =
    plan.stage === 'core'
      ? stageLabel('core')
      : `${stageLabel(plan.stage)} · ${blockLabel(plan.block)}`;

  if (phase === 'scenario' && currentUnit) {
    return (
      <ScenarioIntro
        stageTitle={stageTitle}
        unit={currentUnit}
        onContinue={() => {
          setPhase('answering');
          enterTime.current = Date.now();
        }}
      />
    );
  }

  if (!currentUnit) {
    return (
      <div className="submit-panel stack">
        <p className="notice">이 단계에는 문항이 없습니다.</p>
        <div>
          <button className="btn btn-primary" onClick={advanceStage}>
            계속
          </button>
        </div>
      </div>
    );
  }

  const passages = bundle.passages.filter((p) => currentUnit.passageIds.includes(p.id));
  const answeredInUnit = currentUnitItems.filter(
    (it) => answerFor(it.id) != null && answerFor(it.id) !== '',
  ).length;
  const unitProgress = currentUnitItems.length
    ? (answeredInUnit / currentUnitItems.length) * 100
    : 0;

  return (
    <div>
      <div className="stage-bar">
        <div className="stage-label">
          {stageTitle}
          <span className="chip num">
            단위문항 {currentUnit.unitNo} · {unitCursor + 1}/{unitsInStage.length}
          </span>
        </div>
        <div className="save-state" aria-live="polite">
          이 단위 응답 {answeredInUnit}/{currentUnitItems.length}
          {justSaved && <span className="saved">자동 저장됨</span>}
        </div>
      </div>
      <div className="progressbar unit-progress" aria-hidden="true">
        <span style={{ width: `${unitProgress}%` }} />
      </div>

      <div className="split-view">
        <div className="passage-pane">
          <PassageView passages={passages} />
        </div>
        <div className="item-pane">
          {currentUnitItems.map((item, i) => (
            <ItemPlayer
              key={item.id}
              item={item}
              index={i}
              value={answerFor(item.id)}
              onChange={(v) => onAnswer(item, v)}
            />
          ))}

          <div className="item-actions">
            {bundle.subtest.allowWithinUnitNav && unitCursor > 0 && (
              <button
                className="btn"
                onClick={() => {
                  setUnitCursor((c) => c - 1);
                  setPhase('scenario');
                }}
              >
                이전 단위
              </button>
            )}
            <button className="btn btn-primary" onClick={nextUnit}>
              {unitCursor < unitsInStage.length - 1 ? '다음 단위' : '단계 완료'}
            </button>
          </div>
        </div>
      </div>

      {confirmSubmit && (
        <SubmitDialog
          unanswered={unansweredCount(bundle, session)}
          onConfirm={doSubmit}
          onCancel={() => setConfirmSubmit(false)}
        />
      )}
    </div>
  );
}

function SubmitDialog({
  unanswered,
  onConfirm,
  onCancel,
}: {
  unanswered: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <ConfirmDialog
      title="제출 확인"
      message={
        unanswered > 0
          ? `미응답 문항이 ${unanswered}개 있습니다.\n제출하면 수정할 수 없습니다. 제출할까요?`
          : '제출하면 수정할 수 없습니다. 제출할까요?'
      }
      confirmLabel="제출"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}
