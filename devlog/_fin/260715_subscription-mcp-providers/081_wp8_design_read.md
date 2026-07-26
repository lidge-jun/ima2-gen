# 081 — WP8 Design Read + 구현 기록

작성일: 2026-07-16 (cxc-dev-uiux-design §2 Design Read → cxc-dev-frontend 구현).

## Design Read

```yaml
name: ima2-gen studio — MCP provider surfaces
colors: 기존 앱 토큰 상속 (다크 스튜디오, 기존 accent 유지 — 신규 색 추가 금지)
typography: 기존 앱 스택 상속 (모노스페이스 계열 컨트롤 라벨)
iconography: 기존 앱 관례 (텍스트/CSS 컨트롤, 신규 아이콘 라이브러리 도입 없음)
```

Reading: **반복 사용 크리에이티브 도구의 컨트롤 표면** (Korean-first, 로컬 단일 사용자 스튜디오). 마케팅 표면이 아니므로 기존의 조용하고 밀도 높은 디자인 언어(pill 트리거 + 드롭다운 메뉴, settings-section 카드)에 흡수되어야 한다.

Do's: `.image-model-select` 계열 스타일 언어 재사용, capability 파생 목록, typed 사유 표시(잠김/미연결/drift), 상태 배지는 텍스트+색 이중 인코딩.
Don'ts: 새 hero/마케팅 구성 금지, 이모지 아이콘 금지(STRICT), 새 accent hue 금지, 과장 모션 금지.

### Dial Setting

```
DESIGN_VARIANCE: 3
MOTION_INTENSITY: 2
Product density profile: D5 (한국어 크리에이티브 도구, 기능 밀도 높음)
Reasoning: 반복 작업 도구의 컨트롤 확장 — 기존 시스템에 흡수되는 것이 목표이며 시각적 자기주장은 감점.
```

UX-CONCEPT-GEN 스킵 선언: 기존 디자인 시스템이 지배하는 유틸리티 컨트롤 확장(C2 utility 면제 + governing DS 존재) — concept 이미지 생성 없이 기존 언어를 따른다.

## 구현 슬라이스 (canonical — 감사 round 2 정합)

| # | Op | 파일 | 내용 |
|---|---|---|---|
| 1 | NEW | `ui/src/lib/mcpProviders.ts` | `jsonFetch` 기반 `/api/mcp/providers`(+connect/refresh/disconnect)·`/api/mcp/generate`·`/api/contracts/:id` 클라이언트. 모델 enum은 계약의 `inputSchema.properties.model.enum`에서 파생. MCP done 정규화 job watcher(히스토리 refresh 계약 경유, classic `res.image` 미주입, count=1). Connect는 동기 `window.open("about:blank")` 선오픈→응답 후 navigate→실패 시 close. |
| 2 | NEW | `ui/src/components/settings/McpProviderConnections.tsx` | 기존 `providers` 섹션 내부 카드: 상태 배지, toolCount, snapshotDiff 요약, Connect/Refresh/Disconnect, higgsfield 잠김 사유. SettingsSection union 무변경. |
| 3 | NEW | `ui/src/components/GenProviderModelSelect.tsx` | 사이드바 생성 variant 전용 \|프로바이더\|모델\| 2-드롭다운 + effort 서브메뉴(GPT 계열만). `ImageModelSelect.tsx`는 **미수정**(agent/settings variant 잔존) — 사이드바 렌더 지점만 신규 컴포넌트로 교체. `.image-model-select` CSS 재사용. |
| 4 | MODIFY | `ui/src/store/storeTypes.ts`, `storeSettingsImpl.ts` | `mcpProvider: string \| null`(**opaque id** — registry에 없는 persisted id는 `unknown` status로 유지+제출 비활성), `mcpModel: string \| null`, exclusive lane invariant + 상호 reconcile setter. |
| 5 | MODIFY | `ui/src/store/storePersistence.ts` | mcpProvider/mcpModel unknown-safe 저장·복원. |
| 6 | MODIFY | `ui/src/store/storeHelpers.ts`(+kind union) | inflight resync 필터에 `mcp-image`/`mcp-video`/`mcp-action-*` 추가. |
| 7 | MODIFY | 제출 경로(생성 트리거 지점) | mcpProvider 설정 시 `/api/mcp/generate` 라우팅(기존 경로 미변경). |
| 8 | MODIFY | `ui/src/i18n/ko.json`, `en.json` | `mcp.*` 키 ko/en parity. |
| 9 | NEW | `ui/tests` 또는 `tests/` UI 계약 테스트 | lane reconcile(설정/해제 시 상대 lane 정리), persisted unknown provider 제출 비활성, inflight kind 필터 포함, popup 실패 시 close — 동작 테스트. MCP 결과 정규화(히스토리 refresh 호출) 검증. |
| 10 | 검증 | `cd ui && npm run build` + 스크린샷 | 데스크톱(1280×720)/모바일(390×844): Settings 연결 카드, 분리 셀렉터 open. 경로를 본 문서 결과 섹션에 기록. |

비고: `routes/video.ts` capability guard 교체·`ui/src/types.ts` union 확장·비디오 라우팅 결정표 UI는 다음 사이클(잔여 이연 — 080 문서의 비디오 라우팅 표는 스펙 유지). 이유: Provider union 확장은 Record 소비자 전수 수술이 필요해 별도 사이클이 안전(WP5 감사 blocker 5 근거).

## WP8 감사 round 1 반영 (FAIL 5 High → 설계 수정)

1. **셀렉터 소유권 분리 (High 1):** 439줄 `ImageModelSelect.tsx`를 확장하지 않는다. NEW `ui/src/components/GenProviderModelSelect.tsx`가 **사이드바 생성 variant만** 소유(프로바이더+모델 2-드롭다운, effort 서브메뉴). agent-mode 분기와 settings variant는 기존 컴포넌트에 잔존. CSS는 `.image-model-select` 계열 클래스 재사용/확장.
2. **병행 상태 완결 (High 2):** store에 `mcpProvider`(null|"runway"|"higgsfield") + `mcpModel`(string|null) 추가. **exclusive invariant**: mcpProvider 설정 시 MCP lane, 해제 시 core lane — setter가 상대 lane을 reconcile. `storePersistence`에 unknown-safe 저장(재로드 시 미연결이면 선택 유지 + 제출 비활성 + 사유 표시). **모델 목록은 WP7 계약에서 파생**: `/api/contracts/mcp.<p>.generate_image|generate_video`의 raw `inputSchema.properties.model.enum`을 읽는다(하드코딩 금지).
3. **결과 정규화 (High 3):** MCP `done` payload(`url`/`filename`)는 기존 store 계약과 다르므로 client에서 정규화한다: 신규 `mcpProviders.ts`의 job watcher가 done 수신 시 히스토리 invalidate/refresh 경로로 결과를 편입하고(기존 gallery 계약 재사용), classic `res.image` 경로에 주입하지 않는다. count>1 UI는 MCP lane에서 1로 고정(어댑터 count:1 계약).
4. **inflight 재동기 (High 4):** `storeHelpers`의 inflight kind 필터에 `mcp-image|mcp-video|mcp-action-*`를 추가해 SSE 재연결/재로드 시 MCP job이 복원되게 한다(`storeTypes` kind union 확장 포함).
5. **OAuth 팝업 활성화 보존 (High 5):** Connect 클릭 시 **동기적으로** `window.open("about:blank")` 선오픈 → 응답 후 `popup.location = authorizationUrl`, 실패 시 `popup.close()` — user activation 상실로 인한 팝업 차단 회피.
6. Settings 카드는 기존 `providers` 섹션 내부에 배치(SettingsSection union 무변경). `jsonFetch` 재사용. i18n은 ko/en 재귀 parity 검사에 mcp 키 포함.

## 결과 기록 (2026-07-16 C-phase)

- 구현: sol/high worker(Schrödinger) 위임, canonical 10-슬라이스 준수. 구조 노트: `useAppStore.ts`가 소유권 밖이라 MCP 필드는 optional + 셀렉터 마운트 시 lazy hydrate.
- 빌드/테스트(오케스트레이터 독립 재검증): typecheck×2 green, `cd ui && npm run build` green(기존 경고만), **npm test 1416 pass / 2 fail(기존 병행 작업 baseline)**, 신규 `tests/mcp-provider-ui-contract.test.js` 7/7 — 커버: popup 선오픈/실패 close, 계약 파생 모델 enum, 히스토리 refresh 정규화(classic res.image 미주입), lane persistence(unknown 제출 비활성), connected-only 셀렉터 노출, higgsfield 잠김, agent-mode 렌더 보존, MCP inflight resync, ko/en 재귀 parity.
- 스크린샷(열람 검증 완료): `assets-081/wp8-settings-cards-desktop.png`(Settings 연결 카드 — 상태·과금 배지, higgsfield 잠김 사유), `assets-081/wp8-selector-mobile-final2.png`(모바일 2-pill 분리 셀렉터, overflow 수정 후).
- 브라우저 콘솔 오류 0 (worker 렌더 QA).
- 커밋 제외(병행 작업 소유): `storeAssetsImpl/storeGenImpl/storeVideoImpl`의 elementIds·refreshFolders 변경.
- 폴리시 이월: 최상단 모바일 앱바 pill의 라벨 절단("GP"/"5.6") 여유폭 개선, MCP 오류 typed 사유의 카드 표면 노출 고도화, transport 오류 정규화(061 이월분) — 다음 사이클.
