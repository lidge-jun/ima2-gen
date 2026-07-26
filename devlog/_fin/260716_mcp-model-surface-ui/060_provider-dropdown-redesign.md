# 060 — Settings PROVIDER Variant D 드롭다운 전면 개편 (wp1)

세션: 019f65ff-2065-7363-a253-09185ba7f06b · goalplan: ima2-gen-settings-ux-variant-d-provider-grid-pro
선정 근거: 사용자가 GPT 시안 5종(evidence/ux-mockups/) 중 Variant D(드롭다운) 선택. 조사 근거는 050 기록 참조(assistant-ui/VS Code 계열 grouped picker + NN/g 상태·액션 분리).

## Design Read (cxc-dev-uiux-design §2)

```yaml
---
name: ima2-settings-provider-select
colors:
  primary: "#e8e8e8"
  accent: "#4ade80"   # status ok — amber #f59e0b / red #ef4444 병행, 항상 텍스트 병기
  background: "#0f0f10"
typography:
  heading: { fontFamily: mono uppercase, fontSize: 11px letterspaced }
  body: { fontFamily: ui-mono/system, fontSize: 13px }
iconography:
  system: "none"      # 상태점 + 텍스트 배지만, 이모지·아이콘 없음
  weight: "-"
  domain: "library-subset"
---
```

Reading this as: 전문가용 도구 UI(반복 작업 설정 패널) for 로컬 스튜디오 파워유저, terminal-adjacent 조용한 모노 언어.
참조점은 ima2 기존 ctl-select(글래스 리스트박스) — 새 시각 언어를 발명하지 않고 기존 킷을 확장한다.

Do's: 상태는 항상 점+텍스트 병기, 선택(액션)과 상태(정보)의 역할 분리, 기존 ctl-select 스타일 재사용.
Don'ts: 8점 상태 스트립 부활 금지, OAuth/API 버튼이 선택+상태를 겸하는 이중 의미 금지, 색 단독 상태 전달 금지.

DESIGN_VARIANCE: 3 · MOTION_INTENSITY: 2 · Density: D5
Reasoning: 대시보드/전문 도구 프리셋 — 복잡성은 밀도로 흡수하고 시각 장식은 낮게.

## Lazy-User Gate 적용

- Do nothing/Delete: 상태 스트립은 드롭다운 옵션 행이 상태를 담으므로 삭제(중복 제거).
- Absorb: 인증 수단은 프로바이더 옵션에 흡수(GPT OAuth / GPT API가 별개 옵션) — 사용자가 "프로바이더 고르고 다시 인증 고르는" 2단 결정을 1단으로.
- Demote: 연결 실패 사유는 옵션 sub 텍스트 + ApiDisabledModal로 지연 노출.
- 화면의 단일 주 행동: 드롭다운에서 프로바이더 하나 고르기.

## Diff-level 계획

1. **hook 추출** — `ui/src/hooks/useProviderAvailability.ts` 신설(ProviderSelect.tsx의 hook 이동, 로직 불변).
   import 갱신: ProviderReadinessPopup, HomePromptComposer.
2. **새 컴포넌트** `ui/src/components/settings/ProviderStatusSelect.tsx`:
   - 데이터: useProviderAvailability() + mcpProviders(부모 GenerationControlsPanel의 단일 poller 유지).
   - `Select`(controls/Select, portal) 재사용. groups: CORE(oauth/api/grok/grok-api/agy/gemini-api) + MCP(runway/higgsfield).
   - 옵션 label: 상태점(ok/warn/bad) + 이름, sub: 상태 텍스트(Connected/Key missing/Offline/Locked/Auth needed).
   - 닫힌 트리거: `GPT · OAuth · Connected` 형태(triggerLabel).
   - onChange: core → availability.ok ? setProvider : ApiDisabledModal(사유); mcp → status connected ? setMcpProviderImpl : 모달(사유). Higgsfield connected+locked는 진입 허용(카탈로그 브라우즈, 기존 040 규약).
   - 아래 STATUS 라인(`● STATUS: CONNECTED` — 선택 항목 상태) + AUTH 칩(`OAUTH · ACTIVE` / `API KEY · ACTIVE` / `MCP · ...`).
3. **패널 교체** — GenerationControlsPanel 양쪽 분기에서 `<ProviderStatusStrip/>+<ProviderSelect/>` → `<ProviderStatusSelect/>`. MCP 분기는 muteSelection 대신 mcp:<id>가 선택값이므로 자연 표현.
4. **삭제** — ProviderSelect.tsx(그리드), settings/ProviderStatusStrip.tsx. provider-grid/status-strip CSS 정리, ctl-select 확장 클래스 + provider-status-line/auth-chip CSS 추가.
5. **i18n** — settings.status/auth/active 등 신규 키, provider 상태 문구는 기존 키 재사용.
6. **테스트 갱신** — mcp-provider-ui-contract(스트립+그리드 계약 → 드롭다운 계약), generation-controls-ux-contract, provider-ui-polish-contract(대상 파일 교체), current-image-actions-readiness(무변경 예상).
7. **검증** — typecheck·해당 계약 테스트·ui build·헤드리스 스크린샷(닫힘/열림/코어/MCP 4컷) → evidence/.

## 감사 R1 반영 (sol FAIL → 블로커 4건 전부 수용)

| # | 블로커 | 반영 |
|---|--------|------|
| A1 | 포털 드롭다운이 모바일 compose sheet(z180) 아래 깔림(ctl-select 메뉴 z90) | controls.css 포털 메뉴를 오버레이 레이어 `z-index: 220`(시트 180 위)로 승격 — 전 셀렉트 공통 수혜. 모바일 뷰포트 열림/선택 QA 스크린샷 추가 |
| A2 | Select.tsx가 완전한 접근성 listbox 아님(focus가 트리거에 잔류, option id 없음, activedescendant/typeahead 없음) | Select.tsx 업그레이드: 트리거 `role=combobox` + `aria-expanded/controls/activedescendant`, option에 `id={listboxId}-opt-<n>`, 프린터블 키 typeahead(1s 버퍼). 포커스는 트리거 유지(select-only combobox 패턴, APG 준거) |
| A3 | MCP 진입 조건에 `record.enabled` 누락 | `record.enabled && record.status.state === "connected"`로 통일(GenProviderModelSelect:119와 동일 불변식). Higgsfield는 enabled+connected면 진입(브라우즈), 생성 잠금은 storeSettingsImpl:30 유지 |
| A4 | `.status-dot--warn`이 삭제 대상 스트립 CSS 블록에 있음 | 삭제 전에 provider-controls.css의 공용 status-dot 블록 옆으로 이동 |
| A5(minor) | structure/01 파일 맵 갱신 | 신규 hooks/useProviderAvailability.ts, settings/ProviderStatusSelect.tsx 추가·삭제 파일 반영 |

ApiDisabledModal은 `reason`+`hint` 모두 보존. 테스트 기준선: 관련 6개 스위트 38/38 (리뷰어 실측).

## 수용 기준

goalplan c1–c4 (드롭다운 렌더+구계약 제거 / 3경로 동작 보존 / STATUS·AUTH 정합 / 검증+리뷰+기록).
