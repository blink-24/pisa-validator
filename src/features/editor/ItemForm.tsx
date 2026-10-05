// 문항 편집 폼 (Task 4.2-4.4, Req 4·5). 4속성 필수 검증, 형식별 UI, 채점기준.

import { useState } from 'react';
import { TaxSelect, CognitiveProcessSelect } from '../../components/TaxSelect';
import {
  responseFormatOptions,
  sourceRequirementOptions,
  difficultyOptions,
  expectedLevelOptions,
  itemTagOptions,
  codingOptions,
} from '../../data/taxonomy';
import { uid } from '../../core/ids';
import { updateItem, itemIdExists } from '../../data/editorRepo';
import type { Item, ResponseFormat, Choice, ComplexMatrix, CodingCriterion, CodingValue } from '../../types';

export function ItemForm({ item, onSaved }: { item: Item; onSaved: () => void }) {
  const [draft, setDraft] = useState<Item>(normalize(item));
  const [idError, setIdError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function set<K extends keyof Item>(key: K, value: Item[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setSaved(false);
  }

  function changeFormat(fmt: ResponseFormat) {
    setDraft((d) => normalize({ ...d, responseFormat: fmt }));
    setSaved(false);
  }

  async function save() {
    setIdError(null);
    // 필수 4속성 검증 (Req 4.1)
    if (!draft.cognitiveProcess || !draft.responseFormat || !draft.sourceRequirement || !draft.difficulty) {
      setIdError('인지 과정·응답 형식·출처 요구·난도는 필수입니다.');
      return;
    }
    // 구성형(교사 채점) 최소 Code 1 또는 2 (Req 5.1)
    if (draft.responseFormat === 'open_human') {
      const codes = draft.coding ?? [];
      if (!codes.some((c) => (c.code === 1 || c.code === 2) && c.criterion.trim())) {
        setIdError('구성형(교사 채점)은 Code 1 또는 Code 2 기준 중 하나 이상을 작성해야 합니다.');
        return;
      }
    }
    // ID 변경 시 중복 검사 (Req 4.4)
    if (draft.id !== item.id && (await itemIdExists(draft.id, item.id))) {
      setIdError(`문항 ID '${draft.id}'가 이미 존재합니다.`);
      return;
    }
    await updateItem(draft);
    setSaved(true);
    onSaved();
  }

  return (
    <div>
      <div className="field-row">
        <div className="field">
          <label>문항 ID</label>
          <input value={draft.id} onChange={(e) => set('id', e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label>발문</label>
        <textarea rows={2} value={draft.stem} onChange={(e) => set('stem', e.target.value)} />
      </div>

      <div className="field-row">
        <CognitiveProcessSelect value={draft.cognitiveProcess} onChange={(c) => set('cognitiveProcess', c)} />
        <TaxSelect
          label="응답 형식"
          required
          value={draft.responseFormat}
          options={responseFormatOptions}
          onChange={(c) => changeFormat(c as ResponseFormat)}
        />
        <TaxSelect
          label="출처 요구"
          required
          value={draft.sourceRequirement}
          options={sourceRequirementOptions}
          onChange={(c) => set('sourceRequirement', c as Item['sourceRequirement'])}
        />
        <TaxSelect
          label="난도"
          required
          value={draft.difficulty}
          options={difficultyOptions}
          onChange={(c) => set('difficulty', c as Item['difficulty'])}
        />
      </div>

      {/* 형식별 입력 UI */}
      {draft.responseFormat === 'simple_mc' && <SimpleMcEditor draft={draft} setDraft={setDraft} />}
      {draft.responseFormat === 'complex_mc' && <ComplexMcEditor draft={draft} setDraft={setDraft} />}
      {draft.responseFormat === 'short_auto' && <ShortAutoEditor draft={draft} setDraft={setDraft} />}
      {draft.responseFormat === 'open_human' && <CodingEditor draft={draft} setDraft={setDraft} />}

      {/* 해설 */}
      <div className="field">
        <label>해설 (왜 정답인지, 오답 유형)</label>
        <textarea
          rows={2}
          value={draft.commentary ?? ''}
          onChange={(e) => set('commentary', e.target.value)}
        />
      </div>

      {/* 선택 속성 */}
      <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
        <legend>선택 속성</legend>
        <div className="field-row">
          <div className="field">
            <label>예상 성취수준</label>
            <select
              value={draft.expectedLevel ?? ''}
              onChange={(e) => set('expectedLevel', e.target.value || undefined)}
            >
              <option value="">(미지정)</option>
              {expectedLevelOptions.map((lv) => (
                <option key={lv} value={lv}>
                  {lv}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>문항 의도 (자유 입력)</label>
            <input
              value={draft.questionIntent ?? ''}
              onChange={(e) => set('questionIntent', e.target.value)}
            />
          </div>
        </div>
        <div className="field">
          <label>검증용 태그</label>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
            {itemTagOptions.map((t) => {
              const checked = (draft.tags ?? []).includes(t.code);
              return (
                <label key={t.code} style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    style={{ width: 'auto', marginRight: '0.3rem' }}
                    onChange={(e) => {
                      const tags = new Set(draft.tags ?? []);
                      if (e.target.checked) tags.add(t.code);
                      else tags.delete(t.code);
                      set('tags', [...tags]);
                    }}
                  />
                  {t.label}
                  <span className="ext-tag">확장</span>
                </label>
              );
            })}
          </div>
        </div>
      </fieldset>

      {idError && (
        <p className="notice notice-danger" role="alert">
          {idError}
        </p>
      )}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.5rem' }}>
        <button className="btn btn-primary" onClick={save}>
          문항 저장
        </button>
        {saved && <span className="muted">저장됨</span>}
      </div>
    </div>
  );
}

/** 형식에 맞게 payload를 보정(없는 필드 초기화). */
function normalize(item: Item): Item {
  const out: Item = { ...item };
  switch (item.responseFormat) {
    case 'simple_mc':
      if (!out.choices || out.choices.length < 2) {
        out.choices = [
          { id: uid('c'), text: '' },
          { id: uid('c'), text: '' },
        ];
      }
      if (out.answer == null) out.answer = '';
      break;
    case 'complex_mc':
      if (!out.matrix) {
        out.matrix = {
          rows: [{ id: uid('r'), text: '', answer: '' }],
          cols: ['예', '아니오'],
          fullCredit: 'all',
        };
      }
      break;
    case 'short_auto':
      if (!out.acceptedAnswers) out.acceptedAnswers = [''];
      if (!out.normalize) out.normalize = { ignoreSpace: true, ignoreCase: true };
      break;
    case 'open_human':
      if (!out.coding || out.coding.length === 0) {
        out.coding = codingOptions.map((c) => ({
          code: c.code as CodingValue,
          criterion: '',
          examples: [],
        }));
      }
      break;
  }
  return out;
}

// ---- simple_mc ----
function SimpleMcEditor({ draft, setDraft }: { draft: Item; setDraft: React.Dispatch<React.SetStateAction<Item>> }) {
  const choices = draft.choices ?? [];
  function update(choices: Choice[], answer?: string) {
    setDraft((d) => ({ ...d, choices, ...(answer !== undefined ? { answer } : {}) }));
  }
  return (
    <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
      <legend>단순선다형 (선택지 2~6개, 정답 1개)</legend>
      {choices.map((c, i) => (
        <div key={c.id} className="inline-fields" style={{ marginBottom: '0.4rem' }}>
          <label style={{ fontWeight: 400 }}>
            <input
              type="radio"
              name={`ans-${draft.id}`}
              checked={draft.answer === c.id}
              onChange={() => update(choices, c.id)}
              style={{ width: 'auto', marginRight: '0.3rem' }}
            />
            정답
          </label>
          <input
            style={{ flex: 1, minWidth: 180 }}
            placeholder={`보기 ${i + 1}`}
            value={c.text}
            onChange={(e) => update(choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))}
          />
          <button
            className="btn btn-sm btn-danger"
            disabled={choices.length <= 2}
            onClick={() => update(choices.filter((x) => x.id !== c.id))}
          >
            삭제
          </button>
        </div>
      ))}
      <button
        className="btn btn-sm"
        disabled={choices.length >= 6}
        onClick={() => update([...choices, { id: uid('c'), text: '' }])}
      >
        선택지 추가
      </button>
    </fieldset>
  );
}

// ---- complex_mc ----
function ComplexMcEditor({ draft, setDraft }: { draft: Item; setDraft: React.Dispatch<React.SetStateAction<Item>> }) {
  const matrix = draft.matrix!;
  function setMatrix(next: ComplexMatrix) {
    setDraft((d) => ({ ...d, matrix: next }));
  }
  return (
    <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
      <legend>복합선다형 (진술 × 선택 열)</legend>
      <div className="field">
        <label>선택 열 (쉼표로 구분)</label>
        <input
          value={matrix.cols.join(', ')}
          onChange={(e) => setMatrix({ ...matrix, cols: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
        />
      </div>
      {matrix.rows.map((row) => (
        <div key={row.id} className="inline-fields" style={{ marginBottom: '0.4rem' }}>
          <input
            style={{ flex: 1, minWidth: 160 }}
            placeholder="진술"
            value={row.text}
            onChange={(e) =>
              setMatrix({ ...matrix, rows: matrix.rows.map((r) => (r.id === row.id ? { ...r, text: e.target.value } : r)) })
            }
          />
          <select
            value={row.answer}
            onChange={(e) =>
              setMatrix({ ...matrix, rows: matrix.rows.map((r) => (r.id === row.id ? { ...r, answer: e.target.value } : r)) })
            }
          >
            <option value="">정답 열</option>
            {matrix.cols.map((col) => (
              <option key={col} value={col}>
                {col}
              </option>
            ))}
          </select>
          <button
            className="btn btn-sm btn-danger"
            disabled={matrix.rows.length <= 1}
            onClick={() => setMatrix({ ...matrix, rows: matrix.rows.filter((r) => r.id !== row.id) })}
          >
            삭제
          </button>
        </div>
      ))}
      <div className="inline-fields">
        <button
          className="btn btn-sm"
          onClick={() => setMatrix({ ...matrix, rows: [...matrix.rows, { id: uid('r'), text: '', answer: '' }] })}
        >
          진술 추가
        </button>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>만점 조건</label>
          <select
            value={matrix.fullCredit === 'all' ? 'all' : String(matrix.fullCredit)}
            onChange={(e) =>
              setMatrix({ ...matrix, fullCredit: e.target.value === 'all' ? 'all' : Number(e.target.value) })
            }
          >
            <option value="all">전부 정답</option>
            {matrix.rows.map((_, i) => (
              <option key={i} value={i + 1}>
                {i + 1}행 이상 정답
              </option>
            ))}
          </select>
        </div>
      </div>
    </fieldset>
  );
}

// ---- short_auto ----
function ShortAutoEditor({ draft, setDraft }: { draft: Item; setDraft: React.Dispatch<React.SetStateAction<Item>> }) {
  const answers = draft.acceptedAnswers ?? [''];
  const norm = draft.normalize ?? { ignoreSpace: true, ignoreCase: true };
  function setAnswers(next: string[]) {
    setDraft((d) => ({ ...d, acceptedAnswers: next }));
  }
  return (
    <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
      <legend>구성형(자동 채점·단답 일치)</legend>
      {answers.map((a, i) => (
        <div key={i} className="inline-fields" style={{ marginBottom: '0.4rem' }}>
          <input
            style={{ flex: 1, minWidth: 180 }}
            placeholder="허용 정답"
            value={a}
            onChange={(e) => setAnswers(answers.map((x, j) => (j === i ? e.target.value : x)))}
          />
          <button
            className="btn btn-sm btn-danger"
            disabled={answers.length <= 1}
            onClick={() => setAnswers(answers.filter((_, j) => j !== i))}
          >
            삭제
          </button>
        </div>
      ))}
      <div className="inline-fields">
        <button className="btn btn-sm" onClick={() => setAnswers([...answers, ''])}>
          정답 추가
        </button>
        <label style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={norm.ignoreSpace}
            style={{ width: 'auto', marginRight: '0.3rem' }}
            onChange={(e) => setDraft((d) => ({ ...d, normalize: { ...norm, ignoreSpace: e.target.checked } }))}
          />
          공백 무시
        </label>
        <label style={{ fontWeight: 400 }}>
          <input
            type="checkbox"
            checked={norm.ignoreCase}
            style={{ width: 'auto', marginRight: '0.3rem' }}
            onChange={(e) => setDraft((d) => ({ ...d, normalize: { ...norm, ignoreCase: e.target.checked } }))}
          />
          대소문자 무시
        </label>
      </div>
    </fieldset>
  );
}

// ---- open_human coding ----
function CodingEditor({ draft, setDraft }: { draft: Item; setDraft: React.Dispatch<React.SetStateAction<Item>> }) {
  const coding = draft.coding ?? [];
  function setCode(code: CodingValue, patch: Partial<CodingCriterion>) {
    setDraft((d) => ({
      ...d,
      coding: (d.coding ?? []).map((c) => (c.code === code ? { ...c, ...patch } : c)),
    }));
  }
  return (
    <fieldset style={{ border: '1px solid var(--color-border)', borderRadius: 6, padding: '0.75rem' }}>
      <legend>채점 기준 (Code 2/1/0/9, 예시 답안)</legend>
      {codingOptions.map((co) => {
        const entry = coding.find((c) => c.code === co.code) ?? { code: co.code as CodingValue, criterion: '', examples: [] };
        return (
          <div key={co.code} className="card" style={{ background: 'var(--color-surface)', padding: '0.6rem' }}>
            <strong>{co.label}</strong>
            <div className="field">
              <label>기준 문장</label>
              <textarea
                rows={2}
                value={entry.criterion}
                onChange={(e) => setCode(co.code as CodingValue, { criterion: e.target.value })}
              />
            </div>
            <div className="field">
              <label>예시 답안 (줄바꿈으로 구분)</label>
              <textarea
                rows={2}
                value={entry.examples.join('\n')}
                onChange={(e) =>
                  setCode(co.code as CodingValue, { examples: e.target.value.split('\n').filter((s) => s.trim()) })
                }
              />
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
