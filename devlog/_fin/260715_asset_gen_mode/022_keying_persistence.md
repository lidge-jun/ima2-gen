---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, server, persistence, wp6]
status: diff-level 확정 (WP6)
---

# 022 — WP6: 알파 PNG 업로드 API + derivedFrom 에셋 등록

결정(Q6 계열): 파생 산출물은 원본과 별도 파일 + `derivedFrom` 메타 연결
(ASSUMPTION 9). 클라이언트 키잉 결과는 업로드가 필요 (ASSUMPTION 17 —
`/api/assets`는 generatedDir 내 기존 파일만 등록, `routes/assets.ts:47-60`).

## 전제 (코드 확인)

- raw body 저장 전례: `routes/canvasVersions.ts:30-50` (PNG body + `sourceFilename` 계약,
  `lib/canvasVersionStore.js:117-147`) — 참고 패턴, 직접 재사용은 파일명 계약이 달라 불가.
- 에셋 등록: `POST /api/assets` JSON (`filePath`는 generatedDir 상대경로 검증,
  `resolveInGenerated` + `assertRegularGeneratedPath`).
- 히스토리: 파일 기반 인덱싱이라 generatedDir에 쓰면 자동 노출 (`lib/generatePipeline.ts:364`
  인덱스 무효화 패턴 참조).

## 파일 변경 맵

### NEW — 서버 `routes/assetDerived.ts` (~120줄)

```
POST /api/assets/derived
  headers: Content-Type: image/png (raw body, limit 30mb)
  query:   source=<generatedDir 상대경로>  — 원본 파일 (존재 검증)
           kind=keyed-png                  — WP8에서 keyed-webm 추가
  동작:    <원본basename>-keyed-<ts>.png 로 generatedDir에 저장
           + 사이드카 JSON { derivedFrom: <source rel>, kind, backgroundPreset?, keyParams }
           + assetsStore에 asset 레코드 생성 (folderId = body query projectId?, metadata.derivedFrom)
  응답:    { filePath, asset }
  검증:    PNG 시그니처 sniff, 원본 존재, 경로 탈출 차단 (resolveInGenerated 재사용)
```

등록: `server.ts`의 라우트 등록부에 `registerAssetDerivedRoutes(app, ctx)` 추가
(기존 registerAssetsRoutes 인접 줄).

### MODIFY

| 파일 | 변경 |
|---|---|
| `lib/assetsStore.ts` | 변경 없음 예상 — metadata JSON에 `derivedFrom` 실림 (스키마 무변경, ASSUMPTION 9). 확인만 |
| `ui/src/lib/api-assets.ts` | `uploadDerivedAsset(blob, { source, projectId, keyParams, backgroundPreset })` 추가 (fetch raw body) |
| `ui/src/components/assetgen/KeyingPanel.tsx` | WP5의 로컬 다운로드 버튼을 "프로젝트에 저장"으로 교체 — `uploadDerivedAsset` 호출, 성공 시 결과 그리드에 파생 카드 추가 + 라이브러리 반영. 다운로드는 보조 버튼으로 유지 |
| `ui/src/store/storeAssetGenImpl.ts` | 파생 결과를 `assetGenItems`에 원본과 연결된 형태(파생 배지)로 push |
| `tests/asset-derived.test.ts` (NEW ~100줄) | 시그니처 검증 실패 400 / 존재하지 않는 source 400 / 정상 업로드 → 파일 존재 + asset 레코드 + 사이드카 derivedFrom / 경로 탈출 시도 거부 |

## 썸네일/히스토리 계약

- keyed PNG는 `imageThumb` 지원 포맷(PNG)이라 기존 썸네일 경로 그대로 동작.
- 히스토리에는 파생 파일이 일반 이미지로 노출 (ASSUMPTION 자연 노출 정책) —
  사이드카의 `derivedFrom`으로 관계 추적 가능; 전용 그룹 UI는 후속.

## Accept criteria (WP6 C 게이트)

1. E2E: 생성→키잉→"프로젝트에 저장" → generatedDir에 keyed PNG + 사이드카(derivedFrom) + asset 레코드(folderId=선택 프로젝트) 생성 (파일/API 캡처, 활성화 증거).
2. `tests/asset-derived.test.ts` 통과 (경로 탈출·시그니처 거부 케이스 포함).
3. assets 탭 해당 프로젝트에서 keyed PNG가 투명 썸네일로 표시 (스크린샷).
4. typecheck + npm test + ui build 통과.
