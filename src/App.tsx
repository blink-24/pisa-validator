import { useState } from 'react';
import { Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { PasswordDialog } from './features/admin/PasswordDialog';
import { RequireAdmin } from './features/admin/RequireAdmin';
import { isAdmin } from './features/admin/adminSession';
import { IntroScreen } from './features/user/IntroScreen';
import { TestScreen } from './features/user/TestScreen';
import { ResultScreen } from './features/user/ResultScreen';
import { AdminHome } from './features/admin/AdminHome';

/** 전역 레이아웃: 우측 상단 ⚙ 고정 + 라우트 아웃렛. */
export default function App() {
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

  function onGear() {
    if (isAdmin()) {
      navigate('/admin');
    } else {
      setShowPassword(true);
    }
  }

  return (
    <div className="app-shell">
      {/* HashRouter라 #앵커 대신 포커스를 직접 옮긴다 */}
      <button
        type="button"
        className="skip-link"
        onClick={() => document.getElementById('main-content')?.focus()}
      >
        본문으로 건너뛰기
      </button>
      <header className="app-header">
        <div className="app-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
          </span>
          <h1 className="app-title">
            PISA형 문항 검증 플랫폼<small>시나리오 기반 읽기 평가</small>
          </h1>
        </div>
        <button className="gear-btn" onClick={onGear} aria-label="관리자 진입" title="관리자 진입">
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      <main className="app-main" id="main-content" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<IntroScreen />} />
          <Route path="/test" element={<TestScreen />} />
          <Route path="/result" element={<ResultScreen />} />
          <Route
            path="/admin/*"
            element={
              <RequireAdmin>
                <AdminHome />
              </RequireAdmin>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {showPassword && (
        <PasswordDialog
          onSuccess={() => {
            setShowPassword(false);
            navigate('/admin');
          }}
          onCancel={() => setShowPassword(false)}
        />
      )}
    </div>
  );
}
