# 001 — 현재 기능 delta 인벤토리 (2026-07-16 → 2026-07-20)

목적: WP4(040)/WP5(050) 계획이 쓰인 2026-07-16 이후 랜딩된 기능 중 두 WP의 범위와
교차하는 것을 확정한다. 이 문서는 **근거(인벤토리)**만 담고, 상태 판단과 재개 순서는
060이 소유한다(001=근거 / 060=상태 역할 분리 — Sol 감사 residual 반영).
조사일: 2026-07-20. 각 항목은 커밋 해시 + 트리 참조로 고정한다.

## D1 — element refs가 코어 provider에 실제로 도달 (wp4 직접 교차)

- 커밋: `2cf57d8` fix(elements): element refs reach providers — generated-dir resolution + drop visibility
- 내용: `lib/elementCompiler.ts`의 slot path는 raw로 유지하고 파이프라인이
  `config.storage.generatedDir` 기준으로 resolve. 컴파일 시 누락은
  `droppedRefs`/`refReadFailures`로 결과 메타데이터에 기록(무음 실패 제거).
  `lib/generatePipeline.ts:116-222`에서 `elementIds` 수용 → compile →
  `refsCount`/`droppedRefs`를 lineage에 기록.
- 검증 상태: oauth 생성으로 2-ref character element가 refsCount:2 + 동일 캐릭터 결과 확인(라이브).
- 저장 계약: `lib/assetsStore.ts:148-153` — element refs는 1-6개 파일 경로 배열,
  위반 시 400 `INVALID_ELEMENT_METADATA`.
- WP4 시사점: 코어 이미지 레인의 "캐릭터 일관성"은 이미 generic elementIds로 동작한다.
  WP4의 `characterElementId`는 MCP/provider 바인딩 계약으로서 별도 존재 이유가 있고(060 경고 유지),
  바인딩의 레퍼런스 저장소로 element.refs를 재사용할 근거가 생겼다(041 결정 1).

## D2 — element mention/toggle UI 어휘 확정 (wp4 UI 교차)

- `ui/src/components/ElementMentionChip.tsx`, `ElementMentionMenu.tsx` — composer mention.
- 커밋 `d0f6a22`: element 타일의 `@` 배지가 라이브러리 제거 토글로 활성화
  (`ui/src/components/assets/AssetElementToggle.tsx`).
- node-studio: `181426f` element-node persistence + missing-element run block + branch별 설정,
  `8f779d3` mention chips + IME/Escape.
- WP4 시사점: 캐릭터 선택 UX는 새 슬롯을 발명하지 않고 mention chip 어휘 위에 올린다(041 결정 4).

## D3 — MCP 미디어 파이프라인 강화 (wp4/wp5 실행 기반 교차)

- 커밋 `486dd25`: 다운로드 retry+backoff, https family-4 폴백, parsePoll 우선순위,
  5s+jitter poll, **`jobs.log` 라이프사이클 로그(taskId + sanitizedUrl만, 서명 URL 금지)**.
  `lib/mcp/jobLog.ts:20` — 위치는 generatedDir 옆 `mcp/jobs.log`.
- 커밋 `8d7cccf`: retry v4-fallback timeout, taskId in error trail, recover cancel race.
- 커밋 `4914ac5`: recover route가 catalog-only provider를 409 `MCP_EXECUTION_LOCKED`로 거부.
- recover 입력 계약(실측): `POST /api/mcp/tasks/:taskId/recover`, body는 provider(기본 runway)와
  kind(image|video)뿐 — `routes/mcpRecover.ts:86-104`. 재개는 `adapter.buildPollCall(taskId)`로
  재폴 후 재다운로드하므로 **taskId+provider+kind만으로 충분**하다.
- 시사점: WP4/WP5의 모든 생성·파생 작업은 이 파이프라인에 탑승하고, lineage에는
  taskId(+characterElementId)만 추가하면 recover가 그대로 동작한다(041 결정 3, 051 결정 2).

## D4 — capabilities contract 표면 (wp4/wp5 게이팅 교차)

- 커밋 `0cc560d`: `lib/capabilities.js`에 bundled snapshot 기반 contracts 요약 추가,
  `config.js`에 `mcp.enabledProviders/tokenDir/snapshotDir`.
- `lib/mcp/modelsCatalog.ts:101-108,189` — inputRoles가 카탈로그 entry의 capabilities로 노출.
- 시사점: wp4 캐릭터 슬롯 게이트(image_references 선언 모델만)와 wp5c Higgsfield lock 표면화는
  이 contract를 읽는다. ad-hoc 스냅샷 파싱 금지(041 결정 4, 051 결정 5).

## D5 — agent-ui 개편 (wp4/wp5 UI 부착점 이동)

- `2434db6` session thumbnail rail desktop 기본 → `377e0f8` image stage + filmstrip hero →
  `312ce1b` chrome grammar(radius tokens, quiet model pill, status chip, 56px headers) →
  `231a91e` chat de-boxing + composer hierarchy → `61f8472` stage/rail/overlay optics.
- 부착점 실측: element 상세는 `ui/src/components/assets/ElementDetail.tsx`,
  결과 액션은 `ui/src/components/ResultActions.tsx`.
- 시사점: 040 §3(ElementDetail 카드)과 050(결과 카드 액션)의 UI 계획은 여전히 유효하지만,
  문법은 새 chrome grammar를 따르고 결과 액션은 stage/filmstrip 컨텍스트 호환이어야 한다
  (041 결정 4, 051 결정 3).

## D6 — 기타 간접 교차

- `017b900` video 모델을 image 모델과 나란히 리스트(video-capable 코어 provider).
- `d2d1ea6` `ima2 serve` 싱글톤 가드(--force 외 중복 기동 거부) — CLI 스모크 시 인스턴스 전제.
- `ac7ed6c` connectionManager timer.unref 제거, `778336c`/`fdc8759` 계열 Windows CLI exit 수리 —
  검증 게이트(테스트/CI) 신뢰도에 영향, 기능 범위에는 비해당.

## 비해당 명시

- subscription-mcp-providers lane의 090 golden harness/100 provider 확장은 별 lane 범위.
  WP4/WP5는 그 결과를 기다리지 않는다(의존 없음).
- Higgsfield 결제/연결 상태는 여전히 unverified — wp5c는 결제 게이트 유지(050 결정 유지).
