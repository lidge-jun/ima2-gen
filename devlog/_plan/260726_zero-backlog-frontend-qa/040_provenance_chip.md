---
title: "040 — WP4: provenance chip UI (#90)"
lane: "260726_zero-backlog-frontend-qa"
wp: 4
created: 2026-07-26
depends_on: [WP1]
issue: 90
criteria: [C4]
---

# WP4 — provenance chip UI (#90)

생성 결과가 어떤 모델·provider에서 나왔는지, 어떤 소스에서 파생됐는지 UI에서
보이게 한다. 이슈 #90의 범위다.

## 먼저 — 이 이슈의 진짜 버그

이슈 본문은 "backend는 완료, UI만 남았다"고 한다. 절반만 맞다. 데이터는 저장되고
복원되지만, **노드 경로는 완료 시 model을 지운다**.

`ui/src/store/storeVideoImpl.ts:167`:

```tsx
                  elapsed: result.elapsed ?? undefined,
                  model: null,
                  videoContinuity: result.videoContinuity ?? parentVideoContinuity,
```

chip 컴포넌트를 아무리 잘 만들어도 노드에서는 표시할 model이 없다. 이 한 줄이
이 WP의 첫 수정이다. 나머지 UI 작업은 그 다음이다.

`ui/src/components/ImageNode.tsx:185`가 이미 `getImageModelShortLabel(d.model, provider)`를 호출하는데
`d.model`이 항상 null이니 라벨이 조용히 사라진다. 즉 이건 미구현이 아니라 회귀다.

## 데이터 가용성 (검증 완료)

| 경로 | model | provider | videoContinuity | 근거 |
|---|:-:|:-:|:-:|---|
| 이미지 생성 sidecar | ✓ | ✓ | — | `lib/generatePipeline.ts:450-480` |
| 비디오 라우트 done | ✓ | ✓ | ✓ | `routes/video.ts:420-489` |
| 확장 비디오 sidecar | ✓ | ✓ | ✓ | `routes/videoExtended.ts:356-366` |
| Agent sidecar | ✓ | ✓ | ✓ | `lib/agentImageVideoGen.ts:343-375` |
| history 복원 | ✓ | ✓ | ✓ | `lib/historyList.ts:53` |
| 갤러리 매핑 | ✓ | ✓ | ✓ | `ui/src/components/GalleryModal.tsx:190,201-204` |
| **노드 완료** | ✗ | ✓ | ✓ | `ui/src/store/storeVideoImpl.ts:167` — 버그 |

`AgentImageHandle`(`ui/src/components/agent/agentTypes.ts`)이 model/provider를 갖는지는
B 단계 첫 확인 항목이다. `GenerateItem`과 다른 타입이므로 필드가 없으면
`AgentImagePane`/`AgentResultThumb`까지 데이터를 흘려보내는 작업이 선행한다.

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `ui/src/lib/provenance.ts` | NEW | 표시 모델 정규화 + 소스 요약 |
| `ui/src/components/ProvenanceChip.tsx` | NEW | 공용 chip |
| `ui/src/styles/provenance-chip.css` | NEW | chip 스타일 |
| `ui/src/store/storeVideoImpl.ts` | MODIFY | `model: null` 제거 |
| `ui/src/components/GalleryImageTile.tsx` | MODIFY | chip 노출 |
| `ui/src/components/GalleryModal.tsx` | MODIFY | 상세에 chip |
| `ui/src/components/ImageNode.tsx` | MODIFY | I2V 소스 표기 보강 |
| `ui/src/components/agent/AgentImagePane.tsx` | MODIFY | chip 노출 |
| `ui/src/components/agent/AgentResultThumb.tsx` | MODIFY | 접근 가능한 이름에 provenance |
| `ui/src/components/agent/agentTypes.ts` | MODIFY | 필요 시 필드 추가 |
| `ui/src/index.css` | MODIFY | CSS import |
| `tests/provenance-chip-contract.test.ts` | NEW | 정규화 계약 |

## 040-1. `ui/src/lib/provenance.ts` (NEW)

```ts
import type { GenerateItem, VideoContinuityLineage } from "../types";

export type ProvenanceView = {
  modelLabel: string | null;
  providerLabel: string | null;
  derivation: "t2i" | "i2i" | "t2v" | "i2v" | "v2v" | null;
  sourceLabel: string | null;
};

export function buildProvenanceView(item: {
  model?: string | null;
  provider?: string | null;
  mediaType?: string;
  videoContinuity?: VideoContinuityLineage | null;
  canvasSourceFilename?: string | null;
}): ProvenanceView { /* ... */ }
```

설계 판단:

- **`videoContinuity` 객체를 chip에 그대로 뿌리지 않는다.** 전체 lineage 체인은
  결과 카드에 들어가기엔 너무 크다. chip은 파생 종류 한 단어 + 소스 한 개만 보여주고,
  전체 체인은 기존 `ResultMetadataModal`에 맡긴다.
- **provider가 model에서 유추 가능하면 provider는 생략한다.** "GPT-5.5 · openai"는
  같은 말을 두 번 하는 것이다. `getImageModelShortLabel`이 이미 provider를 인자로
  받으므로 그 규칙을 재사용한다.
- 값이 전부 없으면 chip 자체를 렌더하지 않는다. "unknown" 배지를 만들지 않는다.

## 040-2. `ProvenanceChip.tsx` (NEW)

```tsx
export function ProvenanceChip({ view, size = "sm" }: {
  view: ProvenanceView;
  size?: "sm" | "md";
}) {
  if (!view.modelLabel && !view.derivation) return null;
  return (
    <span className={`provenance-chip provenance-chip--${size}`}>
      {view.modelLabel && <span className="provenance-chip__model">{view.modelLabel}</span>}
      {view.derivation && (
        <span className="provenance-chip__derivation" title={view.sourceLabel ?? undefined}>
          {t(`provenance.${view.derivation}`)}
        </span>
      )}
    </span>
  );
}
```

접근성 요구:

- chip은 장식이 아니라 정보다. `aria-hidden`을 붙이지 않는다.
- 썸네일 위 오버레이로 얹을 때 대비를 확보한다(반투명 배경 + 텍스트 그림자 금지,
  불투명 배경 사용).
- `title` 속성만으로 소스를 전달하지 않는다 — 터치에서는 보이지 않는다. 상세 뷰에
  텍스트로도 존재해야 한다.

## 040-3. 노드 model 회귀 수정

```tsx
                   elapsed: result.elapsed ?? undefined,
-                  model: null,
+                  model: result.model ?? n.data.model ?? null,
                   videoContinuity: result.videoContinuity ?? parentVideoContinuity,
```

`result.model`이 응답에 실제로 있는지 `routes/video.ts:420-489`의 done payload로
확인한다. 없으면 요청 시점의 `n.data.model`로 폴백한다. 이 폴백이 중요한 이유는
비디오 응답이 provider 모델명을 다른 필드로 줄 수 있기 때문이다.

**활성화 근거 필요.** 이 수정은 조건부 경로다. 실제로 비디오를 생성해 노드 라벨에
모델명이 나타나는 것을 관찰해야 한다. 유료 호출 없이 검증하려면 done payload를
모킹한 스토어 계약 테스트로 대체하고, 그 사실을 증거에 명시한다.

## 040-4. 표면별 통합

| 컴포넌트 | 위치 | 크기 |
|---|---|---|
| `GalleryImageTile` | 타일 하단 오버레이 | sm |
| `GalleryModal` | 상세 메타 영역 | md |
| `ImageNode` | 기존 상태 라벨 줄에 병합 | sm |
| `AgentImagePane` | filename/prompt 아래 | md |
| `AgentResultThumb` | 시각 chip 없음, `aria-label`에만 추가 | — |

`AgentResultThumb`은 작은 썸네일 버튼이다(`ui/src/components/agent/AgentResultThumb.tsx:21-36`). 여기에 chip을 얹으면 이미지가
가려진다. 대신 접근 가능한 이름을 확장한다:

```tsx
-  const label = `${t("agent.mediaSelect")}: ${image.prompt ?? image.filename}`;
+  const provenance = buildProvenanceView(image);
+  const label = [
+    `${t("agent.mediaSelect")}: ${image.prompt ?? image.filename}`,
+    provenance.modelLabel,
+  ].filter(Boolean).join(" — ");
```

시각적으로 정보를 더하지 않는 쪽이 옳은 판단이다. 밀도가 높은 필름스트립에 배지를
박으면 썸네일 자체를 못 알아본다.

## i18n 키

```json
  "provenance": {
    "t2i": "텍스트→이미지",
    "i2i": "이미지 편집",
    "t2v": "텍스트→영상",
    "i2v": "이미지→영상",
    "v2v": "영상 이어가기"
  }
```

"T2V" 같은 약어를 한국어 UI에 그대로 노출하지 않는다. 영어 로케일에서는 약어가
자연스러우므로 en.json은 `"i2v": "Image → Video"`로 둔다.

## Accept criteria (C4)

1. 노드 완료 후 `model`이 보존된다 — 스토어 계약 테스트로 증명.
2. 갤러리 타일/상세, 노드, Agent 이미지 패널에 provenance가 표시된다.
3. `AgentResultThumb`의 접근 가능한 이름에 모델이 포함된다.
4. 데이터가 전혀 없는 항목에는 chip이 렌더되지 않는다(빈 배지 금지).
5. chip 텍스트 대비가 WCAG AA를 만족한다 — 실제 렌더에서 확인.
6. 전 게이트 green + 갤러리/노드/Agent 스크린샷 관찰.

## 범위 경계

IN: 위 파일들 + i18n + chip CSS.
OUT: lineage 전체 시각화, 결과 필터링/검색에 provenance 축 추가, sidecar 스키마 변경.
