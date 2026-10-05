// 결과 화면 (Task 9, Req 11). 등급 배지 + 사유 문단. 닫은 뒤 재열람 차단.

import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../../data/db';
import { gradeLabel } from '../../data/taxonomy';
import type { Session, Grade } from '../../types';

const VIEWED_KEY = 'pisa.viewedResults';

function markViewed(sid: string) {
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(sid);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

function alreadyClosed(sid: string): boolean {
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    if (!raw) return false;
    return (JSON.parse(raw) as string[]).includes(`${sid}:closed`);
  } catch {
    return false;
  }
}

function markClosed(sid: string) {
  try {
    const raw = sessionStorage.getItem(VIEWED_KEY);
    const set = new Set<string>(raw ? JSON.parse(raw) : []);
    set.add(`${sid}:closed`);
    sessionStorage.setItem(VIEWED_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

export function ResultScreen() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sid = params.get('sid') ?? '';
  const [session, setSession] = useState<Session | null>(null);
  const [state, setState] = useState<'loading' | 'ok' | 'blocked' | 'notfound'>('loading');

  useEffect(() => {
    if (alreadyClosed(sid)) {
      setState('blocked');
      return;
    }
    (async () => {
      const s = await db.sessions.get(sid);
      if (!s || !s.result) {
        setState('notfound');
        return;
      }
      setSession(s);
      setState('ok');
      markViewed(sid);
    })();
  }, [sid]);

  function closeResult() {
    markClosed(sid);
    navigate('/', { replace: true });
  }

  if (state === 'loading') return <p className="muted">불러오는 중...</p>;
  if (state === 'blocked') {
    return (
      <section>
        <p className="notice notice-warn">이 결과는 이미 닫혔습니다. 다시 열 수 없습니다.</p>
        <button className="btn btn-primary" onClick={() => navigate('/', { replace: true })}>
          처음으로
        </button>
      </section>
    );
  }
  if (state === 'notfound' || !session || !session.result) {
    return (
      <section>
        <p className="notice notice-danger">결과를 찾을 수 없습니다.</p>
        <button className="btn" onClick={() => navigate('/', { replace: true })}>
          처음으로
        </button>
      </section>
    );
  }

  const r = session.result;
  const grade = r.grade as Grade;

  return (
    <section>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
          <span className={`grade-badge grade-${grade}`} aria-hidden="true">
            {gradeLabel(grade)}
          </span>
          <div>
            <h2 style={{ margin: 0 }}>
              '{gradeLabel(grade)}' 등급{r.provisional ? ' (잠정)' : ''}
            </h2>
            {r.provisional && (
              <p className="muted" style={{ margin: 0 }}>
                서술형 채점 후 확정됩니다.
              </p>
            )}
          </div>
        </div>

        <div className="explanation">{r.explanation}</div>
      </div>

      <button className="btn btn-primary" onClick={closeResult}>
        결과 닫기
      </button>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
        닫으면 이 결과를 다시 열 수 없습니다. 다음 응시자에게 넘겨주세요.
      </p>
    </section>
  );
}
