// 관리자 세션 플래그 (sessionStorage). D4: 보안이 아닌 오조작 방지 잠금.
// 비밀번호 ADMIN은 소스에 노출됨을 전제로 한다 (정적 사이트).

const KEY = 'pisa.admin';
const ADMIN_PASSWORD = 'ADMIN';

export function checkPassword(input: string): boolean {
  return input === ADMIN_PASSWORD;
}

export function isAdmin(): boolean {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function enterAdmin(): void {
  try {
    sessionStorage.setItem(KEY, '1');
  } catch {
    /* sessionStorage 불가 시 무시 */
  }
}

export function exitAdmin(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
