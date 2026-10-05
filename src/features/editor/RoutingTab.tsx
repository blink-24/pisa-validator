// 연결 규칙 탭 (Task 4.5, Req 6). 컷·배정 방식·경로 그래프 미리보기.

import { useState } from 'react';
import { updateSubtest } from '../../data/subtests';
import type { Subtest, Item } from '../../types';

export function RoutingTab({
  subtest,
  items,
  onSaved,
}: {
  subtest: Subtest;
  items: Item[];
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Subtest>(subtest);
  const [saved, setSaved] = useState(false);

  function setRouting(patch: Partial<Subtest['routing']>) {
    setDraft((d) => ({ ...d, routing: { ...d.routing, ...patch } }));
    setSaved(false);
  }
  function setFirstCut(patch: Partial<Subtest['routing']['firstCut']>) {
    setDraft((d) => ({
      ...d,
      routing: { ...d.routing, firstCut: { ...d.routing.firstCut, ...patch } },
    }));
    setSaved(false);
  }

  async function save() {
    await updateSubtest(draft);
    setSaved(true);
    onSaved();
  }

  if (draft.structure === 'single') {
    return (
      <div className="card">
        <p className="notice">
          이 소검사는 '단일 단계' 구조입니다. 경로 분기가 없으며, 1차 판정 컷이 그대로 최종 등급
          기준이 됩니다. 구조는 '개요' 탭에서 변경할 수 있습니다.
        </p>
        <CutFields firstCut={draft.routing.firstCut} onChange={setFirstCut} />
        <SaveBar onSave={save} saved={saved} />
      </div>
    );
  }

  return (
    <div className="card">
      <h3>1차 판정 컷 (핵심단계 자동 채점 정답률)</h3>
      <CutFields firstCut={draft.routing.firstCut} onChange={setFirstCut} />

      <h3>배정 방식</h3>
      <div className="field">
        <label>
          <input
            type="radio"
            name="assign"
            checked={draft.routing.assign === 'deterministic'}
            onChange={() => setRouting({ assign: 'deterministic' })}
            className="inline-control"
          />
          결정형 (상→상 묶음, 하→하 묶음, 중→지정 묶음)
        </label>
        <label>
          <input
            type="radio"
            name="assign"
            checked={draft.routing.assign === 'pisa_probabilistic'}
            onChange={() => setRouting({ assign: 'pisa_probabilistic' })}
            className="inline-control"
          />
          PISA 확률형 (상 90%/10%, 하 90%/10%, 중 50%/50%)
        </label>
      </div>

      {draft.routing.assign === 'deterministic' && (
        <div className="field">
          <label>'중' 판정 시 배정 묶음</label>
          <select
            value={draft.routing.midGoesTo}
            onChange={(e) => setRouting({ midGoesTo: e.target.value as 'low' | 'high' })}
          >
            <option value="low">하 묶음</option>
            <option value="high">상 묶음</option>
          </select>
        </div>
      )}

      <h3>경로 미리보기</h3>
      <RoutingGraph subtest={draft} items={items} />

      <SaveBar onSave={save} saved={saved} />
    </div>
  );
}

function CutFields({
  firstCut,
  onChange,
}: {
  firstCut: Subtest['routing']['firstCut'];
  onChange: (patch: Partial<Subtest['routing']['firstCut']>) => void;
}) {
  return (
    <div className="field-row">
      <div className="field">
        <label>상 (이상, %)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(firstCut.high * 100)}
          onChange={(e) => onChange({ high: clampPct(e.target.value) })}
        />
      </div>
      <div className="field">
        <label>중 (이상, %)</label>
        <input
          type="number"
          min={0}
          max={100}
          value={Math.round(firstCut.mid * 100)}
          onChange={(e) => onChange({ mid: clampPct(e.target.value) })}
        />
      </div>
    </div>
  );
}

function clampPct(v: string): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n / 100));
}

interface GraphNode {
  label: string;
  n: number;
}

function RoutingGraph({ items }: { subtest: Subtest; items: Item[] }) {
  function count(stage: Item['stage'], block: Item['block']) {
    return items.filter((i) => i.stage === stage && i.block === block).length;
  }
  const coreN = count('core', 'none');
  const stage1: GraphNode[] = [
    { label: '1단계 상', n: count('stage1', 'high') },
    { label: '1단계 하', n: count('stage1', 'low') },
  ];
  const stage2: GraphNode[] = [
    { label: '2단계 상', n: count('stage2', 'high') },
    { label: '2단계 하', n: count('stage2', 'low') },
  ];

  const col = (nodes: GraphNode[]) => (
    <div className="routing-col">
      {nodes.map((c) => (
        <div
          key={c.label}
          className="routing-node"
          style={c.n === 0 ? { borderColor: 'var(--color-danger)' } : undefined}
        >
          {c.label}
          <div className="muted">{c.n}문항</div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="routing-graph">
      <div
        className="routing-node"
        style={coreN === 0 ? { borderColor: 'var(--color-danger)' } : undefined}
      >
        핵심단계
        <div className="muted">{coreN}문항</div>
      </div>
      <span aria-hidden="true">→</span>
      {col(stage1)}
      <span aria-hidden="true">→</span>
      {col(stage2)}
    </div>
  );
}

function SaveBar({ onSave, saved }: { onSave: () => void; saved: boolean }) {
  return (
    <div className="row mt">
      <button className="btn btn-primary" onClick={onSave}>
        저장
      </button>
      {saved && <span className="muted">저장됨</span>}
    </div>
  );
}
