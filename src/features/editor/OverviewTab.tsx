// 개요 탭: 제목/설명/대상/구조/단위 내 이동 옵션.

import { useState } from 'react';
import { updateSubtest } from '../../data/subtests';
import type { Subtest } from '../../types';

export function OverviewTab({ subtest, onSaved }: { subtest: Subtest; onSaved: () => void }) {
  const [draft, setDraft] = useState<Subtest>(subtest);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Subtest>(key: K, value: Subtest[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  async function save() {
    await updateSubtest(draft);
    setSaved(true);
    onSaved();
  }

  return (
    <div className="card">
      <div className="field">
        <label htmlFor="ov-title">제목</label>
        <input id="ov-title" value={draft.title} onChange={(e) => set('title', e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="ov-desc">설명</label>
        <textarea
          id="ov-desc"
          rows={3}
          value={draft.description}
          onChange={(e) => set('description', e.target.value)}
        />
      </div>
      <div className="field-row">
        <div className="field">
          <label htmlFor="ov-target">대상</label>
          <input
            id="ov-target"
            value={draft.target}
            onChange={(e) => set('target', e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="ov-structure">구조</label>
          <select
            id="ov-structure"
            value={draft.structure}
            onChange={(e) => set('structure', e.target.value as Subtest['structure'])}
          >
            <option value="single">단일 단계(핵심단계만)</option>
            <option value="msat3">3단계 적응형(핵심 → 1단계 → 2단계)</option>
          </select>
        </div>
      </div>
      <div className="field">
        <label>
          <input
            type="checkbox"
            checked={draft.allowWithinUnitNav}
            onChange={(e) => set('allowWithinUnitNav', e.target.checked)}
            className="inline-control"
          />
          같은 단위문항 안에서 문항 간 이동 허용 (Req 6.8)
        </label>
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
