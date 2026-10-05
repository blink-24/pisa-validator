// 보고서 마법사 (Task 12.6, Req 8). 소검사·형식 선택, 진행률, 실패 단계 표시.

import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { listSubtestSummaries } from '../../data/db';
import { buildReportModel } from './reportModel';
import { buildReportHtml, printReport, downloadReportHtml } from './htmlReport';

type Format = 'pdf' | 'html';
type Step = 'idle' | 'model' | 'render' | 'output' | 'done' | 'failed';

const STEP_LABEL: Record<Step, string> = {
  idle: '대기',
  model: '데이터 수집',
  render: '보고서 조립',
  output: '출력',
  done: '완료',
  failed: '실패',
};

export function ReportWizard() {
  const { data: subtests } = useAsync(() => listSubtestSummaries(), []);
  const [subtestId, setSubtestId] = useState('');
  const [format, setFormat] = useState<Format>('pdf');
  const [step, setStep] = useState<Step>('idle');
  const [error, setError] = useState<string | null>(null);

  const progress = { idle: 0, model: 33, render: 66, output: 90, done: 100, failed: 100 }[step];

  async function generate() {
    if (!subtestId) return;
    setError(null);
    try {
      setStep('model');
      const model = await buildReportModel(subtestId);

      setStep('render');
      const html = buildReportHtml(model);

      setStep('output');
      const name = `${model.overview.title || '보고서'}-${new Date().toISOString().slice(0, 10)}`;
      if (format === 'pdf') {
        printReport(html); // 인쇄 대화상자에서 'PDF로 저장' 선택
      } else {
        downloadReportHtml(html, `${name}.html`);
      }
      setStep('done');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setStep('failed');
    }
  }

  return (
    <div className="card">
      <h2>보고서 작성</h2>

      <div className="field" style={{ maxWidth: 480 }}>
        <label>소검사 선택</label>
        <select value={subtestId} onChange={(e) => setSubtestId(e.target.value)}>
          <option value="">(선택)</option>
          {(subtests ?? []).map((s) => (
            <option key={s.subtest.id} value={s.subtest.id}>
              {s.subtest.title}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>형식</label>
        <div className="row row-loose">
          <label className="fw-normal">
            <input
              type="radio"
              name="fmt"
              checked={format === 'pdf'}
              onChange={() => setFormat('pdf')}
              className="inline-control"
            />
            PDF (A4 세로, 인쇄 대화상자에서 'PDF로 저장')
          </label>
          <label className="fw-normal">
            <input
              type="radio"
              name="fmt"
              checked={format === 'html'}
              onChange={() => setFormat('html')}
              className="inline-control"
            />
            HTML (보관·재인쇄용)
          </label>
        </div>
      </div>

      <p className="notice text-sm">
        HWPX 출력은 한글에서 만든 스타일 템플릿(<code>report-template.hwpx</code>)이 필요하며(설계
        Task 12.3) 현재 환경에 템플릿이 없어 비활성화되어 있습니다. 당장은 PDF/HTML을 사용하세요.
        PDF는 A4 세로로 구성되며 표는 행 단위로 페이지가 나뉩니다.
      </p>

      <button
        className="btn btn-primary"
        onClick={generate}
        disabled={!subtestId || step === 'model' || step === 'render'}
      >
        보고서 생성
      </button>

      {step !== 'idle' && (
        <div className="mt">
          <div className="progressbar" aria-label="진행률">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="muted text-sm">
            단계: {STEP_LABEL[step]}
            {step === 'done' && ' — 새 창의 인쇄 대화상자에서 저장하세요.'}
          </p>
        </div>
      )}

      {error && (
        <p className="notice notice-danger" role="alert">
          생성 실패 (단계: {STEP_LABEL[step]}) — {error}
        </p>
      )}
    </div>
  );
}
