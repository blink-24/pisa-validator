// 보고서 HTML 생성 (Task 12.5 대체: A4 세로 인쇄 → PDF 저장).
// 외부 의존성 없이 브라우저 인쇄 엔진으로 PDF를 만든다.

import type { ReportModel } from './reportModel';

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** stem 등 제한 HTML은 태그를 벗겨 텍스트로. */
function plain(s: string): string {
  return esc(s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());
}

const LEVEL_LABEL: Record<string, string> = { pass: '통과', warn: '경고', error: '오류' };

export function buildReportHtml(model: ReportModel): string {
  const m = model;
  const sections: string[] = [];

  // Ⅰ. 개요
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅰ. 소검사 개요</h2>
      <table class="rpt-kv">
        <tr><th>제목</th><td>${esc(m.overview.title)}</td></tr>
        <tr><th>대상</th><td>${esc(m.overview.target)}</td></tr>
        <tr><th>구성</th><td>단위문항 ${m.overview.unitCount}개 · 문항 ${m.overview.itemCount}개 · ${esc(m.overview.structure)}</td></tr>
        <tr><th>설명</th><td>${esc(m.overview.description || '-')}</td></tr>
        <tr><th>경로</th><td>${m.overview.pathSummary.map(esc).join('<br>')}</td></tr>
      </table>
    </section>`);

  // Ⅱ. 평가틀
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅱ. 평가틀</h2>
      <table class="rpt-table">
        <thead><tr><th>차원</th><th>하위 범주</th><th>포함된 종류</th></tr></thead>
        <tbody>
          ${m.frameworkTable
            .map((r) => `<tr><td>${esc(r.dimension)}</td><td>${esc(r.subcategory)}</td><td>${esc(r.kinds || '-')}</td></tr>`)
            .join('')}
        </tbody>
      </table>
    </section>`);

  // Ⅲ. 문항 정보표 (11열)
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅲ. 문항 정보표 〈표 Ⅲ-2〉</h2>
      <table class="rpt-table rpt-small">
        <thead><tr>
          <th>단위</th><th>문항 ID</th><th>단계·묶음</th><th>과정</th><th>체재</th>
          <th>유형</th><th>출처</th><th>상황</th><th>응답 형식</th><th>난도</th>
        </tr></thead>
        <tbody>
          ${m.itemTable
            .map(
              (r) => `<tr>
            <td>${r.unitNo}</td><td>${esc(r.id)}</td><td>${esc(r.stageBlock)}</td>
            <td>${esc(r.process)}</td><td>${esc(r.textFormat)}</td><td>${esc(r.textType)}</td>
            <td>${esc(r.source)}</td><td>${esc(r.situation)}</td><td>${esc(r.responseFormat)}</td><td>${esc(r.difficulty)}</td>
          </tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>`);

  // Ⅳ. 문항별 상세
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅳ. 문항별 상세</h2>
      ${m.itemDetails
        .map(
          (d) => `
        <div class="rpt-item">
          <h3>${esc(d.id)}</h3>
          <p class="rpt-stem">${plain(d.stem) || '(발문 없음)'}</p>
          <table class="rpt-kv">
            ${d.characteristics.map((c) => `<tr><th>${esc(c.label)}</th><td>${esc(c.value)}</td></tr>`).join('')}
            ${d.intent ? `<tr><th>문항 의도</th><td>${esc(d.intent)}</td></tr>` : ''}
            ${d.commentary ? `<tr><th>해설</th><td>${esc(d.commentary)}</td></tr>` : ''}
          </table>
          ${
            d.coding && d.coding.length
              ? `<table class="rpt-table rpt-small"><thead><tr><th>코드</th><th>기준</th><th>예시</th></tr></thead><tbody>
                  ${d.coding
                    .map(
                      (c) =>
                        `<tr><td>${esc(c.label)}</td><td>${esc(c.criterion || '-')}</td><td>${esc(c.examples.join(' / ') || '-')}</td></tr>`,
                    )
                    .join('')}
                </tbody></table>`
              : ''
          }
        </div>`,
        )
        .join('')}
    </section>`);

  // Ⅴ. 정합성 점검
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅴ. 평가틀 정합성 점검</h2>
      <table class="rpt-table">
        <thead><tr><th>항목</th><th>결과</th><th>해당 문항</th><th>근거</th></tr></thead>
        <tbody>
          ${m.conformance
            .map(
              (c) =>
                `<tr><td>${esc(c.label)}</td><td>${LEVEL_LABEL[c.level]}</td><td>${esc(c.itemIds.join(', ') || '-')}</td><td>${esc(c.basis)}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>
    </section>`);

  // Ⅵ. 파일럿 (있을 때만)
  if (m.pilot) {
    sections.push(`
      <section class="rpt-section">
        <h2>Ⅵ. 파일럿 결과 (응시자 ${m.pilot.n}명)</h2>
        ${m.pilot.n < 30 ? '<p class="rpt-note">표본이 작아(30명 미만) 해석에 주의.</p>' : ''}
        <table class="rpt-table rpt-small">
          <thead><tr><th>문항</th><th>n</th><th>p</th><th>변별도</th><th>평균시간(s)</th></tr></thead>
          <tbody>
            ${m.pilot.itemStats
              .map(
                (s) =>
                  `<tr><td>${esc(s.itemId)}</td><td>${s.n}</td><td>${s.n ? Math.round(s.p * 100) + '%' : '-'}</td><td>${
                    s.discrimination == null ? '-' : s.discrimination.toFixed(2)
                  }</td><td>${s.n ? (s.timeMeanMs / 1000).toFixed(1) : '-'}</td></tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </section>`);
  }

  // Ⅶ. 출처·저작권·한계
  sections.push(`
    <section class="rpt-section">
      <h2>Ⅶ. 출처 및 저작권, 한계</h2>
      <table class="rpt-table">
        <thead><tr><th>지문</th><th>출처</th></tr></thead>
        <tbody>
          ${m.sources.map((s) => `<tr><td>${esc(s.passageTitle)}</td><td>${esc(s.source)}</td></tr>`).join('') || '<tr><td colspan="2">-</td></tr>'}
        </tbody>
      </table>
      <ul class="rpt-limit">
        ${m.limitations.map((l) => `<li>${esc(l)}</li>`).join('')}
      </ul>
    </section>`);

  return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<title>${esc(m.overview.title)} 보고서</title>
<style>
  @page { size: A4 portrait; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Pretendard','Nanum Gothic','Malgun Gothic',sans-serif; color:#111; line-height:1.6; font-size:11pt; }
  h1 { font-size:18pt; }
  h2 { font-size:14pt; border-bottom:2px solid #333; padding-bottom:4px; margin-top:0; }
  h3 { font-size:12pt; }
  .rpt-section { page-break-inside:auto; margin-bottom:16px; }
  .rpt-item { page-break-inside:avoid; border:1px solid #ccc; border-radius:6px; padding:8px; margin-bottom:10px; }
  .rpt-stem { font-weight:600; }
  table { border-collapse:collapse; width:100%; margin:6px 0; }
  th, td { border:1px solid #999; padding:4px 6px; text-align:left; vertical-align:top; }
  tr { page-break-inside:avoid; }
  .rpt-kv th { width:28%; background:#f3f4f6; }
  .rpt-table thead th { background:#f3f4f6; }
  .rpt-small { font-size:9pt; }
  .rpt-note { color:#b45309; }
  .rpt-limit li { margin-bottom:4px; }
  .rpt-cover { text-align:center; margin:40px 0 24px; }
</style></head>
<body>
  <div class="rpt-cover">
    <h1>${esc(m.overview.title)}</h1>
    <p>PISA형 문항 검증 보고서</p>
    <p>${esc(m.overview.target)}</p>
  </div>
  ${sections.join('\n')}
</body></html>`;
}

/** 새 창에 보고서를 열고 인쇄 대화상자(=PDF 저장) 호출. */
export function printReport(html: string): void {
  const win = window.open('', '_blank');
  if (!win) {
    throw new Error('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요.');
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  // 폰트·레이아웃 로드 후 인쇄
  win.focus();
  setTimeout(() => {
    try {
      win.print();
    } catch {
      /* 사용자가 수동 인쇄 */
    }
  }, 500);
}

/** HTML 파일로 다운로드(인쇄 없이 보관용). */
export function downloadReportHtml(html: string, filename: string): void {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
