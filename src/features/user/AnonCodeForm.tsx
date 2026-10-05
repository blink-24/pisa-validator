// 익명 응시 코드 입력 (Req 10.2). 실명(2~4자 한글) 패턴 경고.

import { useState } from 'react';

const KOREAN_NAME_RE = /^[가-힣]{2,4}$/;

export function AnonCodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [code, setCode] = useState('');
  const [nameWarn, setNameWarn] = useState(false);

  function change(v: string) {
    setCode(v);
    setNameWarn(KOREAN_NAME_RE.test(v.trim()));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
  }

  return (
    <form onSubmit={submit} className="anon-form">
      <div className="field">
        <label htmlFor="anon-code">익명 응시 코드</label>
        <input
          id="anon-code"
          value={code}
          onChange={(e) => change(e.target.value)}
          placeholder="예: A-07, 모둠3-2"
          aria-describedby="anon-code-hint"
          autoComplete="off"
          autoFocus
        />
        <span id="anon-code-hint" className="form-hint">
          실명·학번을 쓰지 마세요.
        </span>
        {nameWarn && (
          <span role="alert" className="form-warn">
            실명으로 보입니다. 익명 코드를 사용하세요.
          </span>
        )}
      </div>
      <button type="submit" className="btn btn-primary btn-lg" disabled={!code.trim()}>
        시작
      </button>
    </form>
  );
}
