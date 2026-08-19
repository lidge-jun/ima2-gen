---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, wp1, ui, modal]
---

# 010 (WP1) — GenerationLogDetailModal 구현

의존: 없음.

## 파일 맵

| # | 파일 | 변경 |
|---|---|---|
| 1 | `ui/src/components/GenerationLogDetailModal.tsx` | [NEW] 상세 모달. PromptDetailModal 골격 + opencodex log-detail-grid 레이아웃 + **createPortal(document.body)** (모바일 drawer transform 대응) |
| 2 | `ui/src/components/GenerationRequestLogPanel.tsx` | [MOD] 행 onClick을 copyPrompt → setSelected(item)로 변경, 모달 조건부 렌더 |
| 3 | `ui/src/styles/right-panel.css` | [MOD] `.generation-log-detail__*` 스타일 추가 (같은 기능 파일에 병치) |
| 4 | `ui/src/i18n/en.json` `ko.json` `zh-Hans.json` `zh-Hant.json` | [MOD] `generationLog.detail*` 키 추가 (4개 로케일 전부) |
| 5 | `tests/a11y-modal-contract.test.ts` | [MOD] DIALOG_SURFACES에 GenerationLogDetailModal 등록 |

## 모달 내용 (7필드 전부)

헤더: 상태 배지(succeeded/requested, 성공=초록 실패=빨강) + 닫기 버튼.

본문 (opencodex log-detail-grid 방식, label/value 2열):

- 시각: `new Date(createdAt).toLocaleString()`
- requestId: mono + 복사 버튼 (클릭 시 toast)
- id: mono
- 요청/성공 수: `requested` / `succeeded`
- 오류 코드: `error`가 있으면 빨간 mono로 표시, 없으면 행 생략
- 프롬프트: 전문을 스크롤 가능한 pre-wrap 블록으로 (grid 밖 단독 섹션)

푸터: 프롬프트 복사 버튼 (기존 행 클릭의 복사 기능이 여기로 이동,
`generationLog.copy`/`copied` 키와 showToast 재사용).

## 구현 세부

```tsx
// GenerationLogDetailModal.tsx 골격
import { createPortal } from "react-dom";
import { useModalFocus } from "../hooks/useModalFocus";

export function GenerationLogDetailModal({ entry, onClose, onCopyPrompt }: {
  entry: GenerationRequestLogEntry;
  onClose: () => void;
  onCopyPrompt: (entry: GenerationRequestLogEntry) => void;
}) {
  const { t } = useI18n();
  const dialogRef = useModalFocus<HTMLDivElement>(true, onClose);
  return createPortal(
    <div className="generation-log-detail" role="presentation">
      <div className="generation-log-detail__backdrop" onClick={onClose} />
      <div ref={dialogRef} className="generation-log-detail__content"
        role="dialog" aria-modal="true"
        aria-labelledby="generation-log-detail-title" tabIndex={-1}>
        ...
      </div>
    </div>,
    document.body,
  );
}
```

- a11y 계약 4칙 준수: role=dialog, aria-modal, labelledby, useModalFocus.
  자체 keydown listener 금지 (Escape는 훅이 소유).
- **portal + useModalFocus 조합은 이 저장소 최초** (감사: 기존 portal 4곳
  전부 useModalFocus 미사용). 훅이 ref/document 스코프라 portal-safe함은
  코드로 확인됐고, 스모크에서 포커스 트랩/복원을 실제 검증한다.
- 하드코딩 영어 속성 금지 게이트: 닫기 버튼 `aria-label={t("common.close")}`,
  모달 안 모든 라벨은 t() 경유 (i18n-coverage-contract가 대문자 리터럴 검사).
- 행 title이 error 문자열 → detailOpen으로 바뀌는 것은 의도된 hover 표면
  다운그레이드 (오류 상세는 모달 클릭 한 번으로 이동).
- Panel 쪽: `const [selected, setSelected] = useState<GenerationRequestLogEntry | null>(null)`
  — **객체 스냅샷 저장** (000의 UX 결정: 로그는 불변 기록, refresh로 items가
  교체돼도 열린 모달은 고정). 행 onClick → `setSelected(item)`.
  기존 `copyPrompt`는 모달의 onCopyPrompt로 전달.
- 행 버튼의 title 속성은 `generationLog.detailOpen`(신규 키)으로 변경.
- CSS: fixed inset 0, z-index 100 (실측 사다리: prompt-detail 60 /
  trash-undo-toast 101 / toast-stack 130 / mobile app bar 150 /
  compose-sheet 170-180. toast와 모바일 compose sheet가 모달 위인 것은
  수용), content는
  `width: min(560px, 92vw); max-height: 80vh; overflow-y: auto`.
  프롬프트 블록은 `white-space: pre-wrap; word-break: break-word;
  max-height: 40vh; overflow-y: auto`.
- grid: `.generation-log-detail__grid { display: grid;
  grid-template-columns: max-content minmax(0, 1fr); gap: 6px 12px; }`

## i18n 신규 키 (4로케일)

`generationLog.detailOpen`(행 title), `generationLog.detailTitle`,
`generationLog.detailTime`, `generationLog.detailRequestId`,
`generationLog.detailCounts`, `generationLog.detailError`,
`generationLog.detailPrompt`, `generationLog.detailCopyId`.
(복사 버튼은 기존 `generationLog.copy`/`copied` 재사용.)

## 테스트/검증

- `tests/a11y-modal-contract.test.ts` DIALOG_SURFACES 등록 → 계약 4칙 자동 검증.
- 신규 테스트 파일 없음 → test:inventory 재생성 불필요 (실측 확인).
- i18n parity 테스트가 있으면 4로케일 키 일치 확인 (rg로 테스트 존재 확인 후).
- `cd ui && npm run build` + agbrowse 스모크: Log 탭 열기 → 행 클릭 → 모달
  내용/닫기(Escape·backdrop) 확인 스크린샷.

## 수용 기준

- [ ] 행 클릭 시 상세 모달 (7필드 + 프롬프트 전문)
- [ ] Escape/backdrop 닫기, 포커스 트랩 (a11y 계약 통과)
- [ ] 프롬프트 복사가 모달에서 동작 (toast)
- [ ] 전체 게이트 + ui build + 브라우저 스모크 통과
