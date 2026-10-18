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
import { hasExplicitPassages } from '../../core/itemPassages';
import type {
  Item,
  Passage,
  ResponseFormat,
  Choice,
  ComplexMatrix,
  CodingCriterion,
  CodingValue,
} from '../../types';

export function ItemForm({
  item,
  unitPassages,
  onSaved,
}: {
  item: Item;
  unitPassages: Passage[];
  onSaved: () => void;
}) {
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
    if (
      !draft.cognitiveProcess ||
      !draft.responseFormat ||
      !draft.sourceRequirement ||
      !draft.difficulty
    ) {
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
    await updateItem(withCleanPassageIds(draft, unitPassages));
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
        <CognitiveProcessSelect
          value={draft.cognitiveProcess}
          onChange={(c) => set('cognitiveProcess', c)}
        />
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

      <PassagePicker
        draft={draft}
        unitPassages={unitPassages}
        onChange={(ids) => set('passageIds', ids)}
      />

      {/* 형식별 입력 UI */}
      {draft.responseFormat === 'simple_mc' && <SimpleMcEditor draft={draft} setDraft={setDraft} />}
      {draft.responseFormat === 'complex_mc' && (
        <ComplexMcEditor draft={draft} setDraft={setDraft} />
      )}
      {draft.responseFormat === 'short_auto' && (
        <ShortAutoEditor draft={draft} setDraft={setDraft} />
      )}
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
      <fieldset className="box">
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
          <div className="row row-loose">
            {itemTagOptions.map((t) => {
              const checked = (draft.tags ?? []).includes(t.code);
              return (
                <label key={t.code} className="fw-normal">
                  <input
                    type="checkbox"
                    checked={checked}
                    className="inline-control"
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
      <div className="row mt-xs">
        <button className="btn btn-primary" onClick={save}>
          문항 저장
        </button>
        {saved && <span className="muted">저장됨</span>}
      </div>
    </div>
  );
}

/** 형식에 맞게 payload를 보정(없는 필드 초기화). */
/** 저장 전 정리: 단위에 없는 지문 ID를 빼고, 남는 게 없으면 지정 해제(= 단위 지문 전체) */
function withCleanPassageIds(item: Item, unitPassages: Passage[]): Item {
  if (!item.passageIds) return item;
  const inUnit = new Set(unitPassages.map((p) => p.id));
  const out: Item = { ...item, passageIds: item.passageIds.filter((id) => inUnit.has(id)) };
  if (!out.passageIds!.length) delete out.passageIds;
  return out;
}

/**
 * '다루는 지문' 체크박스 (Req 4.11). 지정이 없으면 단위의 지문 전체가 선택된 상태로 보인다.
 * 한 번 바꾸면 그 선택이 저장된다. 마지막 하나는 해제할 수 없다.
 */
function PassagePicker({
  draft,
  unitPassages,
  onChange,
}: {
  draft: Item;
  unitPassages: Passage[];
  onChange: (ids: string[]) => void;
}) {
  if (unitPassages.length === 0) {
    return (
      <div className="field">
        <label>다루는 지문</label>
        <p className="form-hint">
          이 단위문항에 지문이 없습니다. '단위·지문' 탭에서 지문을 먼저 추가하세요.
        </p>
      </div>
    );
  }
  const unitIds = unitPassages.map((p) => p.id);
  const checked = new Set(
    hasExplicitPassages(draft) ? draft.passageIds!.filter((id) => unitIds.includes(id)) : unitIds,
  );
  if (checked.size === 0) unitIds.forEach((id) => checked.add(id)); // 모두 단위 밖 ID였던 경우
  const n = checked.size;
  const warn =
    draft.sourceRequirement === 'single' && n >= 2
      ? "출처 요구가 '단일'인데 지문을 2개 이상 골랐습니다."
      : draft.sourceRequirement === 'multiple' && n === 1 && unitIds.length >= 2
        ? "출처 요구가 '다중'인데 지문을 1개만 골랐습니다."
        : null;

  function toggle(id: string) {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(unitIds.filter((x) => next.has(x)));
  }

  return (
    <fieldset className="box">
      <legend>다루는 지문</legend>
      <div className="stack-sm">
        {unitPassages.map((p, i) => {
          const on = checked.has(p.id);
          return (
            <label key={p.id} className="fw-normal">
              <input
                type="checkbox"
                className="inline-control"
                checked={on}
                disabled={on && n === 1}
                onChange={() => toggle(p.id)}
              />
              {p.title.trim() || `(제목 없음) 지문 ${i + 1}`}
            </label>
          );
        })}
      </div>
      <p className="form-hint">
        보고서의 상황·체재·유형은 여기서 고른 지문으로 계산합니다. 고르지 않으면 단위의 지문 전체로
        봅니다.
      </p>
      {warn && <p className="form-warn">{warn}</p>}
    </fieldset>
  );
}

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
function SimpleMcEditor({
  draft,
  setDraft,
}: {
  draft: Item;
  setDraft: React.Dispatch<React.SetStateAction<Item>>;
}) {
  const choices = draft.choices ?? [];
  function update(choices: Choice[], answer?: string) {
    setDraft((d) => ({ ...d, choices, ...(answer !== undefined ? { answer } : {}) }));
  }
  return (
    <fieldset className="box">
      <legend>단순선다형 (선택지 2~6개, 정답 1개)</legend>
      {choices.map((c, i) => (
        <div key={c.id} className="inline-fields mb-xs">
          <label className="fw-normal">
            <input
              type="radio"
              name={`ans-${draft.id}`}
              checked={draft.answer === c.id}
              onChange={() => update(choices, c.id)}
              className="inline-control"
            />
            정답
          </label>
          <input
            className="grow"
            placeholder={`보기 ${i + 1}`}
            value={c.text}
            onChange={(e) =>
              update(choices.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))
            }
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
function ComplexMcEditor({
  draft,
  setDraft,
}: {
  draft: Item;
  setDraft: React.Dispatch<React.SetStateAction<Item>>;
}) {
  const matrix = draft.matrix!;
  function setMatrix(next: ComplexMatrix) {
    setDraft((d) => ({ ...d, matrix: next }));
  }
  return (
    <fieldset className="box">
      <legend>복합선다형 (진술 × 선택 열)</legend>
      <div className="field">
        <label>선택 열 (쉼표로 구분)</label>
        <input
          value={matrix.cols.join(', ')}
          onChange={(e) =>
            setMatrix({
              ...matrix,
              cols: e.target.value
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean),
            })
          }
        />
      </div>
      {matrix.rows.map((row) => (
        <div key={row.id} className="inline-fields mb-xs">
          <input
            style={{ flex: 1, minWidth: 160 }}
            placeholder="진술"
            value={row.text}
            onChange={(e) =>
              setMatrix({
                ...matrix,
                rows: matrix.rows.map((r) =>
                  r.id === row.id ? { ...r, text: e.target.value } : r,
                ),
              })
            }
          />
          <select
            value={row.answer}
            onChange={(e) =>
              setMatrix({
                ...matrix,
                rows: matrix.rows.map((r) =>
                  r.id === row.id ? { ...r, answer: e.target.value } : r,
                ),
              })
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
            onClick={() =>
              setMatrix({ ...matrix, rows: matrix.rows.filter((r) => r.id !== row.id) })
            }
          >
            삭제
          </button>
        </div>
      ))}
      <div className="inline-fields">
        <button
          className="btn btn-sm"
          onClick={() =>
            setMatrix({ ...matrix, rows: [...matrix.rows, { id: uid('r'), text: '', answer: '' }] })
          }
        >
          진술 추가
        </button>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>만점 조건</label>
          <select
            value={matrix.fullCredit === 'all' ? 'all' : String(matrix.fullCredit)}
            onChange={(e) =>
              setMatrix({
                ...matrix,
                fullCredit: e.target.value === 'all' ? 'all' : Number(e.target.value),
              })
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
function ShortAutoEditor({
  draft,
  setDraft,
}: {
  draft: Item;
  setDraft: React.Dispatch<React.SetStateAction<Item>>;
}) {
  const answers = draft.acceptedAnswers ?? [''];
  const norm = draft.normalize ?? { ignoreSpace: true, ignoreCase: true };
  function setAnswers(next: string[]) {
    setDraft((d) => ({ ...d, acceptedAnswers: next }));
  }
  return (
    <fieldset className="box">
      <legend>구성형(자동 채점·단답 일치)</legend>
      {answers.map((a, i) => (
        <div key={i} className="inline-fields mb-xs">
          <input
            className="grow"
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
        <label className="fw-normal">
          <input
            type="checkbox"
            checked={norm.ignoreSpace}
            className="inline-control"
            onChange={(e) =>
              setDraft((d) => ({ ...d, normalize: { ...norm, ignoreSpace: e.target.checked } }))
            }
          />
          공백 무시
        </label>
        <label className="fw-normal">
          <input
            type="checkbox"
            checked={norm.ignoreCase}
            className="inline-control"
            onChange={(e) =>
              setDraft((d) => ({ ...d, normalize: { ...norm, ignoreCase: e.target.checked } }))
            }
          />
          대소문자 무시
        </label>
      </div>
    </fieldset>
  );
}

// ---- open_human coding ----
function CodingEditor({
  draft,
  setDraft,
}: {
  draft: Item;
  setDraft: React.Dispatch<React.SetStateAction<Item>>;
}) {
  const coding = draft.coding ?? [];
  function setCode(code: CodingValue, patch: Partial<CodingCriterion>) {
    setDraft((d) => ({
      ...d,
      coding: (d.coding ?? []).map((c) => (c.code === code ? { ...c, ...patch } : c)),
    }));
  }
  return (
    <fieldset className="box">
      <legend>채점 기준 (Code 2/1/0/9, 예시 답안)</legend>
      {codingOptions.map((co) => {
        const entry = coding.find((c) => c.code === co.code) ?? {
          code: co.code as CodingValue,
          criterion: '',
          examples: [],
        };
        return (
          <div
            key={co.code}
            className="card"
            style={{ background: 'var(--color-surface)', padding: '0.6rem' }}
          >
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
                  setCode(co.code as CodingValue, {
                    examples: e.target.value.split('\n').filter((s) => s.trim()),
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </fieldset>
  );
}
