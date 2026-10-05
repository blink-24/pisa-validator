// 파일럿 결과·문항 통계 (Task 11, Req 13).

import { useRef, useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { listSubtestSummaries, loadBundle, listSessions } from '../../data/db';
import { exportResults, importResults } from '../../data/pilot';
import { downloadJson, readJsonFile } from '../../data/transfer';
import {
  computeItemStats,
  difficultyMismatches,
  pathDistribution,
  tagComparison,
  type ItemStat,
} from '../../core/stats';
import { difficultyLabel, itemTagLabel, responseFormatLabel } from '../../data/taxonomy';
import type { Item } from '../../types';

interface Thresholds {
  pLow: number;
  pHigh: number;
  discMin: number;
  highMaxP: number;
  lowMinP: number;
}

const DEFAULT_THRESHOLDS: Thresholds = { pLow: 0.2, pHigh: 0.8, discMin: 0.2, highMaxP: 0.8, lowMinP: 0.2 };

async function loadPilot(subtestId: string) {
  const bundle = await loadBundle(subtestId);
  const sessions = (await listSessions(subtestId)).filter((s) => s.submittedAt);
  return { items: bundle?.items ?? [], sessions };
}

export function PilotScreen() {
  const { data: subtests } = useAsync(() => listSubtestSummaries(), []);
  const [subtestId, setSubtestId] = useState('');

  return (
    <div>
      <h2>파일럿 데이터·문항 통계</h2>
      <div className="field" style={{ maxWidth: 420 }}>
        <label>소검사 선택</label>
        <select value={subtestId} onChange={(e) => setSubtestId(e.target.value)}>
          <option value="">(선택)</option>
          {(subtests ?? []).map((s) => (
            <option key={s.subtest.id} value={s.subtest.id}>
              {s.subtest.title} (결과 {s.resultCount})
            </option>
          ))}
        </select>
      </div>

      {subtestId && <PilotBody subtestId={subtestId} />}
    </div>
  );
}

function PilotBody({ subtestId }: { subtestId: string }) {
  const { data, loading, refresh } = useAsync(() => loadPilot(subtestId), [subtestId]);
  const [thresholds, setThresholds] = useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function doExport() {
    const exp = await exportResults(subtestId);
    downloadJson(exp, `결과-${subtestId}-${new Date().toISOString().slice(0, 10)}.json`);
  }

  async function doImport(file: File) {
    setErr(null);
    setMsg(null);
    try {
      const json = await readJsonFile(file);
      const summary = await importResults(json, subtestId);
      setMsg(`가져오기 완료: 추가 ${summary.added}, 중복 ${summary.duplicates}, 문항 불일치 ${summary.mismatchedItems}`);
      refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  }

  if (loading || !data) return <p className="muted">불러오는 중...</p>;

  const { items, sessions } = data;
  const stats = computeItemStats(items, sessions);
  const mismatches = new Set(
    difficultyMismatches(items, stats, { highMaxP: thresholds.highMaxP, lowMinP: thresholds.lowMinP }),
  );
  const paths = pathDistribution(sessions);
  const tags = tagComparison(items, stats);
  const smallSample = sessions.length < 30;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', margin: '0.5rem 0 1rem' }}>
        <button className="btn btn-primary" onClick={doExport}>
          결과 내보내기
        </button>
        <button className="btn" onClick={() => fileRef.current?.click()}>
          결과 가져오기
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) doImport(f);
            e.target.value = '';
          }}
        />
      </div>

      {msg && <p className="notice" role="status">{msg}</p>}
      {err && <p className="notice notice-danger" role="alert">{err}</p>}

      <p className="muted">
        응시자 {sessions.length}명. 참고 기준값(p {Math.round(thresholds.pLow * 100)}~
        {Math.round(thresholds.pHigh * 100)}%, 변별도 {thresholds.discMin.toFixed(1)} 이상)은 일반적
        문항분석 관례이며 PISA 공식 기준이 아닙니다.
      </p>
      {smallSample && (
        <p className="notice notice-warn" role="status">
          표본이 작아(30명 미만) 통계 해석에 주의하세요.
        </p>
      )}

      <ThresholdControls thresholds={thresholds} onChange={setThresholds} />

      <h3>문항 통계</h3>
      <ItemStatsTable items={items} stats={stats} thresholds={thresholds} mismatches={mismatches} />

      <h3>경로별 학생 수·등급 분포</h3>
      <PathTable paths={paths} />

      <h3>태그별 비교</h3>
      <TagTable tags={tags} />
    </div>
  );
}

function ThresholdControls({
  thresholds,
  onChange,
}: {
  thresholds: Thresholds;
  onChange: (t: Thresholds) => void;
}) {
  function set<K extends keyof Thresholds>(key: K, v: number) {
    onChange({ ...thresholds, [key]: v });
  }
  return (
    <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
      <legend>기준값 조정</legend>
      <div className="field-row">
        <NumField label="p 하한(%)" value={thresholds.pLow} onChange={(v) => set('pLow', v)} />
        <NumField label="p 상한(%)" value={thresholds.pHigh} onChange={(v) => set('pHigh', v)} />
        <NumField label="변별도 하한" value={thresholds.discMin} pct={false} onChange={(v) => set('discMin', v)} />
        <NumField label="'상' 난도 p 상한(%)" value={thresholds.highMaxP} onChange={(v) => set('highMaxP', v)} />
        <NumField label="'하' 난도 p 하한(%)" value={thresholds.lowMinP} onChange={(v) => set('lowMinP', v)} />
      </div>
    </fieldset>
  );
}

function NumField({
  label,
  value,
  onChange,
  pct = true,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  pct?: boolean;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      <input
        type="number"
        step={pct ? 1 : 0.1}
        value={pct ? Math.round(value * 100) : value}
        onChange={(e) => {
          const n = Number(e.target.value);
          if (!Number.isFinite(n)) return;
          onChange(pct ? n / 100 : n);
        }}
      />
    </div>
  );
}

function fmtPct(n: number): string {
  return `${Math.round(n * 100)}%`;
}
function fmtMs(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

function ItemStatsTable({
  items,
  stats,
  thresholds,
  mismatches,
}: {
  items: Item[];
  stats: ItemStat[];
  thresholds: Thresholds;
  mismatches: Set<string>;
}) {
  const itemsById = new Map(items.map((i) => [i.id, i]));
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>문항</th>
            <th>형식</th>
            <th>설계 난도</th>
            <th>n</th>
            <th>p</th>
            <th>변별도</th>
            <th>평균 시간</th>
            <th>중앙 시간</th>
            <th>비고</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const it = itemsById.get(s.itemId);
            const pBad = s.n > 0 && (s.p < thresholds.pLow || s.p > thresholds.pHigh);
            const discBad = s.discrimination != null && s.discrimination < thresholds.discMin;
            const notes: string[] = [];
            if (mismatches.has(s.itemId)) notes.push('난도 불일치');
            if (s.choiceDist) {
              const total = Object.values(s.choiceDist).reduce((a, b) => a + b, 0) || 1;
              notes.push(
                '선택률: ' +
                  Object.entries(s.choiceDist)
                    .map(([k, v]) => `${k}=${Math.round((v / total) * 100)}%`)
                    .join(' '),
              );
            }
            if (s.codingDist) {
              notes.push('코드: ' + Object.entries(s.codingDist).map(([k, v]) => `${k}:${v}`).join(' '));
            }
            return (
              <tr key={s.itemId}>
                <td>{s.itemId}</td>
                <td>{it ? responseFormatLabel(it.responseFormat) : '-'}</td>
                <td>{it ? difficultyLabel(it.difficulty) : '-'}</td>
                <td>{s.n}</td>
                <td style={pBad ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>
                  {s.n ? fmtPct(s.p) : '-'}
                </td>
                <td style={discBad ? { color: 'var(--color-danger)', fontWeight: 600 } : undefined}>
                  {s.discrimination == null ? '-' : s.discrimination.toFixed(2)}
                </td>
                <td>{s.n ? fmtMs(s.timeMeanMs) : '-'}</td>
                <td>{s.n ? fmtMs(s.timeMedianMs) : '-'}</td>
                <td className="muted" style={{ fontSize: '0.8rem' }}>
                  {notes.join(' · ')}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PathTable({ paths }: { paths: Record<string, { count: number; grades: Record<string, number> }> }) {
  const entries = Object.entries(paths);
  if (entries.length === 0) return <p className="muted">결과가 없습니다.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>경로</th>
            <th>학생 수</th>
            <th>등급 분포</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([path, info]) => (
            <tr key={path}>
              <td>{path}</td>
              <td>{info.count}</td>
              <td>
                {Object.entries(info.grades)
                  .map(([g, n]) => `${g}:${n}`)
                  .join(', ')}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TagTable({ tags }: { tags: Record<string, { count: number; avgP: number; avgDisc: number | null }> }) {
  const entries = Object.entries(tags);
  if (entries.length === 0) return <p className="muted">태그가 지정된 문항이 없습니다.</p>;
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>태그</th>
            <th>문항 수</th>
            <th>평균 p</th>
            <th>평균 변별도</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([tag, info]) => (
            <tr key={tag}>
              <td>{itemTagLabel(tag)}</td>
              <td>{info.count}</td>
              <td>{fmtPct(info.avgP)}</td>
              <td>{info.avgDisc == null ? '-' : info.avgDisc.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
