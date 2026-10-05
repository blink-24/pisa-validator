// 소검사 목록·생성·복제·삭제·내보내기·가져오기 (Req 2).

import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '../../components/Modal';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import { BackupBanner } from './BackupBanner';
import { useAsync } from '../../hooks/useAsync';
import { listSubtestSummaries, loadBundle, type SubtestSummary } from '../../data/db';
import {
  createSubtest,
  cloneSubtest,
  deleteSubtest,
  type DeleteResultChoice,
} from '../../data/subtests';
import {
  exportSubtest,
  downloadJson,
  readJsonFile,
  validateSubtestExport,
  importSubtest,
  subtestExists,
  type SubtestExport,
  type ImportMode,
} from '../../data/transfer';
import { runConformance, hasBlockingError } from '../../core/conformance';
import { seedSampleSubtest } from '../../data/sample';

type ConfState = 'pass' | 'warn' | 'error';

async function conformanceState(subtestId: string): Promise<ConfState> {
  const b = await loadBundle(subtestId);
  if (!b) return 'error';
  const r = runConformance({
    subtest: b.subtest,
    units: b.units,
    passages: b.passages,
    items: b.items,
  });
  if (hasBlockingError(r)) return 'error';
  return r.some((x) => x.level === 'warn') ? 'warn' : 'pass';
}

const CONF_LABEL: Record<ConfState, string> = { pass: '통과', warn: '경고', error: '오류' };

export function SubtestList() {
  const navigate = useNavigate();
  const { data, loading, refresh } = useAsync(() => listSubtestSummaries(), []);
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<SubtestSummary | null>(null);
  const [importConflict, setImportConflict] = useState<SubtestExport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onCreate(input: { title: string; description: string; target: string }) {
    const st = await createSubtest(input);
    setShowCreate(false);
    navigate(`/admin/subtest/${st.id}`);
  }

  async function onClone(id: string) {
    await cloneSubtest(id);
    refresh();
  }

  async function onExport(id: string) {
    const exp = await exportSubtest(id);
    downloadJson(exp, `${exp.subtest.title || id}.json`);
  }

  async function onImportFile(file: File) {
    setError(null);
    try {
      const json = await readJsonFile(file);
      const exp = validateSubtestExport(json);
      if (await subtestExists(exp.subtest.id)) {
        setImportConflict(exp);
      } else {
        await importSubtest(exp, 'new_copy');
        refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function resolveImport(mode: ImportMode | 'cancel') {
    if (!importConflict) return;
    if (mode !== 'cancel') {
      await importSubtest(importConflict, mode);
      refresh();
    }
    setImportConflict(null);
  }

  async function confirmDelete(choice: DeleteResultChoice) {
    if (!deleteTarget) return;
    await deleteSubtest(deleteTarget.subtest.id, choice);
    setDeleteTarget(null);
    refresh();
  }

  return (
    <div>
      <BackupBanner onChanged={refresh} />

      <div className="list-header">
        <h2>소검사 목록</h2>
        <div className="row">
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            소검사 생성
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            가져오기
          </button>
          <button
            className="btn"
            onClick={async () => {
              await seedSampleSubtest();
              refresh();
            }}
          >
            샘플 소검사 추가
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onImportFile(f);
              e.target.value = '';
            }}
          />
        </div>
      </div>

      {error && (
        <p className="notice notice-danger" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="muted">불러오는 중...</p>
      ) : !data || data.length === 0 ? (
        <p className="muted">
          아직 소검사가 없습니다. '소검사 생성' 또는 '샘플 소검사 추가'로 시작하세요.
        </p>
      ) : (
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>제목</th>
                <th>단위문항</th>
                <th>문항</th>
                <th>정합성</th>
                <th>결과</th>
                <th>수정일</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {data.map((s) => (
                <SubtestRow
                  key={s.subtest.id}
                  summary={s}
                  onOpen={() => navigate(`/admin/subtest/${s.subtest.id}`)}
                  onClone={() => onClone(s.subtest.id)}
                  onExport={() => onExport(s.subtest.id)}
                  onDelete={() => setDeleteTarget(s)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateDialog onCreate={onCreate} onCancel={() => setShowCreate(false)} />}

      {deleteTarget && (
        <DeleteDialog
          title={deleteTarget.subtest.title}
          hasResults={deleteTarget.resultCount > 0}
          onChoice={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {importConflict && (
        <ConfirmImportDialog title={importConflict.subtest.title} onResolve={resolveImport} />
      )}
    </div>
  );
}

function SubtestRow({
  summary,
  onOpen,
  onClone,
  onExport,
  onDelete,
}: {
  summary: SubtestSummary;
  onOpen: () => void;
  onClone: () => void;
  onExport: () => void;
  onDelete: () => void;
}) {
  const { data: conf } = useAsync<ConfState>(
    () => conformanceState(summary.subtest.id),
    [summary.itemCount, summary.unitCount],
  );
  const s = summary.subtest;
  return (
    <tr>
      <td>
        <button className="link-btn" onClick={onOpen}>
          {s.title || '(제목 없음)'}
        </button>
        <div className="muted text-xs">{s.target}</div>
      </td>
      <td>{summary.unitCount}</td>
      <td>{summary.itemCount}</td>
      <td>
        <span className={`badge badge-${conf ?? 'warn'}`}>{conf ? CONF_LABEL[conf] : '…'}</span>
      </td>
      <td>{summary.resultCount}</td>
      <td className="muted text-xs">{new Date(s.updatedAt).toLocaleDateString('ko-KR')}</td>
      <td>
        <div className="row row-tight">
          <button className="btn btn-sm" onClick={onOpen}>
            편집
          </button>
          <button className="btn btn-sm" onClick={onClone}>
            복제
          </button>
          <button className="btn btn-sm" onClick={onExport}>
            내보내기
          </button>
          <button className="btn btn-sm btn-danger" onClick={onDelete}>
            삭제
          </button>
        </div>
      </td>
    </tr>
  );
}

function CreateDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (input: { title: string; description: string; target: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [target, setTarget] = useState('고1(만 15세)');

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    onCreate({ title: title.trim(), description: description.trim(), target: target.trim() });
  }

  return (
    <Modal title="소검사 생성" onClose={onCancel}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="st-title">제목</label>
          <input id="st-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label htmlFor="st-desc">설명</label>
          <textarea
            id="st-desc"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="st-target">대상</label>
          <input id="st-target" value={target} onChange={(e) => setTarget(e.target.value)} />
        </div>
        <div className="row row-end">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary" disabled={!title.trim()}>
            생성
          </button>
        </div>
      </form>
    </Modal>
  );
}

function DeleteDialog({
  title,
  hasResults,
  onChoice,
  onCancel,
}: {
  title: string;
  hasResults: boolean;
  onChoice: (c: DeleteResultChoice) => void;
  onCancel: () => void;
}) {
  if (!hasResults) {
    return (
      <ConfirmDialog
        title="소검사 삭제"
        message={`'${title}'을(를) 삭제합니다. 되돌릴 수 없습니다.`}
        confirmLabel="삭제"
        danger
        onConfirm={() => onChoice('delete_all')}
        onCancel={onCancel}
      />
    );
  }
  return (
    <Modal title="소검사 삭제" onClose={onCancel}>
      <p className="dialog-message">
        {`'${title}'에는 응시 결과가 있습니다.\n결과 처리 방법을 선택하세요.`}
      </p>
      <div className="stack-sm mt">
        <button className="btn btn-danger" onClick={() => onChoice('delete_all')}>
          결과도 함께 삭제
        </button>
        <button className="btn" onClick={() => onChoice('export_then_delete')}>
          결과를 JSON으로 내보낸 뒤 삭제
        </button>
        <button className="btn" onClick={() => onChoice('cancel')}>
          취소
        </button>
      </div>
    </Modal>
  );
}

function ConfirmImportDialog({
  title,
  onResolve,
}: {
  title: string;
  onResolve: (mode: ImportMode | 'cancel') => void;
}) {
  return (
    <Modal title="가져오기: ID 충돌" onClose={() => onResolve('cancel')}>
      <p className="dialog-message">
        {`'${title}'과(와) 같은 ID의 소검사가 이미 있습니다.\n어떻게 처리할까요?`}
      </p>
      <div className="stack-sm mt">
        <button className="btn btn-primary" onClick={() => onResolve('new_copy')}>
          새 사본으로 가져오기
        </button>
        <button className="btn btn-danger" onClick={() => onResolve('overwrite')}>
          덮어쓰기
        </button>
        <button className="btn" onClick={() => onResolve('cancel')}>
          취소
        </button>
      </div>
    </Modal>
  );
}
