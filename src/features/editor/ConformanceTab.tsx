// 정합성 점검 탭 (Task 6, Req 7). 표 + 오류 시 활성화 차단 안내.

import { runConformance, hasBlockingError } from '../../core/conformance';
import type { Subtest, Unit, Passage, Item } from '../../types';
import type { ConformanceLevel } from '../../core/conformance';

const LEVEL_LABEL: Record<ConformanceLevel, string> = { pass: '통과', warn: '경고', error: '오류' };

export function ConformanceTab({
  subtest,
  units,
  passages,
  items,
}: {
  subtest: Subtest;
  units: Unit[];
  passages: Passage[];
  items: Item[];
}) {
  const results = runConformance({ subtest, units, passages, items });
  const blocked = hasBlockingError(results);

  return (
    <div>
      {blocked ? (
        <p className="notice notice-danger" role="alert">
          오류가 1개 이상 있어 이 소검사는 사용자 소검사로 활성화할 수 없습니다. 오류를 해결하세요.
        </p>
      ) : (
        <p className="notice" role="status">
          차단 오류가 없습니다. '사용자 소검사 설정'에서 활성화할 수 있습니다.
          {results.some((r) => r.level === 'warn') && ' (경고 항목은 활성화를 막지 않습니다.)'}
        </p>
      )}

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>점검 항목</th>
              <th>결과</th>
              <th>해당 문항</th>
              <th>근거</th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <tr key={r.id}>
                <td>{r.label}</td>
                <td>
                  <span className={`badge badge-${r.level}`}>{LEVEL_LABEL[r.level]}</span>
                </td>
                <td>{r.itemIds.length ? r.itemIds.join(', ') : '-'}</td>
                <td className="muted text-xs">{r.basis}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
