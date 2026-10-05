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
    <section className="scenario">
      <p className="eyebrow">
        {stageTitle} · 단위문항 {unit.unitNo}
      </p>
      <div className="sheet">
        <h2>{unit.title || `단위문항 ${unit.unitNo}`}</h2>
        {unit.scenarioIntro ? (
          <p className="scenario-text">{unit.scenarioIntro}</p>
        ) : (
          <p className="muted flush">(시나리오 도입문이 없습니다.)</p>
        )}
      </div>
      <button className="btn btn-primary btn-lg" onClick={onContinue}>
        지문·문항 보기
      </button>
    </section>
  );
}
