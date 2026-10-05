# Structure Steering

```
/
├─ .github/workflows/deploy.yml      # Pages 배포
├─ public/
│  ├─ fonts/                         # 저장소 포함 한글 폰트
│  └─ templates/report-template.hwpx # 한글에서 만든 빈 보고서 템플릿
├─ src/
│  ├─ data/
│  │  ├─ taxonomy.ko.json            # 평가틀 개념어 사전 (유일한 출처)
│  │  └─ sample-subtest.json         # 자작 지문 샘플 (저작권 없는 텍스트만)
│  ├─ core/                          # 순수 로직 + 테스트
│  │  ├─ scoring.ts                  # 자동 채점
│  │  ├─ routing.ts                  # 단계·묶음 결정
│  │  ├─ grading.ts                  # 상/중/하 판정
│  │  ├─ explanation.ts              # 사유 문장 생성
│  │  ├─ conformance.ts              # 평가틀 정합성 점검
│  │  ├─ stats.ts                    # 정답률·변별도·응답시간
│  │  └─ *.test.ts
│  ├─ db/                            # Dexie 스키마, 백업/복원
│  ├─ report/
│  │  ├─ buildReportModel.ts         # 보고서 데이터 모델 (HWPX/PDF 공통)
│  │  ├─ hwpx/                       # OWPML XML 생성
│  │  ├─ pdf/
│  │  └─ capture.ts                  # 문항 캡처
│  ├─ features/
│  │  ├─ user/                       # 안내, 코드 입력, 응시, 결과
│  │  └─ admin/
│  │     ├─ subtests/                # 소검사 목록·편집기
│  │     ├─ editor/                  # 지문·문항·채점기준·연결규칙 탭
│  │     ├─ report/
│  │     ├─ activeSubtest/           # 사용자 소검사 설정
│  │     ├─ coding/                  # 구성형 채점
│  │     └─ pilot/                   # 결과 가져오기·통계
│  ├─ components/                    # 공통 UI (GearButton, ConfirmDialog 등)
│  └─ App.tsx
└─ README.md
```

## 명명
- 파일·컴포넌트: PascalCase 컴포넌트, camelCase 함수.
- 코드값: 영문 snake_case (`access_retrieve` 등), 표시명은 taxonomy에서.
- 문항 ID: `CR{unit:3}Q{item:2}` 자동 부여, 관리자 수정 가능하나 중복 검사.
