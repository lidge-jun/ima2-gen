---
created: 2026-07-15
updated: 2026-07-15
tags: [ima2-gen, asset-gen, chroma-key, ui-mode, plan]
status: 완료 (2026-07-15, WP1-WP11 전 사이클 DONE — _fin 이동)
---

# 에셋 생성 모드 — 개요 및 로드맵 (인터뷰 확정)

## Loop-spec

- **Archetype**: spec-satisfaction (verifier가 done을 정의; 키잉 품질은 threshold UI 결정으로 open-ended 리스크 제거)
- **Mode**: HOTL 골 루프 — 골플랜 `asset-gen-wp1-design-only-diff-level-010-040-wp2`, WP1(design-only Phase 0)~WP11 총 11 work-phase, 각각 1 PABCD 사이클
- **Verifier**: 사이클별 `npm run typecheck` + `npm test` + `cd ui && npm run build`; UI 변경은 브라우저 스크린샷 렌더 검증(C-RENDER-GROUNDING-01); 조건부 경로는 활성화 증거(C-ACTIVATION-GROUNDING-01); 크로마 산출물은 8점 픽셀 측정(001 프로토콜)
- **Stop condition**: 골플랜 c1-c11 전부 met + capturedEvidence 기록
- **Expected terminal outcomes**: DONE (E2E: 생성→threshold 키잉→프로젝트 저장 / 비디오→파생 알파 WebM 실동작) / NEEDS_HUMAN (인터뷰 결정과 충돌 시)
- **Escalation**: 동일 실패 2회 → 루트커즈 모드, 3회 → P 재계획 (LOOP-REPAIR-01)
- **HOTL bounds**: write scope = ima2-gen 레포만 (ui/src, routes/, lib/, tests/, devlog/, .codexclaw 골플랜). 토큰/시간 상한 없음(유저 지시: auto-compact 신뢰, 컨텍스트 제약 해제). 서브에이전트 전원 gpt-5.6-luna low

## 한 줄 요약

사이드바에 별도 "에셋 생성" 탭(새 UIMode `asset-gen`)을 추가한다. 배경 프리셋
크로마 그린(기본)·하양·블랙, 모델 GPT/Grok, 프로젝트(=최상위 폴더) 자동 귀속,
이미지 클라이언트 키잉(threshold 슬라이더)→알파 PNG, 비디오 그린 mp4→파생
알파 WebM(VP9)까지 완결성 최대로 구현한다. 시트 생성(040)은 설계만.

## 왜 크로마 그린이 기본인가

`260715_icon_pipeline` 조사에서 확인된 사실: 로컬 배경 제거는 rembg(Python+onnx,
무거움) 아니면 UI 전용 flood-fill뿐이고, 서버 `ima2 edit`는 생성형이라 비결정적.
생성 시점에 배경을 균일 단색으로 고정하면 배경 제거가 결정적 color-key
(sharp 픽셀 연산)로 격하된다 — ML 세그멘테이션이 필요 없어진다. 비디오는
mp4에 알파가 없으므로 크로마가 사실상 유일한 투명 배경 경로.

## 확인된 코드 사실 (2026-07-15 읽음)

- `UIMode`는 이미 `"assets"`를 포함 (`ui/src/types.ts:1`), NavRail에 assets 탭 enabled
  (`ui/src/components/NavRail.tsx:112`). 단 현재 assets 모드는 라이브러리(폴더/필터/저장,
  `ui/src/store/storeAssetsImpl.ts` 91줄)이고 생성 기능 없음.
- 서버·CLI 어디에도 `background`/`transparent` 파라미터 없음 (routes/, lib/, bin/ rg 확인).
  배경 옵션은 완전 신규.
- provider 상태는 스토어에 존재: `gpt(oauth)`, `grok`, `grok-api`, `agy`, `gemini-api`
  (`ui/src/components/GenerationControlsPanel.tsx:83-105`). 모델 피커 재사용 가능:
  `ImageModelSelect.tsx`, `GrokModelPicker.tsx`.
- 비디오는 Grok 전용 (`ima2 video`, `bin/commands/video.ts`), duration 1-15s,
  480p/720p/1080p, aspect 1:1 지원.
- 서버 v2.0.16 가동 중 확인.

## 문서 맵

000-009는 리서치/테스트, 010+는 phase별 diff-level 플랜. 각 decade 문서 = 1 work-phase = 1 PABCD 사이클 (의존 순서: UI 골격 → 프로젝트 UX → 서버 프리셋 → 이미지 키잉 → 저장 계약 → 비디오 프리셋 → 비디오 키잉 → 게이트 → 시트 설계).

- `000_plan.md` — 이 문서. 개요 + 결정 로그 + OPEN ASSUMPTIONS.
- `001_video_chroma_test.md` — feasibility 테스트 프로토콜 + 결과.
- `010_ui_asset_gen_tab.md` — WP2: asset-gen UIMode + NavRail 탭 + 생성 폼 골격.
- `011_project_ux.md` — WP3: 프로젝트 드롭다운 + 팝업 검색 + 자동 귀속.
- `020_server_background_param.md` — WP4: backgroundPreset 서버 계약 + provider 프롬프트 셰이핑.
- `021_client_keying.md` — WP5: 클라이언트 color-key 모듈 + threshold 슬라이더 UI.
- `022_keying_persistence.md` — WP6: 알파 PNG 업로드 API + derivedFrom 에셋 등록.
- `030_video_preset.md` — WP7: 비디오 backgroundPreset + planner 배경 제약.
- `031_video_keying_job.md` — WP8: ffmpeg chromakey 알파 WebM async job + 프레임 프리뷰.
- `032_video_gate.md` — WP9: n≥3 재검증 + WebM 썸네일/히스토리 연결.
- `040_sheet_design.md` — WP10: 시트 생성 설계 (구현 없음, 후속용).

## 스코프

IN:

- asset-gen UIMode 탭 + 생성 폼 (배경 프리셋 3종 + GPT/Grok 모델 선택)
- 프로젝트(=최상위 폴더) 드롭다운 + 팝업 검색 + 저장 자동 귀속
- 서버 `backgroundPreset` 파라미터와 provider별 프롬프트 셰이핑 (플래너 보존 포함)
- 이미지 클라이언트 color-key 키잉 + threshold 슬라이더 + 알파 PNG 저장 계약
- 비디오 파생 알파 WebM (ffmpeg chromakey async job) + 프레임 프리뷰 threshold
- 크로마 검증 (이미지 T2/T3 + 비디오 n≥3)

OUT:

- `ima2 icon` CLI 파이프라인 (별도 유닛 `260715_icon_pipeline`)
- rembg/ML 세그멘테이션 통합
- 프리셋 저장/공유 시스템
- 커스텀 hex 배경 (Q5 assumption)
- 시트 생성 구현 (040은 설계 문서만)
- agy/gemini provider의 에셋 모드 노출

## 오픈 퀘스천 (대화로 결정)

| # | 질문 | 후보 | 추천 | 상태 |
|---|---|---|---|---|
| Q1 | 에셋 관리 단위와 생성 UI 배치 | — | — | **결정 완료**: 프로젝트 단위 관리 + 드롭다운/팝업 검색. **Q1a** (2026-07-15): 최상위 폴더 = 프로젝트. **Q1b** (2026-07-15): 별도 사이드바 탭 (새 UIMode `asset-gen`) — 유저 "따로 만드는 건 맞아" |
| Q2 | GPT 네이티브 투명 배경 지원 여부 | — | — | **종결** (2026-07-15, 유저 확인): gpt-image-2는 네이티브 투명 불가 — 크로마 방식 채택의 근거. 전 모델 크로마 통일 |
| Q3 | 산출물 완결성 | 생성만 / +키잉 | — | **결정** (2026-07-15): 완결성 최대 — 이미지·비디오 키잉까지 포함하되 PABCD 단위로 phase 분할 (020/021/022) |
| Q4 | 비디오 포함 범위 | — | — | **결정** (2026-07-15): 포함, 030/031/032 순차 phase |
| Q5 | 배경 커스텀(임의 hex) 허용 여부 | 3프리셋 고정 / +커스텀 | 1차 3프리셋 고정 | OPEN ASSUMPTION으로 강등 |
| Q6 | 알파 비디오 산출 형식 (mp4 계약 충돌) | — | — | **결정** (2026-07-15): 그린 mp4 canonical 유지 + 파생 알파 WebM(VP9) 별도 저장 |
| Q7 | 키잉 실패/품질 보정 UX | 자동 재생성 / 그대로 저장 / threshold UI | — | **결정** (2026-07-15): threshold 조절 UI — 결과 화면에서 키 색상·허용치 슬라이더로 직접 보정. done 기준이 "자동 품질 게이트"에서 "보정 도구 동작 + 합리적 기본값"으로 전환됨 (open-ended 루프 리스크 해소) |
| Q9 | 아이콘 시트 생성 (그리드 → 자동 crop) | 1차 포함 / 후속 / CLI 전용 | — | **결정** (2026-07-15): 후속 phase — 단 문서 설계는 지금 완료 (040, icon 파이프라인과 crop 로직 공유) |

## OPEN ASSUMPTIONS (미해결 medium/low, 이 전제로 진행)

1. 1차 provider는 GPT/Grok만 노출 — agy/gemini-api는 에셋 모드에서 숨김 (기존 provider 표면과의 충돌은 UI 필터로 처리).
2. 배경 프리셋은 3종 고정, 커스텀 hex는 후속 (Q5).
3. 사이드카 메타에 `backgroundPreset` 필드는 신규 작업 (현 meta 객체에 없음 — generatePipeline.ts:332-356).
4. 프로젝트 드롭다운 팝업 검색은 cursor 페이지네이션과 별도의 검색 쿼리 설계 필요 (api-assets.ts cursor 재사용 불가).
5. sharp 단독 color-key는 반투명 경계·spill 한계 존재 — 021 품질 게이트를 수치화(경계 밴드 green-잔존율 등)해서 open-ended 루프化 방지.
6. 기존 최상위 일반 폴더는 전부 프로젝트로 간주 (폴더/프로젝트 구분 마커 없음 — 1차 수용, 필요시 후속 kind 마커).
7. 하위 폴더 = 프로젝트 내 분류로 재해석. root(folderId:null) 에셋은 "미분류" 가상 프로젝트로 노출.
8. 프로젝트 삭제는 기존 폴더 삭제 정책 유지 (비어 있을 때만, cascade 없음 — assetsStore.ts:407-420).
9. 파생 알파 WebM은 assets DB 별도 항목 + 메타데이터 `derivedFrom`으로 원본 연결 (스키마에 변형 관계 필드 없음). 저장 위치는 generatedDir 내부 (assets 등록 요건, routes/assets.ts:47-60).
10. WebM 썸네일은 imageThumb 미지원 (PNG/JPEG/WebP만) — 원본 mp4의 프레임 썸네일 재사용으로 설계 (031).
11. 프로젝트 선택은 신규 전역 상태로 설계 (기존 AssetsFilters.folderId는 라이브러리 필터일 뿐 — storeTypes.ts:32-46). 두 탭이 같은 Zustand 스토어를 쓰므로 동기화 자체는 자연 해결.
12. 새 UIMode 추가 표면은 10파일+ (types, App, NavRail 해시 매핑, Sidebar 정규화/분기, Mobile 3종, storePersistence 로더 — Popper 스캔 evidence 참조). 010 파일 맵을 이 목록으로 확장.
13. 생성 실행 가드가 `uiMode === "classic"` 전용 (storeGenImpl.ts:46-49) — asset-gen 모드는 별도 생성 경로 신설 (classic 액션 재사용 불가).
14. classic "생성" 탭과의 정체성 구분: asset-gen은 배경 프리셋 + 프로젝트 귀속 + 키잉이 내장된 에셋 전용 생성으로 포지셔닝. NavRail 라벨 1차 "에셋 생성" (추후 변경 가능).
15. 이미지 키잉은 **클라이언트** 전역 color-key 신규 모듈 (기존 backgroundRemoval.ts는 flood-fill·연속영역 방식이라 의미가 다름 — 참고만, :84-99). threshold 슬라이더 즉각 프리뷰는 클라이언트 소유.
16. 비디오 threshold 보정은 프레임 1장 추출(기존 ffmpeg API 재사용) → 클라이언트 프리뷰로 값 확정 → 서버 ffmpeg 재인코딩 async job (+SSE 진행 표시).
17. 클라이언트 키잉 확정본 저장은 신규 업로드 계약 필요 (/api/assets는 generatedDir 내 기존 파일만 등록 — routes/assets.ts:47-60). canvas-versions의 raw PNG body 저장(routes/canvasVersions.ts:30-50)이 참고 전례.
18. 서버 sharp 키잉은 배치/시트(040) 및 CLI 경로용으로 유지 — UI 인터랙티브 키잉과 역할 분리.

## 결정 로그

- 2026-07-15: 유닛 생성. 크로마 그린 기본 채택 방향 합의 (유저 제안).
- 2026-07-15: T1 비디오 크로마 테스트 PASS (001 참조) — 비디오 1차 포함 권고.
- 2026-07-15: 넘버링 재정렬 — 테스트 문서를 030→001로 이동 (000-009 테스트/리서치 관례), 030은 비디오 통합 플랜으로 재배정.
- 2026-07-15: 인터뷰 답변 3건 수신 — Q3=완결성 최대(phase 분할), Q4=비디오 포함(031/032), Q1=프로젝트 단위 관리 도입(모델·배치 미정).
- 2026-07-15: Mind 재스캔 #2 (ontology/constraint/success 렌즈 3개, luna-low) — HIGH 9건: 프로젝트↔폴더↔세션 모델 충돌, 생성 배치 미확정, 비디오 키잉의 ffmpeg 알파 경로·.mp4 계약 부재, 키잉 done 기준 수치화 필요, 000 stop condition 구조 불일치. HIGH 3건은 유저 질문(Q1a/Q1b/Q6), 나머지는 P에서 문서 재작업으로 흡수 예정.
- 2026-07-15: phase 맵 확장 예정 — 010(생성 UI)/011(프로젝트 UX), 020(프리셋 param)/021(이미지 키잉)/022(키잉 품질 게이트), 030(비디오 프리셋)/031(비디오 키잉 파생)/032(비디오 키잉 게이트+재검증 n≥3).
- 2026-07-15: Q1a=최상위 폴더=프로젝트, Q6=mp4 canonical+파생 알파 WebM 결정. Q1b는 유저 요청으로 다이어그램 설명 후 재질문.
- 2026-07-15: Mind 재스캔 #3 (통합 렌즈 1개, 신규 결정 2건 대상) — HIGH 6건 전부 플랜 설계로 흡수 (OPEN ASSUMPTIONS 6-10 신설). 유저 재질문 필요 항목 없음.
- 2026-07-15: Q1b 결정 — 별도 사이드바 탭 (유저가 라이브 #assets 화면 보며 확정). Mind 재스캔 #4 (B안 대상, 1렌즈) — HIGH 2건 포함 4건 전부 플랜 흡수 (ASSUMPTIONS 11-14). 오픈 퀘스천 전부 해소: Q1a/Q1b/Q3/Q4/Q6 결정, Q2는 020 조사 항목, Q5는 assumption. 인터뷰 readiness 도달.
- 2026-07-15 (closeout): WP1-WP11 전부 DONE. 라이브 E2E(플레이라이트/시스템 크롬): 프로젝트 팝업 검색→크로마 생성→threshold 슬라이더 재키잉(코너 알파 0↔19 실측)→알파 PNG 프로젝트 저장, Grok 비디오 생성→프레임 프리뷰→알파 WebM 파생(패널 keying-done 자동 닫힘). WP11 수정 3건: frame API position=first→0, eventChannel EVENT_TYPES에 keying-* 4종 등록, (WP9) keyColor 서버 자동 샘플. 게이트: typecheck/typecheck:tests/inventory/npm test 1201 전부 그린. 잔여 known-issue: ≤800px 앱 레벨 가로 오버플로우(assets 모드 공유, 후속 후보), 시트 구현(040 설계만).
- 2026-07-15: 추가 질문 3건 답변 — Q7=threshold 조절 UI, Q8/Q2=gpt-image-2 네이티브 투명 불가(유저 확인, 크로마 채택 근거), Q9=시트는 후속이되 040 문서 설계는 지금. Mind 재스캔 #5 (threshold UI 대상, 1렌즈) — HIGH 2건 포함 4건 전부 설계 흡수 (ASSUMPTIONS 15-18). 유저 재질문 필요 없음.
- 2026-07-15: phase 맵 갱신 — 021은 클라이언트 키잉 UI(슬라이더), 022는 저장 계약(업로드 API)+기본값 게이트, 040은 시트 생성 설계 문서(구현은 후속).
