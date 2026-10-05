// 배포 (모든 사용자에게 시험 정보 공유). 이 기기의 소검사로 published.json을 만들고,
// 저장소 public/content/에 올리는 방법을 안내한다. 학생 응답은 포함하지 않는다.

import { useEffect, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { listSubtestSummaries, loadBundle } from '../../data/db';
import { getActiveSubtestId } from '../../data/active';
import { downloadJson } from '../../data/transfer';
import {
  buildPublished,
  compareWithPublished,
  fetchPublished,
  githubUploadUrl,
  PUBLISHED_FILENAME,
  type PublishState,
} from '../../data/published';
import { runConformance, hasBlockingError } from '../../core/conformance';
import type { Subtest } from '../../types';

interface Row {
  subtest: Subtest;
  activatable: boolean;
}

async function loadPublishData() {
  const summaries = await listSubtestSummaries();
  const rows: Row[] = [];
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
    rows.push({ subtest: s.subtest, activatable });
  }
  const [published, localActive] = await Promise.all([fetchPublished(), getActiveSubtestId()]);
  return { rows, published, localActive: localActive || '' };
}

const STATE_LABEL: Record<PublishState, { text: string; cls: string }> = {
  same: { text: '배포본과 같음', cls: 'badge-pass' },
  local_newer: { text: '배포 후 수정됨', cls: 'badge-warn' },
  published_newer: { text: '배포본이 더 최신', cls: 'badge-warn' },
  not_published: { text: '배포본에 없음', cls: 'badge-error' },
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR');
}

export function PublishScreen() {
  const { data, loading } = useAsync(loadPublishData, []);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 기본 선택: 지금 배포본에 들어 있는 소검사 + 이 기기의 활성 소검사
  useEffect(() => {
    if (!data) return;
    const localIds = new Set(data.rows.map((r) => r.subtest.id));
    const init = new Set(
      (data.published?.subtests ?? []).map((s) => s.subtest.id).filter((id) => localIds.has(id)),
    );
    if (data.localActive && localIds.has(data.localActive)) init.add(data.localActive);
    setSelected(init);
    setActiveId(data.localActive && localIds.has(data.localActive) ? data.localActive : '');
  }, [data]);

  if (loading || !data) return <p className="muted">불러오는 중...</p>;

  const { rows, published } = data;
  const uploadUrl = githubUploadUrl();
  const activeRow = rows.find((r) => r.subtest.id === activeId);
  const problem = !selected.size
    ? '배포할 소검사를 하나 이상 고르세요.'
    : activeId && !selected.has(activeId)
      ? '학생에게 열 소검사는 배포 대상에 포함되어야 합니다.'
      : activeRow && !activeRow.activatable
        ? '학생에게 열 소검사에 정합성 오류가 있습니다. 편집기에서 오류를 먼저 고치세요.'
        : null;

  function toggle(id: string) {
    setDone(false);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function makeFile() {
    setError(null);
    try {
      const ids = rows.map((r) => r.subtest.id).filter((id) => selected.has(id));
      const pub = await buildPublished(ids, activeId || null);
      downloadJson(pub, PUBLISHED_FILENAME);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const publishedActive = published?.subtests.find(
    (s) => s.subtest.id === published.activeSubtestId,
  );

  return (
    <div className="stack">
      <div className="card">
        <h2>배포</h2>
        <p className="muted">
          이 기기에서 만든 시험 정보(소검사·지문·문항·채점 기준·학생에게 열 소검사)를 저장소의{' '}
          <code>public/content/published.json</code>에 올리면, 사이트에 접속하는 모든 기기에
          반영됩니다. 학생 응답은 포함되지 않으며 지금처럼 각 기기에만 저장됩니다.
        </p>
        <p className="notice notice-warn">
          배포 파일은 <strong>누구나 열어 볼 수 있습니다</strong>(정답·채점 기준 포함). 저작권이
          해결되지 않은 지문은 배포하지 마세요.
        </p>
      </div>

      <div className="card">
        <h3>지금 사이트의 배포본</h3>
        {!published ? (
          <p className="muted">
            사이트에서 배포본을 찾지 못했습니다. 개발 환경이거나 아직 배포 파일이 올라가지 않은
            상태입니다.
          </p>
        ) : !published.publishedAt ? (
          <p className="muted">아직 배포한 적이 없습니다.</p>
        ) : (
          <ul className="meta-list">
            <li>배포 시각: {fmt(published.publishedAt)}</li>
            <li>
              학생에게 열린 소검사:{' '}
              {publishedActive ? publishedActive.subtest.title : '없음(비활성)'}
            </li>
            <li>포함된 소검사: {published.subtests.length}개</li>
          </ul>
        )}
      </div>

      <div className="card">
        <h3>새 배포 파일 만들기</h3>
        {rows.length === 0 ? (
          <p className="muted">이 기기에 소검사가 없습니다.</p>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>포함</th>
                  <th>제목</th>
                  <th>정합성</th>
                  <th>배포본과 비교</th>
                  <th>수정 시각</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const st = STATE_LABEL[compareWithPublished(r.subtest, published)];
                  return (
                    <tr key={r.subtest.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selected.has(r.subtest.id)}
                          onChange={() => toggle(r.subtest.id)}
                          aria-label={`${r.subtest.title} 배포에 포함`}
                        />
                      </td>
                      <td>{r.subtest.title || '(제목 없음)'}</td>
                      <td>
                        <span className={`badge ${r.activatable ? 'badge-pass' : 'badge-error'}`}>
                          {r.activatable ? '통과' : '오류'}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${st.cls}`}>{st.text}</span>
                      </td>
                      <td className="muted text-xs">{fmt(r.subtest.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="field mt">
          <label htmlFor="publish-active">학생에게 열 소검사</label>
          <select
            id="publish-active"
            value={activeId}
            onChange={(e) => {
              setDone(false);
              setActiveId(e.target.value);
            }}
          >
            <option value="">없음(비활성 — 학생이 응시할 수 없음)</option>
            {rows
              .filter((r) => selected.has(r.subtest.id) && r.activatable)
              .map((r) => (
                <option key={r.subtest.id} value={r.subtest.id}>
                  {r.subtest.title}
                </option>
              ))}
          </select>
        </div>

        {problem && <p className="form-warn">{problem}</p>}
        {error && (
          <p className="notice notice-danger" role="alert">
            {error}
          </p>
        )}

        <div className="row">
          <button className="btn btn-primary" disabled={!!problem} onClick={makeFile}>
            배포 파일 내려받기 ({PUBLISHED_FILENAME})
          </button>
        </div>
        {done && (
          <p className="notice mt-sm" role="status">
            {PUBLISHED_FILENAME}을 내려받았습니다. 아래 순서대로 저장소에 올리면 배포가 끝납니다.
          </p>
        )}
      </div>

      <div className="card">
        <h3>저장소에 올리는 방법</h3>
        <ol className="steps">
          <li>
            <div>
              위에서 <strong>{PUBLISHED_FILENAME}</strong>을 내려받습니다. 파일 이름을 바꾸지
              마세요.
            </div>
          </li>
          <li>
            <div>
              GitHub 저장소의 <code>public/content</code> 폴더를 엽니다
              {uploadUrl && (
                <>
                  {' '}
                  (
                  <a href={uploadUrl} target="_blank" rel="noreferrer">
                    업로드 페이지 바로 열기
                  </a>
                  )
                </>
              )}
              . 'Add file → Upload files'를 누릅니다.
            </div>
          </li>
          <li>
            <div>
              파일을 끌어다 놓고 'Commit changes'를 누릅니다. 기존 파일은 자동으로 덮어써집니다.
            </div>
          </li>
          <li>
            <div>
              1~2분 뒤 Actions의 배포가 끝나면, 각 기기에서 사이트를 새로 열 때 반영됩니다. 파일
              형식이 잘못되면 테스트 단계에서 배포가 멈추고 기존 배포본이 유지됩니다.
            </div>
          </li>
        </ol>
        <p className="form-hint">
          이 기기에서 배포 이후 더 수정한 소검사는 새 배포본이 와도 덮어쓰지 않습니다. 학생 응시가
          진행 중일 때는 배포를 피하세요.
        </p>
      </div>
    </div>
  );
}
