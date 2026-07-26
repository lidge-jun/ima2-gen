---
title: C 감사 repair synthesis
date: 2026-07-15
tags: [ima2-gen, asset-gen, keying, audit, repair]
status: complete
---

# 001 — C 감사 repair synthesis

## Reviewer verdict

Bohr (`gpt-5.6-luna`, low) 최종 감사 1차: `VERDICT: FAIL`, High 4건.

## Root cause / disposition

1. **stale image onload race — 수용**: source 변경 시 이전 `Image.onload`가 state를 덮을 수 있다. effect cleanup에서 active flag와 handler 제거를 추가한다.
2. **video SSE subscription lifetime — 수용**: terminal 이벤트에서만 `unsub()`해 target 변경/닫기 시 listener가 남는다. ref 소유 + target 변경/unmount cleanup으로 수명을 패널과 묶는다.
3. **malformed progress/error payload — 부분 수용**: `eventChannel`이 requestId 없는 payload를 handler에 전달하지 않지만, handler가 필드 타입을 직접 검증하면 경계가 더 명확하다. number/string guard를 추가한다.
4. **image save filePath trust — 수용**: TypeScript 응답 타입만 믿고 runtime string/non-empty 검증이 없다. 잘못된 응답은 기존 save error 경로로 보낸다.
5. **derived key conditional uniqueness — 수용**: 서버 filename은 timestamp 기반이지만 SSE replay/중복 응답까지 UI가 가정할 필요는 없다. store에서 filename dedup을 추가한다.
6. **slider explicit id / canvas keyboard picker — blocker로는 반박**: 세 range는 각각 wrapping `<label>` 안에 있어 accessible-name 연결이 성립한다. canvas eyedropper는 좌표 선택 기능이라 키보드와 동등한 좌표 입력을 추가하려면 별도 색상 입력 UX가 필요하고 이번 사용자가 요청한 비교/결과 표시에 포함되지 않는다. 기존 reset/default slider 경로는 키보드로 조작 가능하다.

## Repair verification

- source contract에 image effect cleanup, subscription ref cleanup, payload guards, filePath guard, filename dedup을 추가한다.
- `npm run typecheck`, targeted test, UI build를 다시 실행한다.
- 같은 reviewer에게 이 문서와 실제 변경을 재감사시킨다.

## Round 2

- 같은 reviewer 재감사에서 이미지 upload 완료 콜백의 target ownership guard가 빠진 High 1건을 확인했다.
- 비디오 POST 완료와 동일하게 `targetFilenameRef.current !== item.filename`이면 UI 삽입·toast·close를 건너뛴다. 서버에 이미 저장된 파생 asset은 보관되며 현재 대화상자의 소유권만 보호한다.

## Round 3

- reviewer는 blocker 0의 near-pass를 주고, 이전 요청의 늦은 rejection/finally가 새 target의 `saveError`·`saving`을 건드릴 수 있는 Medium 1건을 남겼다.
- 이미지/비디오 catch와 이미지 finally도 target ownership을 확인하도록 수정했다.

## Round 4

- blocker 0 near-pass의 마지막 Medium은 upload 전 `canvas.toBlob` 콜백이 늦게 돌아오는 경우였다.
- 콜백 입구에서 target ownership을 검사해, target이 바뀌었으면 null-blob error state도 쓰지 않고 upload도 시작하지 않는다.

## Round 5

- malformed `keying-done`에 `filePath`가 없어도 성공 toast 후 닫히는 Medium을 확인했다.
- non-empty filePath 분기 안에서만 카드 삽입·성공 toast·close를 실행하고, 잘못된 done payload는 패널을 유지한 채 save error를 표시한다.
