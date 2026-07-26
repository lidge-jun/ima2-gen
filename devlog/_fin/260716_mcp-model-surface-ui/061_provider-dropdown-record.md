# 061 — Variant D 프로바이더 드롭다운 구현 기록 (wp1)

세션: 019f65ff-2065-7363-a253-09185ba7f06b · goalplan: ima2-gen-settings-ux-variant-d-provider-grid-pro

## 결과

Settings 패널 PROVIDER 섹션이 시안(Variant D, GPT 목업 → 사용자 선택)대로 단일 그룹 드롭다운으로 교체됨.

- 신규: `ui/src/components/settings/ProviderStatusSelect.tsx`(그룹 드롭다운+STATUS 라인+AUTH 칩), `ui/src/hooks/useProviderAvailability.ts`(hook 추출).
- 삭제: `ProviderSelect.tsx`(3열 그리드), `settings/ProviderStatusStrip.tsx`(8점 스트립) + 해당 CSS.
- Select 프리미티브 업그레이드(감사 A2): `role=combobox`, `aria-activedescendant`, option id, 1초 버퍼 typeahead, `searchText`.
- 포털 리스트 z-index 90→220(감사 A1): 모바일 compose sheet(z180) 위에서 동작.
- MCP 진입 조건 `enabled && connected`(감사 A3), `.status-dot--warn` 공용 블록 이동(감사 A4), structure/01 갱신(A5).
- i18n: provider.status*/authActive 등 en/ko 추가. AUTH 칩은 상태 bad일 때 "Active" 미표기.

## 검증

- 계약 테스트 6스위트 38/38 (provider-ui-polish·generation-controls-ux·mcp-provider-ui·current-image-actions-readiness·mobile-generate-entry·multimode-ui 갱신 포함).
- `cd ui && npm run build` 통과.
- 브라우저 QA(localhost:3435, headless Chrome):
  - 데스크톱 닫힘/열림: `evidence/060-desktop-closed.png`, `evidence/060-desktop-open.png` — CORE 6+MCP 2, 상태점+텍스트 병기, Higgsfield amber `Connected · Locked`.
  - 상호작용: GPT OAuth 선택 전환 OK; GPT API(키 없음) 클릭 → ApiDisabledModal(사유+힌트) + 선택 유지 OK; Runway 선택 → MCP 레인 진입, STATUS: CONNECTED, 칩 `MCP · Active` OK.
  - 모바일(390×844) compose sheet Controls 탭: 드롭다운이 시트 위(z220)로 열림, elementFromPoint로 가림 없음 확인 — `evidence/060-mobile-sheet-open.png`.

## 관찰(범위 밖 후속 후보)

- 사이드바 `GenProviderModelSelect`는 코어 프로바이더 선택을 availability로 게이트하지 않음(unconditional setProvider) — 설정 패널과 정책 불일치. QA 중 이 경로로 provider=api가 persist된 것을 확인. 다음 phase에서 동일 게이트 적용 권장.

## 062 추가 — 동적 Duration 슬라이더 (후속 요청)

모든 비디오 모델의 duration을 계약 반영 동적 슬라이더로 교체.

- 신규 `ui/src/components/controls/DurationSlider.tsx`: 허용값 배열 위 인덱스 스냅(native range) — 균일 range(Seedance 4–15s, 12스탭)든 비균일 options(Veo 4/6/8, Kling 5/10/15)든 같은 컨트롤. `aria-valuetext="Ns"`, 값 라벨 + min/max 스케일, 비필수 파라미터엔 Auto 칩(=파라미터 omit).
- 적용: MCP 프리셋(duration·number) + 코어 Grok 비디오 LENGTH(3–15s, ref2v 시 max 축소 그대로 반영).
- 모바일: 720px 이하에서 터치 밴드 44px/썸 22px 확대, compose sheet 안에서 실측 44px 확인.
- 수정: `.option-btn { flex:1 }`이 Auto 칩을 풀폭으로 늘리던 것 특이도 상향으로 고정.
- 검증: `tests/duration-slider-contract.test.js` 신설(4케이스), 관련 계약 32/32, ui build+tsc 통과, 인벤토리 재생성. 증거: `evidence/062-duration-slider-desktop.png`, `evidence/062-duration-slider-mobile.png`.
