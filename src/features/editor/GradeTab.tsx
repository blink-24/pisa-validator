// 등급 규칙·등급별 설명문 (Task 4.6, Req 11.2, 11.4).

import { useState } from 'react';
import { updateSubtest } from '../../data/subtests';
import type { Subtest } from '../../types';

export function GradeTab({ subtest, onSaved }: { subtest: Subtest; onSaved: () => void }) {
  const [draft, setDraft] = useState<Subtest>(subtest);
  const [saved, setSaved] = useState(false);

  function setRule(patch: Partial<Subtest['gradeRule']>) {
    setDraft((d) => ({ ...d, gradeRule: { ...d.gradeRule, ...patch } }));
    setSaved(false);
  }
  function setDesc(key: 'high' | 'mid' | 'low', value: string) {
    setDraft((d) => ({ ...d, gradeDescriptors: { ...(d.gradeDescriptors ?? {}), [key]: value } }));
    setSaved(false);
  }

  async function save() {
    await updateSubtest(draft);
    setSaved(true);
    onSaved();
  }

  const d = draft.gradeDescriptors ?? {};

  return (
    <div className="card">
      {draft.structure === 'msat3' ? (
        <>
          <h3>등급 규칙 (최종 묶음 정답률)</h3>
          <div className="field-row">
            <div className="field">
              <label>상 묶음에서 '상' 판정 컷 (이상, %)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(draft.gradeRule.highBlockCut * 100)}
                onChange={(e) => setRule({ highBlockCut: pct(e.target.value) })}
              />
              <span className="muted text-xs">미만이면 '중'</span>
            </div>
            <div className="field">
              <label>하 묶음에서 '중' 판정 컷 (이상, %)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round(draft.gradeRule.lowBlockCut * 100)}
                onChange={(e) => setRule({ lowBlockCut: pct(e.target.value) })}
              />
              <span className="muted text-xs">미만이면 '하'</span>
            </div>
          </div>
        </>
      ) : (
        <p className="notice">
          단일 단계 구조에서는 1차 판정 컷(연결 규칙 탭)이 최종 등급 기준입니다.
        </p>
      )}

      <h3>등급별 설명문 (선택, Req 11.4)</h3>
      <div className="field">
        <label>상</label>
        <textarea rows={2} value={d.high ?? ''} onChange={(e) => setDesc('high', e.target.value)} />
      </div>
      <div className="field">
        <label>중</label>
        <textarea rows={2} value={d.mid ?? ''} onChange={(e) => setDesc('mid', e.target.value)} />
      </div>
      <div className="field">
        <label>하</label>
        <textarea rows={2} value={d.low ?? ''} onChange={(e) => setDesc('low', e.target.value)} />
      </div>

      <div className="row">
        <button className="btn btn-primary" onClick={save}>
          저장
        </button>
        {saved && <span className="muted">저장됨</span>}
      </div>
    </div>
  );
}

function pct(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / 100));
}
