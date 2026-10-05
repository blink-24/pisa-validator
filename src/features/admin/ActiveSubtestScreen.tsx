// 사용자 소검사 설정 (Task 7, Req 9). 라디오 단일 선택, 진행 중 세션 경고.

import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { listSubtestSummaries, loadBundle, db } from '../../data/db';
import { runConformance, hasBlockingError } from '../../core/conformance';
import { getActiveSubtestId, setActiveSubtestId } from '../../data/active';
import { ConfirmDialog } from '../../components/ConfirmDialog';

interface Choice {
  id: string;
  title: string;
  activatable: boolean;
}

async function loadChoices() {
  const summaries = await listSubtestSummaries();
  const choices: Choice[] = [];
  for (const s of summaries) {
    const b = await loadBundle(s.subtest.id);
    const activatable = b
      ? !hasBlockingError(
          runConformance({
            subtest: b.subtest,
            units: b.units,
            passages: b.passages,
            items: b.items,
          }),
        )
      : false;
    choices.push({ id: s.subtest.id, title: s.subtest.title, activatable });
  }
  const activeId = await getActiveSubtestId();
  return { choices, activeId };
}

export function ActiveSubtestScreen() {
  const { data, loading, refresh } = useAsync(loadChoices, []);
  const [pending, setPending] = useState<string | null>(null);

  async function hasInProgress(subtestId: string): Promise<boolean> {
    const sessions = await db.sessions.where('subtestId').equals(subtestId).toArray();
    return sessions.some((s) => !s.submittedAt);
  }

  async function choose(id: string) {
    const current = data?.activeId;
    // 현재 활성 소검사에 진행 중 세션이 있으면 경고 (Req 9.2)
    if (current && current !== id && (await hasInProgress(current))) {
      setPending(id);
      return;
    }
    await setActiveSubtestId(id);
    refresh();
  }

  async function confirmSwitch() {
    if (!pending) return;
    await setActiveSubtestId(pending);
    setPending(null);
    refresh();
  }

  if (loading || !data) return <p className="muted">불러오는 중...</p>;

  const activatable = data.choices.filter((c) => c.activatable);

  return (
    <div className="card">
      <h2>사용자 소검사 설정</h2>
      <p className="muted">
        정합성 오류가 없는 소검사만 선택할 수 있습니다. 한 번에 하나만 활성화됩니다.
      </p>

      {activatable.length === 0 ? (
        <p className="notice notice-warn">활성화 가능한(오류 없는) 소검사가 없습니다.</p>
      ) : (
        <div className="choice-list mt" role="radiogroup" aria-label="학생에게 열 소검사">
          <label className={!data.activeId ? 'choice-option is-checked' : 'choice-option'}>
            <input
              type="radio"
              name="active"
              checked={!data.activeId}
              onChange={() => choose('')}
              className="inline-control"
            />
            <span className="grow">비활성</span>
            <span className="form-hint">학생 화면에서 응시할 수 없음</span>
          </label>
          {activatable.map((c) => (
            <label
              key={c.id}
              className={data.activeId === c.id ? 'choice-option is-checked' : 'choice-option'}
            >
              <input
                type="radio"
                name="active"
                checked={data.activeId === c.id}
                onChange={() => choose(c.id)}
                className="inline-control"
              />
              <span className="grow">{c.title}</span>
              {data.activeId === c.id && <span className="badge badge-pass">응시 중</span>}
            </label>
          ))}
        </div>
      )}

      {data.choices.some((c) => !c.activatable) && (
        <p className="muted mt text-sm">
          활성화할 수 없는 소검사:{' '}
          {data.choices
            .filter((c) => !c.activatable)
            .map((c) => c.title)
            .join(', ')}
        </p>
      )}

      {pending && (
        <ConfirmDialog
          title="활성 소검사 변경"
          message={
            '현재 활성 소검사에 진행 중인 응시 세션이 있습니다.\n변경하면 학생이 이어서 응시할 수 없게 될 수 있습니다. 계속할까요?'
          }
          confirmLabel="변경"
          danger
          onConfirm={confirmSwitch}
          onCancel={() => setPending(null)}
        />
      )}
    </div>
  );
}
