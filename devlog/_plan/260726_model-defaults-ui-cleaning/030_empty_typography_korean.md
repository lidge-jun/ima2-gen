# WP3 - empty state·타이포·한국어 문구

## 변경 지도

### Home recent empty - MODIFY

- `ui/src/components/home/HomeWorkspace.tsx`
  - history가 없어도 recent section과 heading을 렌더.
  - row 대신 `role="status"` empty body를 렌더.
  - 한 primary next action 원칙상 별도 CTA는 추가하지 않고 바로 위 composer를
    첫 행동으로 안내한다.
- `ui/src/styles/home-workspace.css`
  - dashed placeholder card가 아닌 조용한 flat empty row.
  - heading/empty copy에 balance, mobile clipping 방지.
- `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`
  - `home.recentEmpty` 추가. 한국어 예: “첫 결과가 여기에 쌓여요. 위에서 프롬프트를 입력해 시작하세요.”

### typography wrapping - MODIFY

- `ui/src/components/assets/AssetsWorkspace.tsx`가 사용하는
  `ui/src/styles/assets-workspace.css`: toolbar h1, empty h2/p에 balance.
- `ui/src/styles/assetgen-workspace.css`: `assetgen-title`, `assetgen-form__lede` balance.
- Card News owning CSS에서 `card-news-empty__copy h2/p`,
  `card-news-stage__header h2/p` balance.
- line clamp 영역은 text-wrap 효과가 없으므로 건드리지 않는다.

### Korean copy - MODIFY

- `ui/src/i18n/ko.json`
  - `놀라게 해드려 죄송합니다` -> `불편을 드려 죄송합니다`.
  - 감사에서 지적된 672, 711, 1208, 1251 주변 문장을 실제 key 문맥으로 읽고
    `~해요` product tone으로 맞춘다.
  - 버튼/탭은 마침표·존댓말을 제거하고 짧은 동사형을 유지.
- `ui/src/components/settings/QuotaCard.tsx`의 보이는 `Not logged in`을 i18n key로 교체.
- `ui/src/components/ElementMentionMenu.tsx`는 순수 모듈 테스트 제약 때문에 i18n을
  import하지 않고, 기존 예외의 실제 visible English `No matching elements`를
  locale-neutral 구조 또는 caller-provided label로 바꾼다.
- locale JSON의 보이는 체크 dingbat도 SVG 아이콘/텍스트 의미로 교체한다.
- `tests/i18n-coverage-contract.test.ts`는 보이는 JSX text 정직성까지,
  `tests/ui-glyph-policy.test.ts`는 locale JSON/CSS content까지 검사하되
  기존 예외 목록을 넓히지 않는다.

## 검증

- source contract: Home은 history 0에서도 recent heading/empty key를 렌더.
- i18n JSON parse와 coverage contract.
- 기존 `devlog/_fin/260726_zero-backlog-frontend-qa/`에 WP-B/WP-C 실행 결과
  record를 추가해 계획-only처럼 보이는 030 문서와 실제 커밋/스크린샷을 연결한다.
- 390/768/1440px에서 Home empty, Assets empty, AssetGen heading, Card News empty 관찰.
- Korean long label과 200% zoom에서 overflow 확인.
