// 시나리오 도입 화면 (Req 10.3). 단위문항 진입 전 읽기 목적 제시.

import type { Unit } from '../../types';

export function ScenarioIntro({
  stageTitle,
  unit,
  onContinue,
}: {
  stageTitle: string;
  unit: Unit;
  onContinue: () => void;
}) {
  return (
    <section>
      <div className="muted" style={{ marginBottom: '0.5rem' }}>
        {stageTitle} · 단위문항 {unit.unitNo}
      </div>
      <div className="card">
        <h2>{unit.title || `단위문항 ${unit.unitNo}`}</h2>
        {unit.scenarioIntro ? (
          <p style={{ whiteSpace: 'pre-line', lineHeight: 1.8 }}>{unit.scenarioIntro}</p>
        ) : (
          <p className="muted">(시나리오 도입문이 없습니다.)</p>
        )}
      </div>
      <button className="btn btn-primary" onClick={onContinue}>
        지문·문항 보기
      </button>
    </section>
  );
}
