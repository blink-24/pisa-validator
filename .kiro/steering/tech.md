# Tech Steering

## 스택 (고정)
- 빌드: Vite + React 18 + TypeScript (strict)
- 라우팅: `HashRouter` (GitHub Pages에서 새로고침 시 404 방지)
- 저장: IndexedDB via Dexie. `localStorage`는 사용하지 않는다(용량·이미지 문제). 세션 플래그만 `sessionStorage`.
- 상태: React Context + useReducer. 별도 상태 라이브러리 도입 금지.
- 스타일: CSS Modules 또는 단일 CSS. UI 프레임워크 대형 의존성 지양.
- 보고서:
  - HWPX: JSZip으로 압축 패키지 생성. 한글에서 만든 빈 템플릿(`public/templates/report-template.hwpx`)을 풀어 `Contents/section0.xml`에 문단·표를 삽입하고 이미지를 `BinData/`에 추가.
  - PDF: html2canvas로 보고서 HTML을 페이지 단위 래스터화 → jsPDF. (한글 글꼴 임베드 문제를 피하기 위함. 텍스트 선택 불가는 v1 허용 한계)
  - 문항 캡처: 학생 화면과 동일한 컴포넌트를 화면 밖에서 렌더링 후 html2canvas → PNG.
- 폰트: 나눔고딕 또는 Pretendard를 저장소에 포함(OFL 라이선스 확인). 외부 CDN 금지.
- 테스트: Vitest(로직: 채점·경로·등급·정합성 점검·통계), Playwright는 선택.
- 배포: GitHub Actions → `actions/deploy-pages`. `vite.config.ts`의 `base`를 `/<저장소이름>/`으로.

## 코딩 규칙
- 순수 로직(채점, 경로 결정, 등급 산출, 사유 문장 생성, 통계)은 `src/core/`에 UI와 분리하고 단위 테스트를 반드시 작성한다.
- 개념어는 코드값(`code`)으로 저장하고 표시는 `taxonomy.ko.json`의 `label`로 한다. 문자열 하드코딩 금지.
- 모든 IndexedDB 스키마 변경은 Dexie `version()` 증가와 마이그레이션 함수로 처리한다.
- 날짜는 ISO 8601 문자열로 저장한다.
- 삭제는 확인 대화상자 필수. 소검사 삭제 시 해당 결과 데이터 처리 방식을 묻는다.
- 외부 네트워크 요청 코드 금지(`fetch`는 동일 출처 정적 파일에만).

## 알려진 함정
- GitHub Pages는 서버가 없다: API 키, 비밀값, 서버 집계 코드를 넣지 말 것.
- HWPX 편집 시 `<hp:linesegarray>`가 남으면 한글에서 글자가 겹친다 → 생성 문단에 넣지 말고, 템플릿 문단을 복제할 때는 제거.
- 템플릿 표 셀의 큰 고정 높이(`cellSz height`)는 페이지 밀림 원인 → 내용 셀은 작게 두고 자동 확장.
- iOS Safari 시크릿 모드는 IndexedDB 영속성이 제한적 → 첫 화면에서 경고.
