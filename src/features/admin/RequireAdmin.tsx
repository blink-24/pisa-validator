import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { isAdmin } from './adminSession';

/** 관리자 라우트 가드 (Req 1.3). 플래그 없으면 사용자 홈으로. */
export function RequireAdmin({ children }: { children: ReactNode }) {
  if (!isAdmin()) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}
