# WP2 - 모델 선택 UX·문서 동기화

## 변경 지도

### UI model surfaces - MODIFY

- `ui/src/lib/agentModelOptions.ts`
  - Grok group에 `grok-4.5`/short `4.5`를 4.3 앞에 추가.
  - 기존 `grok-4.3`은 explicit compatibility option으로 유지.
- `ui/src/store/promptBuilderStore.ts`
  - default `gpt-5.5` -> `gpt-5.6-luna`.
  - union은 기존 모델을 모두 유지.
- `ui/src/components/prompt-builder/PromptBuilderModelMenu.tsx`
  - WP4에서 `Select`로 교체하기 전에도 latest-first 모델 배열을 사용.
- `lib/promptBuilder/constants.ts`
  - `DEFAULT_PROMPT_BUILDER_MODEL` -> `gpt-5.6-luna`.
  - valid set은 호환 모델 유지.
- `ui/src/components/composer/PromptComposerToolbar.tsx`
  - reset/default action의 `gpt-5.5` literal을 Luna로 교체.

### i18n - MODIFY

- `ui/src/i18n/en.json`, `ui/src/i18n/ko.json`
  - Grok planner 설명의 `grok-4.3` -> `grok-4.5`.
  - 4.5가 planner이고 Imagine이 생성 모델이라는 경계를 유지.
  - 설정 설명에 4.3 compatibility 선택 가능성을 짧게 남긴다.

### 공개 문서·SoT - MODIFY

- `README.md`, `docs/README.ko.md`, `docs/README.zh-CN.md`,
  `docs/README.ja.md`, `docs/FAQ.md`, `docs/FAQ.ko.md`,
  `docs/CLI.md`, `docs/API.md`, `docs/PROMPT_STUDIO.md`,
  `docs/grok-video-i2v-plan.md`
- `site/src/pages/docs/reference/config.astro`,
  `site/src/pages/docs/reference/cli.astro`,
  `site/src/pages/ko/docs/reference/config.astro`,
  `site/src/pages/ko/docs/reference/cli.astro`,
  `site/src/pages/ko/docs/reference/api.astro`,
  `site/src/pages/docs/concepts/providers.astro`,
  `site/src/pages/docs/concepts/modes.astro`,
  `site/src/pages/docs/reference/api.astro`,
  `site/src/pages/ko/docs/concepts/providers.astro`,
  `site/src/pages/ko/docs/concepts/modes.astro`
- `structure/03-server-api.md`, `structure/06-infra-operations.md`,
  `structure/00-structure-hub.md`, `structure/01-file-function-map.md`,
  `structure/02-command-reference.md`, `structure/07-devlog-map.md`

Before/after:

- app image default `gpt-5.4-mini` 문구 -> `gpt-5.6-luna`.
- Grok planner/analysis `grok-4.3` 문구 -> `grok-4.5`.
- 4.3은 available compatibility override로만 언급.
- 생성 모델 `grok-imagine-*` 명칭은 유지.
- `docs/grok-video-i2v-plan.md`는 2026-05-30 역사 계획이므로 본문을 전면
  치환하지 않고 상단에 “당시 snapshot, 현재 default는 config/API docs 참조” 표지만 추가.

## 계약 테스트

- `tests/gpt56-rollout-contract.test.ts`: UI·config·prompt builder default가 Luna.
- `tests/agent-mode-right-sidebar-contract.test.js`: 4.5 option과 Agent constant.
- docs regex contract가 있는 `tests/cli-feature-parity-contract.test.js` 포함.
- NEW `tests/model-default-projection-contract.test.ts`:
  `config.ts`, `routes/models.ts`, `routes/capabilities.ts`,
  `ui/src/lib/agentModelOptions.ts`, `ui/src/store/promptBuilderStore.ts`,
  `README.md`, `docs/API.md`, `docs/CLI.md`,
  `site/src/pages/docs/reference/config.astro`,
  `site/src/pages/ko/docs/reference/config.astro`,
  `structure/03-server-api.md`, `structure/06-infra-operations.md`의
  4.5/Luna/Video 1.5 투영을 한 번에 검사.
- `npm run docs:refresh-line-counts` 후 generated structure line map diff 검토.

## 렌더 시나리오

- Settings > Grok planner dropdown: 4.5가 첫 option, 4.3 선택 가능.
- Agent model menu: Grok 4.5 label/short label이 잘리지 않음.
- Prompt Builder model picker: Luna default가 보이고 키보드 선택 가능.
- `npm --prefix site run check`, `npm --prefix site run build`.
