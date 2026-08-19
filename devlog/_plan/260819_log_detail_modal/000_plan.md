---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, ui, log, modal]
---

# 000 — Log 탭 행 클릭 상세 모달

## 목적

우측 패널 Log 탭(GenerationRequestLogPanel)의 행을 클릭하면 opencodex GUI
Logs 페이지의 상세 다이얼로그처럼 로그 엔트리 전체를 보여주는 팝업을 띄운다.
구현 후 dev 푸시 + stable 릴리스까지 완료한다.

## 조사 요약 (opus-5, 2026-08-19)

### opencodex 참조 패턴 (gui/src/pages/Logs.tsx)

- `useState<LogEntry | null>` detail 상태 + 조건부 다이얼로그 렌더.
- 섹션 구조: `log-detail-section` + `log-detail-grid`(label/value 2열 grid,
  `grid-template-columns: max-content minmax(0,1fr)`).
- requestId 복사 버튼(1200ms "copied" 리셋), 긴 값은 break 클래스.

### ima2 정본 패턴

- **PromptDetailModal.tsx가 최적 전례** (사이드바 목록 → 엔티티 상세 팝업).
  `useModalFocus(true, onClose)` + `__backdrop` div 클릭 닫기 + BEM CSS.
- a11y 하드 계약: `tests/a11y-modal-contract.test.ts`의 DIALOG_SURFACES에
  신규 모달 등록 필수. role=dialog, aria-modal, labelledby, useModalFocus 사용,
  자체 keydown listener 금지.
- **portal 필요** (조사 6절): 모바일 drawer가 transform을 걸면 fixed의
  containing block이 바뀌어 비-portal 모달이 drawer 안에 갇힌다.
  `createPortal(..., document.body)`는 InFlightPopup/Select 등 기존 패턴.
- z-index: 60(prompt-detail)~130(toast) 사다리. 모달은 100, toast(130) 아래.

### 데이터 형태 (서버-UI 동일, 7필드)

id / requestId / createdAt(epoch ms) / prompt / requested / succeeded /
error(코드 문자열 | null). provider·model·소요시간은 **로그에 없다**.

**범위 결정: 서버 스키마 확장은 이번 유닛 OUT.** 모달은 존재하는 7필드를
보여준다. provider/model 추가는 `lib/generatePipeline.ts` line 685 write site
확장이 필요한 별도 유닛(classic 경로만 기록되는 구조적 한계도 함께 다뤄야 함).

### UX 결정 (조사 6절 반영)

- 행 클릭 = 모달 열기로 변경. **복사 기능은 모달 안의 프롬프트 복사 버튼으로
  이동** (PromptDetailModal과 동일한 형태). `generationLog.copy/copied` 키 재사용.
- 선택 상태는 엔트리 객체 스냅샷으로 저장 (activeGenerations 갱신으로 items가
  교체돼도 열린 모달 내용은 고정 — 로그는 불변 기록이라 스냅샷이 자연스럽다).

## work-phase 지도

| WP | decade | 내용 |
|---|---|---|
| wp0 | 000 | 본 로드맵 (docs-only) |
| wp1 | 010 | 모달 구현 + 게이트 + 브라우저 스모크 |
| wp2 | 020 | dev 푸시 + stable 릴리스 |

## 검증 게이트

npm run typecheck / typecheck:tests / npm test / test:inventory(신규 테스트
파일 시 재생성) / cd ui && npm run build / agbrowse 스모크.
릴리스는 260818 유닛 030의 검증된 절차(atomic push + 이중 승인)를 따른다.
