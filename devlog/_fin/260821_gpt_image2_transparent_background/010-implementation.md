---
created: 2026-08-21
tags: [ima2-gen, devlog, gpt-image-2, transparent-background, implementation]
---

# 010 — 구현: 투명 배경 프리셋 end-to-end

## 설계 결정

**핵심: `background:"transparent"`를 그대로 흘려보내지 않는다.**

OAuth(Codex) 세션은 이미지 툴을 `gpt-image-2-codex` 변형에 고정하고,
이 변형은 transparent **강제**를 400으로 거부한다(000 문서). 반면 `auto`는
통과하며, 프롬프트에 컷아웃 의도가 있으면 실제 알파를 돌려준다.

따라서 `lib/imageBackgroundParam.ts`가 프리셋을 표면별로 매핑한다:

| 표면 | `background` | 근거 |
|---|---|---|
| OAuth (`supportsForcedTransparent: false`) | `auto` | 강제 시 400 |
| Atlas Cloud gpt-image-2 API | `transparent` | 공지 스펙 (미검증 — API 키 없음) |

프롬프트 접미사가 실제 레버이므로 `backgroundPresets.ts`의 transparent
suffix가 컷아웃 의도를 담는다.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `lib/backgroundPresets.ts` | `transparent` 프리셋 + suffix + planner constraint + `isColorKeyablePreset` / `presetRequiresAlpha` |
| `lib/imageBackgroundParam.ts` | **신규.** 표면별 background/output_format 해석 + jpeg 충돌 가드 |
| `lib/responsesTools.ts` | `ImageGenOptions`/`ResponseTool`에 `background`, `output_format` |
| `lib/responsesImageAdapter.ts` | `GenerateOptions`에 background/outputFormat, 툴 페이로드 전달 |
| `lib/generatePipeline.ts` | 프리셋→파라미터 배선, jpeg 충돌 400, atlas 전달 |
| `lib/atlasCloudImageAdapter.ts` | `output_format` jpeg 하드코딩 해제(transparent면 png), webp 허용, background 전달 |
| `lib/promptImport/gptImageHints.ts` | 경고 id를 `transparent-needs-background-param`으로 정정 |
| `bin/commands/gen.ts` | `--bg` 도움말 노출 + 로컬 검증 |
| `ui/src/types.ts` | 프리셋 유니온에 transparent, `GenerateItem.backgroundPreset` |
| `ui/src/components/assetgen/BackgroundPresetPicker.tsx` | 체커보드 스와치, GPT 레인 게이팅, 힌트 전환 |
| `ui/src/components/assetgen/AssetGenWorkspace.tsx` | `is-alpha` 타일, 키잉 버튼 차단 |
| `ui/src/store/useAppStore.ts` | Grok 전환 시 stale transparent 해제 |
| `ui/src/store/storeAssetGenImpl.ts` | 결과 아이템에 프리셋 보존 |
| `ui/src/styles/assetgen-workspace.css` | 알파 스와치 + 알파 타일 체커보드 + `object-fit: contain` |
| i18n en/ko/zh-Hans/zh-Hant | 신규 문자열 3종 |

## 디자인 판단 (cxc-dev-uiux-design)

- **Design Read**: 도구 UI, 반복 작업자, 기존 디자인 시스템 보유 → 새 언어 발명 금지.
- **Dial**: DESIGN_VARIANCE 3 / MOTION_INTENSITY 2 / density D4-D5.
  대시보드·도구 계열은 "fancy"가 도메인 정확성을 이기지 못한다.
- 투명은 **색이 아니므로** 색상 칩이 아니라 체커보드 스와치를 준다.
  이미 `is-keyed` 타일이 쓰던 체커보드 언어를 재사용해 학습 비용 0.
- 알파 타일은 `object-fit: contain` — 컷아웃은 실루엣이 콘텐츠라
  정사각 크롭이 내용을 잘라먹는다.
- **Lazy-User Gate**: 사용자가 "알파 채널"이나 포맷을 이해할 필요 없이
  프리셋 하나만 누르면 되게 했다. 포맷은 시스템이 흡수한다(Tesler).

## 검증

- `npm run typecheck` / `typecheck:tests` / `test:inventory` exit 0
- `npm test`: **2376 pass / 0 fail** (신규 41건 포함)
- `cd ui && npm run build` exit 0
- 서버 재시작 후 CLI E2E: `--bg transparent` → **66.41% 투명, 코너 0/0/0/0**
- jpeg 가드 실제 HTTP 발화:
  `{"code":"TRANSPARENT_FORMAT_CONFLICT"}` (C-ACTIVATION-GROUNDING-01)
- UI 렌더 관찰(agbrowse, 1280x720): 투명 버튼 렌더 → 선택 시 힌트 전환 →
  Grok에서 비활성+사유 표시 → GPT 복귀 시 재활성. 스크린샷 관찰 완료.

**렌더 검증이 실제 결함을 잡았다**: 최초 구현은 Grok 레인에서도 투명을
누를 수 있었다. Grok에는 알파 파라미터가 없어 조용히 불투명 이미지가
나왔을 것이다. 게이팅 + stale 선택 해제로 수정했다.

