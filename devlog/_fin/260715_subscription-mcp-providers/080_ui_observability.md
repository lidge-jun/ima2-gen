# 080 — 연결 UI, 동적 설정, observability

> **Post-interview canonical (2026-07-16).** WP8. 사람용 UI 표면이다. AI-facing contract discovery는 070이 소유하며, 이 문서의 `bin/commands/observability.ts`·`bin/commands/video.ts` CLI 변경도 070의 catalog projection을 소비하는 방향으로 구현한다.

## 목적

MCP schema를 그대로 노출하지 않고 현재 ima2 생성 UX 안에서 provider 연결 상태·모델·기능·비용 방식을 이해할 수 있게 한다. 모든 long-running call은 기존 단일 event channel로 관찰한다.

## Create 패널 provider/model 분리 (2026-07-16 사용자 지시)

현재 `ui/src/components/ImageModelSelect.tsx:40`의 `button#sidebar-image-model` pill 하나가 model과 reasoning effort를 함께 표시한다("grok · off"). 이를 두 개의 인접 드롭다운으로 분리한다.

```text
| 프로바이더 ▾ | | 모델 ▾ |
                └─ 추론강도 (모델 메뉴 내부 서브드롭다운)
```

- **프로바이더 드롭다운**: core provider(gpt, gemini, grok, antigravity) + `connected` 상태의 MCP provider(higgsfield, runway, magnific, recraft, …). 목록은 hardcode하지 않고 registry/capabilities에서 파생한다. 미연결 MCP provider는 여기 섞지 않는다(기존 UI rules 유지).
- **모델 드롭다운**: 선택된 provider의 capability/model schema에서 파생. persisted unknown model은 기존 fallback 규칙을 따른다.
- **추론강도**: 독립 pill이 아니라 모델 드롭다운 내부의 서브드롭다운으로 이동하고, effort를 지원하는 provider/model 조합에서만 노출한다(`REASONING_EFFORT_OPTIONS`는 GPT 계열 전용 → capability 파생으로 전환).
- provider 전환 시 model/media-mode reconcile은 `storeSettingsImpl`의 기존 reconcile 계약을 재사용한다.
- 이 분리는 image·video 양쪽 selector에 동일하게 적용한다.

## 비디오 모델 라우팅

video provider/model이 core Grok 계열에서 Higgsfield(30+ 모델)·Runway·Magnific 등으로 늘어나므로 라우팅 결정표를 문서화·구현한다.

| 축 | 소유자 | 규칙 |
|---|---|---|
| provider/model 선택 | 이 phase의 분리 selector | 사용자가 명시 선택; 목록은 catalog/capability 파생, hardcode 금지 |
| operation 라우팅 (generate/extend/stitch/reframe/upscale) | 060 `mediaWorkflowRouter` | 선택 provider의 native tool 존재 여부 → native/fallback/unavailable 결정 |
| tool/schema 해석 | 050 adapter + 020 catalog | 선택 model을 provider tool 입력으로 번역; schema hash 검증 후 호출 |
| 미지원 조합 | capability guard | `routes/video.ts`의 Grok-only guard를 capability guard로 대체(050) — 미지원은 typed `unavailable`+사유 표시 |

수용 기준: 어떤 provider/model 조합을 선택해도 (a) 지원 여부가 클릭 전에 UI에 보이고, (b) 미지원 경로는 upstream 호출 없이 사유가 표시되며, (c) sidecar metadata에 실제 라우팅 결과(provider/tool/model)가 남는다.

provider 목록은 ima2가 판매하는 고정 catalog가 아니라 사용자가 연결한 공식 MCP connection 목록이다. OAuth 연결은 사용자 provider 계정으로 열리고, API key형 official MCP는 로컬 사용자가 직접 넣는 secondary connection으로 분리한다.

## File change map

| Op | Path | 변경 |
|---|---|---|
| NEW | `ui/src/lib/mcpProviders.ts` | status/capability/model API client와 unknown-safe decoder. |
| NEW | `ui/src/hooks/useMcpProviders.ts` | provider status/capability polling, reconnect refresh. |
| NEW | `ui/src/components/settings/McpProviderConnections.tsx` | provider별 Connect/Disconnect/Refresh, billing mode, schema-changed 상태. |
| MODIFY | `ui/src/components/SettingsWorkspace.tsx` | Providers section에 MCP connections block 추가. |
| MODIFY | `ui/src/components/ProviderSelect.tsx` | 정적 3열 grid를 core providers + connected MCP provider 목록으로 확장. |
| MODIFY | `ui/src/components/ImageModelSelect.tsx` | 선택 provider capability/model schema에서 model option 생성; unknown persisted model fallback. |
| MODIFY | `ui/src/store/storeTypes.ts` | provider connection/capability snapshot, pending workflow state. |
| MODIFY | `ui/src/store/storeSettingsImpl.ts` | provider 전환 시 media mode/model을 capability에 맞게 reconcile. |
| MODIFY | `ui/src/store/storePersistence.ts` | provider id/model preference만 저장; token/tool schema/account data는 저장 금지. |
| MODIFY | `ui/src/lib/eventChannel.ts` | `uploading`, `provider-queued`, `provider-running`, `downloading`, `media-processing` event type 추가. |
| MODIFY | `ui/src/components/ResultActions.tsx` | capability에 따른 media actions와 native/fallback badge. |
| MODIFY | `ui/src/i18n/ko.json` | 연결/크레딧/native/fallback/schema drift/재로그인 copy. |
| MODIFY | `ui/src/i18n/en.json` | 동일 key parity. |
| MODIFY | `bin/commands/observability.ts` | `ima2 providers --json`에 MCP status/capabilities 추가. |
| MODIFY | `bin/commands/video.ts` | 연결된 MCP provider/model/action 옵션을 capabilities endpoint에서 검증. |
| NEW | `tests/mcp-provider-ui-contract.test.js` | 설정·selector·action·i18n 정적 계약. |
| NEW | `tests/mcp-cli-contract.test.ts` | provider/status/capability/secret-free JSON 계약. |

## UI rules

- 연결 전 provider는 생성 selector에 섞지 않고 Settings의 “연결 가능” 목록에 둔다.
- `Connect`는 새 창/브라우저 OAuth를 명시하고 완료 후 status를 재조회한다.
- billing badge: `구독 크레딧`, `API 사용량 과금`, `미확인` 중 하나. 미확인을 구독으로 추측하지 않는다.
- native/fallback badge: “Provider AI 연장”, “마지막 프레임으로 이어가기”, “로컬 합치기”를 구분한다.
- exact credit estimate를 provider가 제공하지 않으면 숫자를 만들지 않고 “provider에서 차감”으로 표시한다.
- schema drift는 reconnect 버튼과 함께 해당 provider action만 잠근다.

## Event normalization

| ima2 event | MCP 상태 예시 | UI |
|---|---|---|
| `uploading` | provider upload tool | 참조 업로드 |
| `submitted` | tools/call accepted/job id | 대기열 등록 |
| `provider-queued` | upstream queued | Provider 대기 중 |
| `provider-running` | task/status running | 생성 중 |
| `progress` | upstream percentage가 있을 때만 | 실제 값만 표시 |
| `downloading` | signed output URL fetch | 결과 저장 중 |
| `media-processing` | local concat/frame/thumb | 로컬 처리 중 |
| `done` | local artifact+sidecar committed | 결과 표시 |
| `error` | normalized code | retry/auth/capability 안내 |

## Conditional activation scenarios

- Persisted unknown provider: 이전에 연결했던 provider가 registry에서 사라진 상태로 reload하면 core default로 자동 생성하지 않고 “연결 끊김” 상태를 보여준다.
- Schema drift during open page: capability polling에서 hash 변화가 감지되면 action button이 즉시 disabled 되고 현재 unrelated jobs는 유지된다.
- OAuth popup blocked: connect route는 재시도 가능한 authorization URL과 안내를 반환하되 token을 포함하지 않는다.
- No cost data: UI에서 0 credits나 무료로 표기하지 않고 `unknown` copy를 사용한다.
- SSE reconnect: MCP job 진행 중 EventSource 재연결 후 `/api/inflight` resync로 상태를 복원한다.

## Acceptance criteria

- disconnected/provider error가 core GPT/Grok/Gemini UI를 막지 않는다.
- browser localStorage/DevTools network response에 MCP token이 없다.
- desktop/mobile Settings에서 연결 상태와 action 이유가 읽힌다.
- MCP 산출물의 gallery/history/result action이 기존 산출물과 동일하게 동작한다.
- CLI JSON은 automation-safe이며 prompt/token/signed URL을 기본 출력하지 않는다.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
node --test tests/mcp-provider-ui-contract.test.js --import tsx tests/mcp-cli-contract.test.ts
cd ui && npm run build
```

브라우저 QA는 1280×720과 390×844에서 disconnected, connecting, connected, schema-changed, active-job, fallback-action 상태를 각각 관찰한다.
