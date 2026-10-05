// 소검사 편집기 (Task 4). 탭: 개요 / 단위·지문 / 문항 / 연결 규칙 / 등급 / 정합성.

import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAsync } from '../../hooks/useAsync';
import { loadBundle } from '../../data/db';
import { OverviewTab } from './OverviewTab';
import { UnitsTab } from './UnitsTab';
import { ItemsTab } from './ItemsTab';
import { RoutingTab } from './RoutingTab';
import { GradeTab } from './GradeTab';
import { ConformanceTab } from './ConformanceTab';

type TabKey = 'overview' | 'units' | 'items' | 'routing' | 'grade' | 'conformance';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: '개요' },
  { key: 'units', label: '단위·지문' },
  { key: 'items', label: '문항' },
  { key: 'routing', label: '연결 규칙' },
  { key: 'grade', label: '등급' },
  { key: 'conformance', label: '정합성' },
];

export function SubtestEditor() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('overview');
  const { data, loading, error, refresh } = useAsync(() => loadBundle(id), [id]);

  if (loading) return <p className="muted">불러오는 중...</p>;
  if (error || !data) {
    return (
      <div>
        <p className="notice notice-danger">소검사를 찾을 수 없습니다.</p>
        <button className="btn" onClick={() => navigate('/admin')}>
          목록으로
        </button>
      </div>
    );
  }

  const { subtest, units, passages, items } = data;

  return (
    <div>
      <div className="list-header">
        <h2>{subtest.title || '(제목 없음)'} 편집</h2>
        <button className="btn" onClick={() => navigate('/admin')}>
          목록으로
        </button>
      </div>

      <div className="editor-tabs" role="tablist" aria-label="편집기 탭">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            className="editor-tab"
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab subtest={subtest} onSaved={refresh} />}
      {tab === 'units' && (
        <UnitsTab subtestId={subtest.id} units={units} passages={passages} onChanged={refresh} />
      )}
      {tab === 'items' && (
        <ItemsTab subtest={subtest} units={units} items={items} onChanged={refresh} />
      )}
      {tab === 'routing' && <RoutingTab subtest={subtest} items={items} onSaved={refresh} />}
      {tab === 'grade' && <GradeTab subtest={subtest} onSaved={refresh} />}
      {tab === 'conformance' && (
        <ConformanceTab subtest={subtest} units={units} passages={passages} items={items} />
      )}
    </div>
  );
}
