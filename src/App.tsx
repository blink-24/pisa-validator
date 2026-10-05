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
      <header className="app-header">
        <h1 className="app-title">PISA형 문항 검증 플랫폼</h1>
        <button
          className="gear-btn"
          onClick={onGear}
          aria-label="관리자 진입"
          title="관리자 진입"
        >
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      <main className="app-main">
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
