// 문항 응답 UI (Req 10). 보고서 캡처에도 재사용(readOnly). 학생 화면과 동일 렌더.

import type { Item } from '../../types';

interface ItemPlayerProps {
  item: Item;
  value: unknown;
  onChange: (value: unknown) => void;
  index?: number;
  readOnly?: boolean;
}

export function ItemPlayer({ item, value, onChange, index, readOnly }: ItemPlayerProps) {
  return (
    <div className="card">
      <div className="muted" style={{ fontSize: '0.85rem' }}>
        {index != null ? `문항 ${index + 1}` : item.id}
      </div>
      <div
        style={{ fontWeight: 600, margin: '0.25rem 0 0.75rem' }}
        dangerouslySetInnerHTML={{ __html: item.stem || '(발문 없음)' }}
      />
      {renderBody(item, value, onChange, readOnly)}
    </div>
  );
}

function renderBody(
  item: Item,
  value: unknown,
  onChange: (v: unknown) => void,
  readOnly?: boolean,
) {
  switch (item.responseFormat) {
    case 'simple_mc':
      return (
        <div role="radiogroup" aria-label="선택지">
          {(item.choices ?? []).map((c) => (
            <label key={c.id} className="choice-option">
              <input
                type="radio"
                name={`q-${item.id}`}
                checked={value === c.id}
                disabled={readOnly}
                onChange={() => onChange(c.id)}
              />
              <span>{c.text}</span>
            </label>
          ))}
        </div>
      );

    case 'complex_mc': {
      const m = item.matrix;
      if (!m) return null;
      const picks = (value ?? {}) as Record<string, string>;
      return (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>진술</th>
                {m.cols.map((col) => (
                  <th key={col}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {m.rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.text}</td>
                  {m.cols.map((col) => (
                    <td key={col} style={{ textAlign: 'center' }}>
                      <input
                        type="radio"
                        name={`q-${item.id}-${row.id}`}
                        checked={picks[row.id] === col}
                        disabled={readOnly}
                        onChange={() => onChange({ ...picks, [row.id]: col })}
                        aria-label={`${row.text} - ${col}`}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'short_auto':
      return (
        <input
          type="text"
          value={typeof value === 'string' ? value : ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder="답을 입력하세요"
        />
      );

    case 'open_human':
      return (
        <textarea
          rows={5}
          value={typeof value === 'string' ? value : ''}
          disabled={readOnly}
          onChange={(e) => onChange(e.target.value)}
          placeholder="서술형 답안을 작성하세요"
        />
      );

    default:
      return null;
  }
}
