---
title: "080 — WP8: AssetRef 참조 모델 (#85)"
lane: "260726_zero-backlog-frontend-qa"
wp: 8
created: 2026-07-26
depends_on: [WP7]
issue: 85
criteria: [C8]
---

# WP8 — AssetRef 참조 모델 (#85)

## 이슈 범위 축소 근거

이슈는 "`sourceFilename`은 저장 구현 세부사항이다. asset ID 시스템을 도입하자"고
한다. 그런데 asset ID는 이미 존재한다 — `routes/assets.ts`와 `lib/assetsStore.ts`가
쓰고 있다.

filename에 묶여 있는 곳은 세 군데다.

1. `GenerateItem` (`ui/src/types.ts:69-130`) — `filename`, `canvasSourceFilename`
2. 비디오 소스 (`ui/src/store/storeVideoImpl.ts:120-141`, `routes/video.ts:240-254`)
3. canvas recovery (`lib/canvasVersionStore.ts`, `routes/canvasVersions.ts`)

즉 "asset ID 시스템 구축"이 아니라 **기존 asset ID를 이 세 경로에 연결**하는 작업이다.
이슈의 우선순위 표기도 Low이고, 본문 스스로 "현재 filename 방식은 단일 서버
배포에서 동작한다"고 인정한다.

## 왜 그래도 하는가

실제 결함이 있다. filename은 다음 상황에서 정체성을 잃는다.

- 파일 이동/이름 변경 후 history 복구 실패
- 원격 asset(파일이 로컬에 없음)
- 멀티 출력 노드에서 한 요청이 여러 파일을 낳을 때

다만 전면 마이그레이션은 위험 대비 이득이 나쁘다. **참조를 얹되 filename을 남긴다.**

## 변경 파일 맵

| 파일 | 종류 | 내용 |
|---|---|---|
| `lib/assetRef.ts` | NEW | `AssetRef` 타입 + 해석기 |
| `ui/src/types.ts` | MODIFY | `GenerateItem.assetId`, `derivedFrom` |
| `lib/videoGenerationRequest.ts` | MODIFY | `sourceAssetId` 추가 (WP7 산출물 확장) |
| `routes/video.ts` | MODIFY | assetId → 경로 해석, filename 폴백 |
| `ui/src/store/storeVideoImpl.ts` | MODIFY | assetId 우선 전송 |
| `lib/historyList.ts` | MODIFY | sidecar에서 assetId 복원 |
| `tests/asset-ref-contract.test.ts` | NEW | 양방향 폴백 계약 |

canvas recovery는 **이번 범위에서 제외**한다. `lib/canvasVersionStore.ts`가 5개
지점에서 filename을 쓰고 annotation 복구까지 얽혀 있어, 비디오 경로와 한 사이클에
묶으면 롤백 단위가 너무 커진다. 비디오 경로가 안정화된 뒤 별도 판단한다.

## 080-1. `AssetRef`

```ts
export type AssetRelationship = "source" | "reference" | "last-frame" | "continuation";

export type AssetRef = {
  assetId: string;
  filename?: string;      // 마이그레이션 기간 폴백
  relationship?: AssetRelationship;
};

export function resolveAssetPath(
  ref: { assetId?: string | null; filename?: string | null },
  ctx: { generatedDir: string; lookupAssetId(id: string): string | null },
): { path: string; via: "asset-id" | "filename" } | null;
```

`via` 필드는 WP6과 같은 이유로 있다. 어느 경로가 실제로 쓰였는지 증명해야 폴백이
살아있는지 알 수 있다.

**보안 주의.** `resolveAssetPath`가 반환한 경로도 반드시
`safeGeneratedFilePath`(`lib/videoFrameExtract.ts:31-52`)를 통과해야 한다. assetId가
DB에서 왔다고 안전한 게 아니다. 해석과 검증을 분리하고, 검증을 건너뛰는 경로를
만들지 않는다.

## 080-2. 하위 호환 규칙

절대 깨면 안 되는 것들:

| 대상 | 이유 |
|---|---|
| 기존 `.png`/`.mp4` sidecar | 이미 디스크에 있고 assetId가 없다 |
| `sourceFilename` 요청 필드 | CLI/외부 스크립트가 쓴다 |
| `canvasSourceFilename` | 저장된 canvas 세션 |
| ComfyUI export payload | 외부 통합 계약 |
| filename-only history | 과거 생성물 전부 |

따라서 규칙은 단순하다: **assetId가 있으면 우선 사용, 없으면 filename, 둘 다 없으면 오류.**
새 생성물은 둘 다 기록한다. 기존 생성물은 filename만으로 계속 동작한다.

## 080-3. 파생 관계

```ts
  // GenerateItem
+  assetId?: string | null;
+  derivedFrom?: AssetRef[] | null;
```

`derivedFrom`은 `videoContinuity`를 대체하지 않는다. `videoContinuity`는 비디오
체인 전용 구조이고 이미 잘 동작한다. `derivedFrom`은 그보다 일반적인 관계
(레퍼런스 이미지, canvas 소스, last-frame)를 담는다. 둘을 억지로 합치면 비디오
lineage 복구가 깨진다.

WP4의 `buildProvenanceView`가 `derivedFrom`을 읽도록 확장한다 — provenance chip이
"이미지 편집"을 표시할 때 소스를 assetId로 정확히 지목할 수 있다.

## 활성화 증거 (C-ACTIVATION-GROUNDING-01)

폴백 경로가 두 방향 모두 살아있어야 한다.

```ts
test("resolves via asset id when present", () => {
  const r = resolveAssetPath({ assetId: "a1", filename: "old.png" }, ctx);
  assert.equal(r.via, "asset-id");
});

test("falls back to filename for legacy sidecars", () => {
  const r = resolveAssetPath({ assetId: null, filename: "legacy.png" }, ctx);
  assert.equal(r.via, "filename");   // 폴백 발화 증명
});

test("rejects when the asset id is unknown and no filename exists", () => {
  assert.equal(resolveAssetPath({ assetId: "missing" }, ctx), null);
});

test("legacy history entries without assetId still load", async () => {
  // assetId 없는 sidecar fixture로 history 복원이 동작하는지
});
```

마지막 테스트가 가장 중요하다. 이 변경의 최대 위험은 **기존 생성물이 안 보이게
되는 것**이다. 사용자 입장에서 이건 데이터 손실처럼 느껴진다.

## Accept criteria (C8)

1. 신규 생성물이 assetId와 filename을 모두 기록한다.
2. assetId가 있으면 그것으로 해석한다 — `via: "asset-id"` 확인.
3. 레거시 sidecar가 filename으로 계속 동작한다 — `via: "filename"` 확인.
4. 해석된 경로가 반드시 경로 안전성 검증을 통과한다.
5. ComfyUI export payload가 변하지 않는다.
6. 전 게이트 green.

## 범위 경계

IN: `AssetRef` 타입, 비디오 소스 해석, history 복원, provenance 연결, 폴백 테스트.
OUT: canvas version store 마이그레이션, `sourceFilename` 제거, 원격 asset 지원,
asset 가비지 컬렉션, sidecar 스키마 버전 관리.
