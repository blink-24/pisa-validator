import { useState } from 'react';
import { Modal } from '../../components/Modal';
import { checkPassword, enterAdmin } from './adminSession';

interface PasswordDialogProps {
  onSuccess: () => void;
  onCancel: () => void;
}

/** Req 1.2~1.4: ⚙ → 비밀번호 입력. ADMIN 일치 시 입장, 불일치 시 오류 표시 후 머묾. */
export function PasswordDialog({ onSuccess, onCancel }: PasswordDialogProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (checkPassword(value)) {
      enterAdmin();
      onSuccess();
    } else {
      setError(true);
    }
  }

  return (
    <Modal title="관리자 진입" onClose={onCancel}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="admin-pw">관리자 비밀번호</label>
          <input
            id="admin-pw"
            type="password"
            value={value}
            autoComplete="off"
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
          />
          {error && (
            <span role="alert" className="form-error">
              비밀번호가 올바르지 않습니다. 다시 입력하세요.
            </span>
          )}
        </div>
        <p className="form-hint flush">이 잠금은 오조작 방지용이며 보안 기능이 아닙니다.</p>
        <div className="dialog-actions">
          <button type="button" className="btn" onClick={onCancel}>
            취소
          </button>
          <button type="submit" className="btn btn-primary">
            입장
          </button>
        </div>
      </form>
    </Modal>
  );
}
