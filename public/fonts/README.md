# 한글 폰트 (저장소 포함)

tech/product steering 규칙: 외부 폰트 CDN 호출 금지. 한글 폰트는 저장소에 포함한다.

## 넣을 파일 (사람 작업)

OFL 라이선스를 확인한 뒤 아래 중 하나의 폰트 파일(woff2 권장)을 이 폴더에 둔다.

- Pretendard (OFL) — https://github.com/orioncactus/pretendard
- 나눔고딕 (OFL)

예:

```
public/fonts/Pretendard-Regular.woff2
public/fonts/Pretendard-Bold.woff2
public/fonts/OFL.txt   # 라이선스 원문
```

그리고 `src/styles/fonts.css`에 `@font-face`를 선언하고 `global.css`에서 import 한다.
PDF 보고서는 래스터화(html2canvas) 방식이라 폰트 임베드가 필요 없지만, 화면·캡처가
동일한 글꼴로 보이도록 하려면 이 폰트가 로드되어야 한다.

> 폰트 바이너리는 라이선스 확인 책임 때문에 자동 생성 범위에서 제외한다.
> 폰트가 없으면 시스템 글꼴(Malgun Gothic 등)로 대체되어 동작은 한다.

## 연결 상태 (자동 생성)

`src/styles/fonts.css`에 Pretendard용 `@font-face`(Regular/Bold)가 선언되어 있고
`global.css`에서 import 한다. 폰트 파일(`Pretendard-Regular.woff2`, `Pretendard-Bold.woff2`)을
이 폴더에 넣으면 자동으로 적용된다. 없으면 Malgun Gothic 등 시스템 글꼴로 대체된다.

> 주의: `fonts.css`의 `url('/fonts/...')`는 루트 절대 경로다. GitHub Pages 하위 경로
> 배포(`/pisa-validator/`)에서 폰트가 404라면, 경로를 `url('fonts/...')`(상대) 또는
> 배포 base에 맞게 조정한다.
