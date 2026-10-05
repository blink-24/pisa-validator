import { Routes, Route, NavLink, useNavigate, Navigate } from 'react-router-dom';
import { exitAdmin } from './adminSession';
import { SubtestList } from './SubtestList';
import { SubtestEditor } from '../editor/SubtestEditor';
import { ActiveSubtestScreen } from './ActiveSubtestScreen';
import { CodingQueue } from '../coding/CodingQueue';
import { PilotScreen } from '../pilot/PilotScreen';
import { ReportWizard } from '../report/ReportWizard';

/** 관리자 영역 레이아웃 + 하위 라우트. */
export function AdminHome() {
  const navigate = useNavigate();

  function leave() {
    exitAdmin();
    navigate('/');
  }

  return (
    <section>
      <div className="admin-bar">
        <nav className="admin-nav" aria-label="관리자 메뉴">
          <NavLink end className="admin-tab" to="/admin">
            소검사 목록
          </NavLink>
          <NavLink className="admin-tab" to="/admin/active">
            사용자 소검사 설정
          </NavLink>
          <NavLink className="admin-tab" to="/admin/coding">
            채점
          </NavLink>
          <NavLink className="admin-tab" to="/admin/pilot">
            파일럿·통계
          </NavLink>
          <NavLink className="admin-tab" to="/admin/report">
            보고서 작성
          </NavLink>
        </nav>
        <button className="btn btn-sm" onClick={leave}>
          관리자 나가기
        </button>
      </div>

      <Routes>
        <Route index element={<SubtestList />} />
        <Route path="subtest/:id" element={<SubtestEditor />} />
        <Route path="active" element={<ActiveSubtestScreen />} />
        <Route path="coding" element={<CodingQueue />} />
        <Route path="pilot" element={<PilotScreen />} />
        <Route path="report" element={<ReportWizard />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Routes>

      <footer className="admin-footer">
        <p className="form-hint flush">이 잠금은 오조작 방지용이며 보안 기능이 아닙니다.</p>
      </footer>
    </section>
  );
}
