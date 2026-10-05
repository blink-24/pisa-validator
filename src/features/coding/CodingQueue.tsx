// 구성형 채점 큐 (Task 10, Req 12). 미채점 답안 + 기준/예시 병렬, 코드 즉시 저장 → 등급 재계산.

import { useState } from 'react';
import { useAsync } from '../../hooks/useAsync';
import { db, listSubtestSummaries, loadBundle, listSessions } from '../../data/db';
import { computeResult, itineraryItems } from '../../data/sessionEngine';
import { codingLabel } from '../../data/taxonomy';
import type { Item, Session, CodingValue } from '../../types';

interface PendingAnswer {
  session: Session;
  item: Item;
  answer: string;
  index: number; // 응시 코드 가림용 번호 (Req 12.4)
}

async function loadQueue(subtestId: string) {
  const bundle = await loadBundle(subtestId);
  if (!bundle) return { pending: [] as PendingAnswer[], itemsById: new Map<string, Item>() };
  const sessions = (await listSessions(subtestId)).filter((s) => s.submittedAt);
  const itemsById = new Map(bundle.items.map((i) => [i.id, i]));
  const pending: PendingAnswer[] = [];
  sessions.forEach((s, idx) => {
    for (const r of s.responses) {
      const item = itemsById.get(r.itemId);
      if (!item || item.responseFormat !== 'open_human') continue;
      if (r.humanCode != null) continue; // 이미 채점됨
      pending.push({ session: s, item, answer: typeof r.answer === 'string' ? r.answer : '', index: idx + 1 });
    }
  });
  return { pending, itemsById };
}

export function CodingQueue() {
  const { data: subtests } = useAsync(() => listSubtestSummaries(), []);
  const [subtestId, setSubtestId] = useState<string>('');

  return (
    <div>
      <h2>구성형 채점</h2>
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

      {subtestId && <Queue subtestId={subtestId} />}
    </div>
  );
}

function Queue({ subtestId }: { subtestId: string }) {
  const { data, loading, refresh } = useAsync(() => loadQueue(subtestId), [subtestId]);

  async function assignCode(pa: PendingAnswer, code: CodingValue) {
    // 응답에 humanCode 저장
    const session = await db.sessions.get(pa.session.id);
    if (!session) return;
    const responses = session.responses.map((r) =>
      r.itemId === pa.item.id ? { ...r, humanCode: code } : r,
    );
    let updated: Session = { ...session, responses };

    // 등급 재계산 (Req 12.3)
    const bundle = await loadBundle(subtestId);
    if (bundle && updated.submittedAt) {
      const items = itineraryItems(bundle, updated);
      updated = { ...updated, result: computeResult(bundle, updated, items) };
    }
    await db.sessions.put(updated);
    refresh();
  }

  if (loading || !data) return <p className="muted">불러오는 중...</p>;
  if (data.pending.length === 0) {
    return <p className="notice">미채점 서술형 답안이 없습니다.</p>;
  }

  return (
    <div>
      <p className="muted">응시 코드는 가려지고 답안 번호만 표시됩니다. (Req 12.4)</p>
      {data.pending.map((pa) => (
        <CodingCard key={`${pa.session.id}:${pa.item.id}`} pa={pa} onAssign={assignCode} />
      ))}
    </div>
  );
}

function CodingCard({
  pa,
  onAssign,
}: {
  pa: PendingAnswer;
  onAssign: (pa: PendingAnswer, code: CodingValue) => void;
}) {
  const coding = pa.item.coding ?? [];
  return (
    <div className="card">
      <div className="card-header">
        <strong>
          답안 #{pa.index} · 문항 {pa.item.id}
        </strong>
      </div>
      <div className="split-view">
        <div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            학생 답안
          </div>
          <div className="card" style={{ background: 'var(--color-surface)', whiteSpace: 'pre-line' }}>
            {pa.answer || '(무응답)'}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
            {([2, 1, 0, 9] as CodingValue[]).map((code) => (
              <button key={code} className="btn btn-sm btn-primary" onClick={() => onAssign(pa, code)}>
                {codingLabel(code)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <div className="muted" style={{ fontSize: '0.85rem' }}>
            채점 기준·예시
          </div>
          {coding.length === 0 ? (
            <p className="muted">채점 기준이 없습니다.</p>
          ) : (
            coding.map((c) => (
              <div key={c.code} className="card" style={{ padding: '0.5rem' }}>
                <strong>{codingLabel(c.code)}</strong>
                <p style={{ margin: '0.25rem 0' }}>{c.criterion || '(기준 없음)'}</p>
                {c.examples.length > 0 && (
                  <ul style={{ margin: '0.25rem 0 0 1rem' }}>
                    {c.examples.map((ex, i) => (
                      <li key={i}>{ex}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
