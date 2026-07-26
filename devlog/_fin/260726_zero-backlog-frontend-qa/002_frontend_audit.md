---
title: "002 — 프론트엔드 폴리시 감사 결과"
lane: "260726_zero-backlog-frontend-qa"
created: 2026-07-26
kind: research
policy: "codexclaw:cxc-dev-frontend §7 + FE-A11Y-POLISH-01 + FE-AI-TELL-01 + responsive-viewport"
evidence: "explorer(gpt-5.6-sol) read-only 정적 감사 19건 + 메인 확인"
---

# 002 — 프론트엔드 폴리시 감사 결과

`cxc-dev-frontend` 기준으로 `ui/src` 전 표면을 정적 감사했다. P0(완전 접근 불가)는
없었다. P1 9건, P2 10건이 남았고 아래처럼 WP에 배분한다.

## 이미 양호한 것 (재작업 금지)

같은 것을 다시 만들지 않도록 먼저 기록한다.

- 전역 `:focus-visible` 링 — `ui/src/index.css:133-137`
- `Toast`의 `aria-live` + `role="status"/"alert"` — `ui/src/components/Toast.tsx:105-112`
- `useModalFocus`를 이미 쓰는 다이얼로그 — `OnboardingPopup`, `ProviderReadinessPopup`,
  `MetadataRestoreDialog`, `ApiDisabledModal`
- `MobileComposeSheet`의 `inert` + tablist + Escape 처리

즉 포커스 훅은 이미 존재한다. WP1은 훅을 새로 만드는 게 아니라 **누락된 다이얼로그에
기존 훅을 적용**하는 작업이다.

## P1 — 명백한 위반

| # | 위반 | 위치 | WP |
|---:|---|---|---:|
| 1 | `PromptDetailModal`에 `role="dialog"`/`aria-modal`/Escape/포커스 이동 전무 | `ui/src/components/PromptDetailModal.tsx:29-36` | WP1 |
| 2 | 배경 클릭 닫기가 비대화형 div `onClick`뿐 (키보드 불가) | `ui/src/components/PromptDetailModal.tsx:30-32` | WP1 |
| 3 | `GalleryModal` 포커스 트랩·복원 없음 (Escape만) | `ui/src/components/GalleryModal.tsx:118-125` | WP1 |
| 4 | tablist에 `aria-controls`/화살표 키 없음 | `ui/src/components/GalleryModal.tsx:444-483` | WP1 |
| 5 | `CustomSizeConfirmModal` Tab이 다이얼로그 밖으로 탈출 | `ui/src/components/CustomSizeConfirmModal.tsx:22-30` | WP1 |
| 6 | 갤러리 닫기 버튼 32×32px | `ui/src/styles/gallery-modal.css:156-163` | WP2 |
| 7 | assets 폴더 헤더 버튼 28×28px | `ui/src/styles/assets-workspace.css:8` | WP2 |
| 8 | assets 폴더 액션 버튼 25×25px | `ui/src/styles/assets-workspace.css:17-21` | WP2 |
| 9 | assets 상세 닫기 30×30px | `ui/src/styles/assets-workspace.css:70-72` | WP2 |
| 10 | `InFlightList` 진행 상태가 라이브 리전 아님 | `ui/src/components/InFlightList.tsx:45-49` | WP1 |

## P2 — 폴리시 개선

| # | 항목 | 위치 | WP |
|---:|---|---|---:|
| 11 | Toast dismiss 라벨이 미번역 하드코딩 + 닫기 표시가 `x` 문자 | `ui/src/components/Toast.tsx:113-120` | WP3 |
| 12 | 갤러리 로딩 메시지에 `role="status"` 없음 | `ui/src/components/GalleryModal.tsx:542-545` | WP1 |
| 13 | 다이얼로그 제목이 `h4` 고정 | `ui/src/components/PromptDetailModal.tsx:34` | WP1 |
| 14 | 즐겨찾기에 `★`/`☆` 문자 사용 | `ui/src/components/PromptDetailModal.tsx:68-72` | WP3 |
| 15 | 같은 문제 | `ui/src/components/PromptLibraryRow.tsx:51` | WP3 |
| 16 | **프롬프트 저장** 버튼이 별 문자 사용 (즐겨찾기 아님) | `ui/src/components/ImageNode.tsx:339` | WP3 |
| 17 | assets 220px+360px 고정 컬럼이 중간 뷰포트 압박 | `ui/src/styles/assets-workspace.css:3-4` | WP2 |
| 18 | assets 툴바 150px 고정 컬럼 | `ui/src/styles/assets-workspace.css:29` | WP2 |
| 19 | `SizePicker` 4열 고정, 중간 뷰포트 대응 없음 | `ui/src/styles/form-controls.css:87-91` | WP2 |
| 20 | 전역 `prefers-reduced-motion` 미대응 | `ui/src/index.css` | WP2 |

## 판단 근거 몇 가지

**별 문자(#14~16)를 이모지 금지 규칙으로 묶지 않았다.** FE-AI-TELL-01의 STRICT
대상은 이모지다. `★`는 엄밀히 이모지가 아니라 딩벳 문자지만, 폰트에 따라 렌더가
달라지고 스크린리더가 "검은 별"로 읽는다. 접근성과 렌더 일관성 문제로 P2에 두고
`FavoriteStarButton` 컴포넌트가 이미 있으므로 그것으로 통일한다.

**#16은 즐겨찾기가 아니다 (2026-07-26 정정, A-감사 blocker 6).**
`ui/src/components/ImageNode.tsx:339`의 `☆`는 `aria-label`이
`promptLibrary.saveTitle`인 **프롬프트 저장 팝오버 트리거**다. `FavoriteStarButton`으로
바꾸면 의미가 더 틀어진다. 저장을 뜻하는 별도 아이콘 + `aria-haspopup`/`aria-expanded`로
처리한다. 상세는 `030_icon_copy_cleanup.md` §030-4.

따라서 **C3의 검증 기준은 "별 문자 전수 0건"만이 아니라 "각 글리프가 의미에 맞는 SVG
아이콘과 ARIA 계약으로 대체됨"이다.** 문자 개수만 세면 저장 버튼을 즐겨찾기로 잘못
분류하는 것과 같은 오류를 자동화하게 된다. `tests/ui-glyph-policy.test.ts`는 딩벳 문자
0건을 기계적으로 검사하되, 각 대체가 의미에 맞는지는 리뷰가 판단한다.

**전역 reduced-motion(#20)에 `!important` 전면 차단을 그대로 쓰지 않는다.**
생성 진행 스피너는 상태를 전달하는 기능적 모션이다. 전부 0.01ms로 죽이면 진행
중인지 멈춘 건지 구분이 안 된다. 진행 표시는 정적 텍스트 상태를 함께 보장한 뒤
장식 모션만 끈다.

**터치 타깃을 44px로 올릴 때 아이콘 크기는 유지한다.** 히트 영역만 키우고 시각
아이콘은 16~20px로 둔다. 그렇지 않으면 조밀한 도구 UI가 갑자기 소비자 앱처럼
헐거워진다(VISUAL_DENSITY 회귀).

## 렌더 검증 계획 (C-RENDER-GROUNDING-01)

각 UI work-phase의 C에서 로컬 서버를 띄우고 브라우저로 실제 관찰한다.
뷰포트는 390(모바일), 768(태블릿), 1440(데스크톱).
정적 통과(tsc/빌드)는 이 규칙을 만족하지 않는다.
