# WP3 - empty state·타이포·한국어 문구

## 변경 지도

### Home recent empty - MODIFY

- `ui/src/components/home/HomeWorkspace.tsx`
  - history가 없어도 recent section과 heading을 렌더.
- `ui/src/components/home/HomeRecentRow.tsx`
  - history 0에서 기존 `history.emptyRecent`를 재사용한 `role="status"` body를 렌더.
  - 한 primary next action 원칙상 별도 CTA는 추가하지 않고 바로 위 composer를
    첫 행동으로 안내한다.
- `ui/src/styles/home-workspace.css`
  - dashed placeholder card가 아닌 조용한 flat empty row.
  - heading/empty copy에 balance, mobile clipping 방지.
- `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`
  - 새 중복 key 대신 기존 `history.emptyRecent`를 재사용.

### typography wrapping - MODIFY

- `ui/src/components/assets/AssetsWorkspace.tsx`가 사용하는
  `ui/src/styles/assets-workspace.css`: toolbar h1, empty h2/p에 balance.
- `ui/src/styles/assetgen-workspace.css`: `assetgen-title`, `assetgen-form__lede` balance.
- `ui/src/styles/card-news-layout.css`에서 `card-news-empty__copy h2/p`,
  `card-news-stage__header h2/p` balance.
- `.assetgen-form h1`, `.assetgen-form__lede`, `.assetgen-empty h2/p`를 대상으로 하고
  empty 설명은 약 40ch로 제한.
- Card News 동적 제목 owner에 `min-width: 0`과 overflow 보호를 추가.
- line clamp 영역은 text-wrap 효과가 없으므로 건드리지 않는다.

### Korean copy - MODIFY

- `ui/src/i18n/ko.json`
  - `놀라게 해드려 죄송합니다` -> `불편을 드려 죄송합니다`.
  - `provider.codexLoginHint`, `mcp.modelsLoadFailed`, `settings.account.oauthBody`,
    `settings.imageModel.body`만 `~해요` product tone으로 맞춘다.
  - 섹션명 `mcp.imageModels`, 제품명 `settings.account.oauthTitle`, 모델명
    `settings.imageModel.gpt56Sol`은 보존.
  - 버튼/탭은 마침표·존댓말을 제거하고 짧은 동사형을 유지.
- `ui/src/components/settings/QuotaCard.tsx`의 Grok `Not logged in`은 기존
  `settings.quota.codexNotLoggedIn`을 재사용.
- 같은 파일의 계정 전환 진행/실패/복사/재시도 문구 전체를 `settings.quota.*`로 이동.
- `ui/src/components/ApiKeyInput.tsx`, `VertexJsonInput.tsx`의 저장·삭제·네트워크
  오류와 configured 안내도 `settings.apiKeys.*`로 이동.
- `ui/src/components/canvas-mode/CanvasModeTopbar.tsx`의 `Canvas Mode`를
  `canvas.modeTitle`로 이동.
- `ui/src/components/HistoryStrip.tsx`,
  `ui/src/components/assetgen/SpriteFrameRail.tsx`,
  `ui/src/components/composer/PromptComposerToolbar.tsx`의 보이는/ARIA English를
  번역 key 또는 기존 중복 요소 제거로 정리.
- `ui/src/components/ElementMentionMenu.tsx`는 순수 모듈 테스트 제약 때문에 i18n을
  import하지 않고, `ariaLabel`·`emptyLabel`·`kindLabel`을 caller props로 받아
  `ui/src/components/PromptComposer.tsx`가 번역 문자열을 전달한다.
- `ui/src/components/ElementMentionChip.tsx`, `ui/src/components/controls/Chip.tsx`도
  순수 모듈을 유지하고 label props를 받는다.
- 실제 `Chip` caller인 `ui/src/components/PromptComposer.tsx`,
  `ui/src/components/home/HomePromptComposer.tsx`,
  `ui/src/components/VideoControlsPanel.tsx`가 `removeLabel`과 `ChipRow ariaLabel`을 전달하고,
  `ui/src/components/composer/ElementMentionChips.tsx`는 mention chip/row label을 전달한다.
- `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`에 양쪽 locale을 동시에 추가:
  `settings.quota.switchAccount|startingLogin|enterCode|retry|copyLink|copied|waitingApproval|switchComplete|switchFailed|tryAgain`,
  `settings.apiKeys.saveFailed|networkError|removeFailed|configuredReplace`,
  `canvas.modeTitle`, `element.kindReference|selected|mentionAria|unavailableAria|removeAria`,
  `common.removeNamed`, `video.selectedCameraPresets`, `history.generatingCollection`,
  `assetGen.frameAria|addFrame|removeFrame|deleteFrame`.
- 기존 `common.elementSuggestions`, `common.noMatchingElements`, `common.remove`,
  `common.elementUnavailable`, `home.selectedPresets`, `assetGen.sequence`,
  `assetGen.candidates`는 재사용한다.
- locale JSON의 보이는 체크 dingbat도 SVG 아이콘/텍스트 의미로 교체한다.
  - `settings.apiKeys.saved`는 영문 `Saved`, 한국어 `저장됨`으로 확정.
  - 비밀값 마스킹 `●`, 닫기 `×`, 멘션 `@` 예외는 유지.
- `tests/i18n-coverage-contract.test.ts`는 보이는 JSX text 정직성까지,
  `tests/ui-glyph-policy.test.ts`는 locale JSON/CSS content까지 검사하되
  기존 예외 목록을 넓히지 않는다.
- pure module은 i18n import 금지만 예외로 두고 보이는 문자열 자체는 props 계약으로 검사한다.

## 검증

- source contract: Home은 history 0에서도 recent heading과 `history.emptyRecent`를 렌더.
- i18n JSON parse와 coverage contract.
- 기존 `devlog/_fin/260726_zero-backlog-frontend-qa/`에 WP-B/WP-C 실행 결과
  `031_wp_b_execution.md`, `032_wp_c_execution.md`를 추가해 계획-only처럼 보이는 030 문서와
  실제 커밋/스크린샷을 연결한다.
- `tests/mobile-composer-tray-contract.test.js`: Home history 0/1 구조.
- `tests/element-mention-ui-contract.test.js`: 결과 0건, kind label, caller props.
- `tests/i18n-coverage-contract.test.ts`: JSX text, template ARIA, camelCase `ariaLabel`,
  pure-module props 계약. 모델명/브랜드/파일 경로만 좁게 허용.
- `tests/ui-glyph-policy.test.ts`: locale JSON과 CSS `content:`의 금지 dingbat 검사.
- NEW `tests/settings-i18n-state-contract.test.ts`:
  - Quota의 `idle|starting|waiting|complete|error` 각 branch와 copied ternary가 정확한
    `settings.quota.*` key를 쓰고 English literal을 남기지 않는지 검사.
  - API key save/delete/network fallback과 Vertex save/delete/network/configured branch가
    `settings.apiKeys.*` key를 쓰는지 검사.
  - en/ko dictionary에 해당 key가 모두 있고 서로 같은 구조인지 검사.
- `docs/migration/runtime-test-inventory.md`는 신규 테스트 추가 뒤
  `node scripts/classify-tests.mjs`로 갱신한다.
- 390/768/1440px에서 Home empty, Assets empty, AssetGen heading, Card News empty 관찰.
- Korean long label과 200% zoom에서 overflow 확인.
- `node --import tsx --test tests/mobile-composer-tray-contract.test.js tests/assets-workspace-polish-contract.test.ts tests/asset-gen-keying-preview-contract.test.js tests/card-news-42-43-contract.test.js tests/element-mention-ui-contract.test.js tests/i18n-coverage-contract.test.ts tests/ui-glyph-policy.test.ts tests/settings-i18n-state-contract.test.ts`
- `npm run typecheck:tests && npm run test:inventory`
- `npm --prefix ui run build`
