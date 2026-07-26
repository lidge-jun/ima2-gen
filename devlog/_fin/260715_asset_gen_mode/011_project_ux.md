---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, ui, project, wp3]
status: diff-level 확정 (WP3)
---

# 011 — WP3: 프로젝트 드롭다운 + 팝업 검색 + 자동 귀속

결정: 최상위 폴더 = 프로젝트 (Q1a, 스키마 무변경). 드롭다운은 asset-gen 탭과
assets 탭 양쪽에 공통, 확대 시 팝업 검색 (유저 UX 요구).

## 전제 (코드 확인 2026-07-15)

- 폴더 모델: `AssetFolder { id, name, parentId, ... }` (`ui/src/store/storeTypes.ts:45`), 서버 `lib/assetsStore.ts:22-28`
- 폴더 목록 API: `GET /api/assets/folders` (`routes/assets.ts:66-68`) — 전체 목록 일괄 반환 (페이지네이션 없음 → 드롭다운은 클라이언트 필터로 충분, ASSUMPTION 4의 cursor 문제는 에셋 목록에만 해당)
- 에셋 저장: `saveToAssetsImpl`이 `folderId`를 전달하지 않음 (`ui/src/store/storeAssetsImpl.ts:50-58`) — `createAsset` input은 `folderId?: string` 지원 (`ui/src/lib/api-assets.ts:24-32`)
- 라이브러리 필터: `AssetsFilters.folderId` (`storeTypes.ts:46`)
- root 에셋: `folderId: null` 허용 (`lib/assetsStore.ts:163-171`) → "미분류" 가상 항목

## 파일 변경 맵

### NEW

| 파일 | 내용 | 규모 |
|---|---|---|
| `ui/src/components/assetgen/ProjectSelect.tsx` | 프로젝트 드롭다운: 최상위 폴더(parentId==null)만 나열 + "미분류" 항목 + "새 프로젝트…"(이름 입력 → `createAssetFolder`) + 하단 "검색 확대" 버튼 → ProjectSearchPopup. 트리거는 `<button aria-haspopup="listbox">` + 네이티브 키보드 경로 (a11y §7) | ~120줄 |
| `ui/src/components/assetgen/ProjectSearchPopup.tsx` | 모달 팝업: 검색 input(클라이언트 필터, 폴더 전량이 이미 로드됨) + 결과 리스트 + 선택. focus trap + ESC 닫기 (`a11y-patterns` 준수) | ~110줄 |

### MODIFY

| 파일 | 변경 |
|---|---|
| `ui/src/store/storeTypes.ts` | `AssetGenState`에 `selectedProjectId: string \| null` (null="미분류") + `setSelectedProject(id)` 추가. **전역 공유 상태** — assets 탭도 이 값을 읽음 (ASSUMPTION 11: 단일 Zustand 스토어라 동기화 자연 해결) |
| `ui/src/store/storeAssetGenImpl.ts` | `generateAssetGen` 완료 시 결과를 `createAsset({ filePath, kind, folderId: selectedProjectId ?? undefined, metadata: { backgroundPreset, source: "asset-gen" } })`로 자동 등록 — 저장 실패는 결과 카드에 재시도 배지 (에러 dead-end 금지, UX-STATE-01) |
| `ui/src/components/assetgen/AssetGenWorkspace.tsx` | 폼 상단에 ProjectSelect 마운트 |
| `ui/src/components/assets/AssetsWorkspace.tsx` | 헤더에 동일 ProjectSelect 마운트 — 선택 시 `setAssetsFilters({ folderId: selectedProjectId })` 연동, "미분류" 선택 시 folderId 필터 해제 + root-only 클라이언트 필터 |
| `ui/src/store/storeAssetsImpl.ts` | `saveToAssetsImpl`에 `folderId: get().selectedProjectId ?? undefined` 전달 (기존 호출자 무영향 — optional) |
| `ui/src/i18n/*.ts` | `project.select`, `project.unassigned`("미분류"), `project.new`, `project.search` 키 |

## 동작 계약

- 드롭다운 항목 = `folders.filter(f => f.parentId === null)` + 고정 "미분류".
- 하위 폴더는 프로젝트 내 분류로 유지 (ASSUMPTION 7) — 드롭다운에 노출하지 않음.
- 프로젝트 삭제/이름변경은 기존 assets 폴더 관리 UI 소유 (ASSUMPTION 8, 이 WP 범위 아님).
- 선택 상태는 localStorage에 저장하지 않음 (세션 로컬; 폴더 삭제 시 stale 참조 방지 —
  마운트 시 폴더 목록에 없으면 null로 리셋).

## Accept criteria (WP3 C 게이트)

1. asset-gen 탭에서 프로젝트 선택 → 이미지 생성 → 해당 폴더에 asset 레코드 생성 확인 (API 조회 캡처, 활성화 증거).
2. "미분류" 선택 시 folderId 없이 등록되고 assets 탭 미분류 뷰에 노출.
3. 팝업 검색: 10+ 폴더 시드 상태에서 부분 문자열 검색·선택 동작 (스크린샷).
4. 새 프로젝트 생성 → 즉시 드롭다운/양 탭 반영.
5. 키보드만으로 드롭다운→팝업→선택 완주 (a11y).
6. typecheck + ui build + 기존 테스트 회귀 통과.
