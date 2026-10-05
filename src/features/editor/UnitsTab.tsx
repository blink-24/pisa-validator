// 단위·지문 탭 (Task 4.1, Req 3). 시나리오 도입문·지문 편집·이미지·출처·속성 select.

import { useState } from 'react';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { AssetImage } from '../../components/AssetImage';
import { TaxSelect } from '../../components/TaxSelect';
import {
  passageSituationOptions,
  passageTextFormatOptions,
  passageTextTypeOptions,
  passageOrganizationOptions,
} from '../../data/taxonomy';
import { sanitizeHtml } from '../../core/sanitize';
import { saveImageFile } from '../../data/assets';
import {
  addUnit,
  updateUnit,
  deleteUnit,
  addPassage,
  updatePassage,
  deletePassage,
} from '../../data/editorRepo';
import type { Unit, Passage } from '../../types';

export function UnitsTab({
  subtestId,
  units,
  passages,
  onChanged,
}: {
  subtestId: string;
  units: Unit[];
  passages: Passage[];
  onChanged: () => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <button
          className="btn btn-primary"
          onClick={async () => {
            await addUnit(subtestId);
            onChanged();
          }}
        >
          단위문항 추가
        </button>
      </div>

      {units.length === 0 && <p className="muted">단위문항이 없습니다. 추가하세요.</p>}

      {units.map((unit) => (
        <UnitCard
          key={unit.id}
          unit={unit}
          passages={passages.filter((p) => unit.passageIds.includes(p.id))}
          onChanged={onChanged}
        />
      ))}
    </div>
  );
}

function UnitCard({
  unit,
  passages,
  onChanged,
}: {
  unit: Unit;
  passages: Passage[];
  onChanged: () => void;
}) {
  const [title, setTitle] = useState(unit.title);
  const [scenario, setScenario] = useState(unit.scenarioIntro);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function saveUnit() {
    await updateUnit({ ...unit, title, scenarioIntro: scenario });
    onChanged();
  }

  const multiSource = passages.length >= 2;

  return (
    <div className="card">
      <div className="card-header">
        <h3>단위문항 {unit.unitNo}</h3>
        <button className="btn btn-sm btn-danger" onClick={() => setConfirmDelete(true)}>
          단위 삭제
        </button>
      </div>

      <div className="field">
        <label>제목</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} onBlur={saveUnit} />
      </div>
      <div className="field">
        <label>시나리오 도입문 (학생에게 읽기 목적 제시)</label>
        <textarea
          rows={3}
          value={scenario}
          onChange={(e) => setScenario(e.target.value)}
          onBlur={saveUnit}
        />
      </div>

      <div className="card-header mt">
        <strong>지문 ({passages.length})</strong>
        <div className="row">
          {multiSource && <span className="badge badge-pass">텍스트 출처: 다중 (자동)</span>}
          <button
            className="btn btn-sm"
            onClick={async () => {
              await addPassage(unit);
              onChanged();
            }}
          >
            지문 추가
          </button>
        </div>
      </div>

      {passages.map((p) => (
        <PassageEditor
          key={p.id}
          passage={p}
          subtestId={unit.subtestId}
          onDelete={async () => {
            await deletePassage(unit, p.id);
            onChanged();
          }}
          onChanged={onChanged}
        />
      ))}

      {confirmDelete && (
        <ConfirmDialog
          title="단위문항 삭제"
          message={`단위문항 ${unit.unitNo}과(와) 그 지문·문항을 모두 삭제합니다.`}
          danger
          confirmLabel="삭제"
          onConfirm={async () => {
            await deleteUnit(unit);
            setConfirmDelete(false);
            onChanged();
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  );
}

function PassageEditor({
  passage,
  subtestId,
  onDelete,
  onChanged,
}: {
  passage: Passage;
  subtestId: string;
  onDelete: () => void;
  onChanged: () => void;
}) {
  const [draft, setDraft] = useState<Passage>(passage);

  function set<K extends keyof Passage>(key: K, value: Passage[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }
  function setSource(key: keyof Passage['source'], value: string) {
    setDraft((d) => ({ ...d, source: { ...d.source, [key]: value } }));
  }

  async function save(next: Passage = draft) {
    const cleaned = { ...next, bodyHtml: sanitizeHtml(next.bodyHtml) };
    await updatePassage(cleaned, subtestId);
    onChanged();
  }

  async function onUpload(file: File) {
    const assetId = await saveImageFile(file);
    const next = { ...draft, imageIds: [...draft.imageIds, assetId] };
    setDraft(next);
    await save(next);
  }

  return (
    <div className="card" style={{ background: 'var(--color-surface)' }}>
      <div className="card-header">
        <input
          placeholder="지문 제목"
          value={draft.title}
          onChange={(e) => set('title', e.target.value)}
          onBlur={() => save()}
          style={{ fontWeight: 600, flex: 1 }}
        />
        <button className="btn btn-sm btn-danger" onClick={onDelete}>
          지문 삭제
        </button>
      </div>

      <div className="field">
        <label>
          본문 (허용 서식: &lt;p&gt; &lt;strong&gt; &lt;em&gt; &lt;ul/ol/li&gt; &lt;table&gt;
          &lt;h3/h4&gt;)
        </label>
        <textarea
          rows={6}
          value={draft.bodyHtml}
          onChange={(e) => set('bodyHtml', e.target.value)}
          onBlur={() => save()}
        />
      </div>

      <div className="field">
        <label>이미지</label>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onUpload(f);
            e.target.value = '';
          }}
        />
        <div className="row mt-xs">
          {draft.imageIds.map((imgId) => (
            <div key={imgId} style={{ maxWidth: 160 }}>
              <AssetImage assetId={imgId} alt="지문 이미지" />
              <button
                className="btn btn-sm"
                onClick={() => {
                  const next = { ...draft, imageIds: draft.imageIds.filter((x) => x !== imgId) };
                  setDraft(next);
                  save(next);
                }}
              >
                제거
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="field-row">
        <TaxSelect
          label="상황"
          value={draft.situation}
          options={passageSituationOptions}
          onChange={(c) => {
            const next = { ...draft, situation: c };
            setDraft(next);
            save(next);
          }}
        />
        <TaxSelect
          label="텍스트 체재"
          value={draft.textFormat}
          options={passageTextFormatOptions}
          onChange={(c) => {
            const next = { ...draft, textFormat: c };
            setDraft(next);
            save(next);
          }}
        />
        <TaxSelect
          label="텍스트 유형"
          value={draft.textType}
          options={passageTextTypeOptions}
          onChange={(c) => {
            const next = { ...draft, textType: c };
            setDraft(next);
            save(next);
          }}
        />
        <TaxSelect
          label="조직 및 탐색 구조"
          value={draft.organization}
          options={passageOrganizationOptions}
          onChange={(c) => {
            const next = { ...draft, organization: c };
            setDraft(next);
            save(next);
          }}
        />
      </div>

      <fieldset className="box">
        <legend>출처 정보</legend>
        <div className="field-row">
          <div className="field">
            <label>저자</label>
            <input
              value={draft.source.author ?? ''}
              onChange={(e) => setSource('author', e.target.value)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>작품명</label>
            <input
              value={draft.source.work ?? ''}
              onChange={(e) => setSource('work', e.target.value)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>발행처</label>
            <input
              value={draft.source.publisher ?? ''}
              onChange={(e) => setSource('publisher', e.target.value)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>연도</label>
            <input
              value={draft.source.year ?? ''}
              onChange={(e) => setSource('year', e.target.value)}
              onBlur={() => save()}
            />
          </div>
          <div className="field">
            <label>쪽</label>
            <input
              value={draft.source.pages ?? ''}
              onChange={(e) => setSource('pages', e.target.value)}
              onBlur={() => save()}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
}
