// 문항 탭 (Task 4.2-4.4, Req 4·5). 단위별 문항 목록 + ItemForm.

import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { ItemForm } from './ItemForm';
import { addItem, deleteItem, reorderItems } from '../../data/editorRepo';
import { responseFormatLabel, stageLabel, blockLabel } from '../../data/taxonomy';
import type { Subtest, Unit, Item, Stage, Block } from '../../types';

export function ItemsTab({
  subtest,
  units,
  items,
  onChanged,
}: {
  subtest: Subtest;
  units: Unit[];
  items: Item[];
  onChanged: () => void;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  if (units.length === 0) {
    return <p className="muted">먼저 '단위·지문' 탭에서 단위문항을 추가하세요.</p>;
  }

  return (
    <div>
      {units.map((unit) => {
        const unitItems = items.filter((i) => i.unitId === unit.id).sort((a, b) => a.order - b.order);
        return (
          <div className="card" key={unit.id}>
            <div className="card-header">
              <h3>
                단위문항 {unit.unitNo} · 문항 {unitItems.length}개
              </h3>
              <AddItemButtons
                subtest={subtest}
                onAdd={async (stage, block) => {
                  const it = await addItem(subtest.id, unit, stage, block);
                  setExpanded(it.id);
                  onChanged();
                }}
              />
            </div>

            {unitItems.length === 0 && <p className="muted">문항이 없습니다.</p>}

            {unitItems.map((item, idx) => (
              <ItemRow
                key={item.id}
                item={item}
                index={idx}
                count={unitItems.length}
                expanded={expanded === item.id}
                onToggle={() => setExpanded(expanded === item.id ? null : item.id)}
                onMove={async (dir) => {
                  const ids = unitItems.map((i) => i.id);
                  const j = idx + dir;
                  if (j < 0 || j >= ids.length) return;
                  [ids[idx], ids[j]] = [ids[j]!, ids[idx]!];
                  await reorderItems(unit.id, ids);
                  onChanged();
                }}
                onDeleted={onChanged}
                onSaved={onChanged}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function AddItemButtons({
  subtest,
  onAdd,
}: {
  subtest: Subtest;
  onAdd: (stage: Stage, block: Block) => void;
}) {
  if (subtest.structure === 'single') {
    return (
      <button className="btn btn-sm btn-primary" onClick={() => onAdd('core', 'none')}>
        문항 추가(핵심단계)
      </button>
    );
  }
  return (
    <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
      <button className="btn btn-sm" onClick={() => onAdd('core', 'none')}>
        + 핵심
      </button>
      <button className="btn btn-sm" onClick={() => onAdd('stage1', 'low')}>
        + 1단계 하
      </button>
      <button className="btn btn-sm" onClick={() => onAdd('stage1', 'high')}>
        + 1단계 상
      </button>
      <button className="btn btn-sm" onClick={() => onAdd('stage2', 'low')}>
        + 2단계 하
      </button>
      <button className="btn btn-sm" onClick={() => onAdd('stage2', 'high')}>
        + 2단계 상
      </button>
    </div>
  );
}

function ItemRow({
  item,
  index,
  count,
  expanded,
  onToggle,
  onMove,
  onDeleted,
  onSaved,
}: {
  item: Item;
  index: number;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  onMove: (dir: -1 | 1) => void;
  onDeleted: () => void;
  onSaved: () => void;
}) {
  const [confirmDel, setConfirmDel] = useState(false);
  const stageBlock =
    item.stage === 'core'
      ? stageLabel(item.stage)
      : `${stageLabel(item.stage)} ${blockLabel(item.block)}`;
  const incomplete = itemIncompleteReason(item);

  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, marginBottom: '0.5rem' }}>
      <div
        className="card-header"
        style={{ padding: '0.5rem 0.75rem', marginBottom: 0, cursor: 'pointer' }}
        onClick={onToggle}
      >
        <div>
          <strong>{item.id}</strong>{' '}
          {incomplete && (
            <span className="badge badge-warn" title={incomplete}>
              미완성
            </span>
          )}{' '}
          <span className="muted">
            · {stageBlock} · {responseFormatLabel(item.responseFormat)}
          </span>
          <div className="muted" style={{ fontSize: '0.8rem' }}>
            {item.stem ? item.stem.replace(/<[^>]*>/g, '').slice(0, 50) : '(발문 없음)'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.3rem' }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-sm" disabled={index === 0} onClick={() => onMove(-1)} aria-label="위로">
            ↑
          </button>
          <button className="btn btn-sm" disabled={index === count - 1} onClick={() => onMove(1)} aria-label="아래로">
            ↓
          </button>
          <button className="btn btn-sm" onClick={onToggle}>
            {expanded ? '접기' : '편집'}
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => setConfirmDel(true)}>
            삭제
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{ padding: '0.75rem', borderTop: '1px solid var(--color-border)' }}>
          <ItemForm item={item} onSaved={onSaved} />
        </div>
      )}

      {confirmDel && (
        <ConfirmDialog
          title="문항 삭제"
          message={`${item.id}을(를) 삭제합니다.`}
          danger
          confirmLabel="삭제"
          onConfirm={async () => {
            await deleteItem(item);
            setConfirmDel(false);
            onDeleted();
          }}
          onCancel={() => setConfirmDel(false)}
        />
      )}
    </div>
  );
}

/** 문항이 저장은 됐지만 내용이 비어 활성화를 막을 수 있는 경우를 사람 말로 설명. 없으면 null. */
function itemIncompleteReason(item: Item): string | null {
  if (!item.stem.trim()) return '발문이 비어 있습니다.';
  switch (item.responseFormat) {
    case 'simple_mc': {
      const choices = item.choices ?? [];
      if (choices.filter((c) => c.text.trim()).length < 2) return '선택지를 2개 이상 입력하세요.';
      if (!item.answer || !choices.some((c) => c.id === item.answer)) return '정답을 지정하세요.';
      break;
    }
    case 'complex_mc': {
      const rows = item.matrix?.rows ?? [];
      if (rows.length === 0 || rows.some((r) => !r.text.trim() || !r.answer)) return '진술과 각 행 정답을 채우세요.';
      break;
    }
    case 'short_auto': {
      if ((item.acceptedAnswers ?? []).filter((a) => a.trim()).length === 0) return '허용 정답을 입력하세요.';
      break;
    }
    case 'open_human': {
      const codes = item.coding ?? [];
      if (!codes.some((c) => (c.code === 1 || c.code === 2) && c.criterion.trim()))
        return 'Code 1 또는 2 채점 기준을 작성하세요.';
      break;
    }
  }
  return null;
}
