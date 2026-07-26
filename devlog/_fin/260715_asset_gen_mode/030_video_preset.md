---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, video, wp7]
status: diff-level 확정 (WP7)
---

# 030 — WP7: 비디오 backgroundPreset + planner 배경 제약

리스크(Mind 확인): 비디오 플래너는 tool-call로 프롬프트를 **전면 재작성**
(`lib/grokVideoAdapter.ts:238-253` `parseGrokVideoPlanPrompt`) — suffix만으로는
드롭될 수 있음. T1은 살아남았지만 n=1. → user content 제약 줄 + suffix 이중 방어.

## 전제 (코드 확인)

- `routes/video.ts:315-320` `effectivePrompt = storyboardPrefix + basePrompt` 조립.
- planner 요청 조립: `lib/grokVideoAdapter.ts:170-215` `buildGrokVideoPlannerPayload` —
  user content 텍스트 블록이 `Selected video model...`부터 `User prompt:`까지 줄 단위 join.
- 비디오 provider 검증: `routes/video.ts:169-176` (grok/grok-api만).

## 파일 변경 맵

### MODIFY

| 파일 | 변경 |
|---|---|
| `routes/video.ts` | (1) body에서 `backgroundPreset` 파싱 — `parseBackgroundPreset` 재사용, error 400. (2) `:315` effectivePrompt에 `backgroundPromptSuffix(preset, "video")` 결합. (3) `generateVideoViaGrok` options에 `backgroundConstraint` 전달. (4) 비디오 메타(`:351-383`)에 `backgroundPreset` 기록 |
| `lib/grokVideoAdapter.ts` | `GrokVideoOptions`에 `backgroundConstraint?: string` 추가. `buildGrokVideoPlannerPayload` user content join 배열에서 `"Return the generate_video.prompt..."` 줄 앞에 constraint 줄 삽입: `opts.backgroundConstraint ?? "Background constraint: none."` — `backgroundPlannerConstraint()`(020) 재사용 |
| `ui/src/components/assetgen/AssetGenWorkspace.tsx` | 비디오 토글 활성화 (WP2의 disabled 해제). 비디오 옵션 서브셋: duration 3/5/8 (기본 5), resolution 480p/720p (기본 720p), aspect 1:1/16:9/9:16 (기본 1:1). GPT provider 선택 시 비디오 토글 disabled + providerCompat 안내 (`GenerationControlsPanel.tsx:155` 패턴) |
| `ui/src/store/storeAssetGenImpl.ts` | `generateAssetGen`이 kind==="video"면 기존 `/api/video` async 계약 호출 (body에 backgroundPreset), inflight `kind: "video"` 재사용 (`storeHelpers.ts:75`) |
| `bin/commands/video.ts` | `--bg <preset>` 플래그 (CLI 동일 계약) |
| `tests/background-presets.test.ts` | 비디오 variant 케이스 추가: suffix video 문구, planner constraint 줄 삽입 위치 (buildGrokVideoPlannerPayload 순수 함수 단위 테스트) |

## Accept criteria (WP7 C 게이트)

1. planner 요청 단위 테스트: constraint 줄이 user content에 정확한 위치로 삽입 (활성화 증거).
1b. **constraint-drop 활성화 시나리오** (감사 폴드): planner 응답이 배경 지시를 누락한
   상황을 관측 가능하게 — 생성 완료 시 revised prompt에 배경 키워드(uniform/green/background)
   부재를 감지하면 경고 로그 + 메타에 `plannerDroppedBackground: true` 기록. 테스트는
   mock planner 응답(배경 문구 없는 prompt)으로 이 감지 경로를 직접 구동해 로그/메타를 확인.
2. asset-gen 탭에서 크로마 비디오 1건 실생성 완주 — 001 측정 스크립트 8점×3프레임 green-dominant ≥95% + revised prompt 로그에 배경 지시 잔존 확인.
3. GPT 선택 시 비디오 토글 비활성 + 안내 렌더 (스크린샷).
4. 미지정 비디오 요청 회귀 (기존 classic 비디오 경로 무변화).
5. typecheck + npm test + ui build + build:cli 파리티.
