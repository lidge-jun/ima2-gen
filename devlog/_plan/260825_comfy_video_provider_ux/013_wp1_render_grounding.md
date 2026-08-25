---
created: 2026-08-25
tags: [ima2-gen, devlog, phase1, render-grounding, evidence]
---

# 013 — wp1 C: 렌더 관측 (C-RENDER-GROUNDING-01)

## 환경

등록된 H3 workflow의 origin(127.0.0.1:18188)은 사용자의 GPU 박스이고 꺼져 있다.
이 루프의 쓰기 범위 밖이므로 켜지 않는다. 대신 `/system_stats`만 응답하는 stub
origin(127.0.0.1:18199)을 띄우고 video workflow 하나를 등록해, GPU 없이 selector
계약을 증명했다. 관측 후 stub workflow는 제거했다.

서버: 새 빌드로 기동한 `PORT=3399 tsx server.ts` (실행 중이던 3333은 구 빌드).

## 라이브 /api/models 관측

    STATUS ready
    minimax-h3-fl2va-pruned-nvfp4 | exec= unset | lock= none | http://127.0.0.1:18188 (offline)
    stub-video-wf                 | exec= unset | lock= none | http://127.0.0.1:18199

두 row 모두 lockReason이 없다. H3의 비활성 사유는 이제 lock이 아니라 offline이다 —
wp1이 실제로 바꾼 계약이 이것이다 (012의 B7 대응).

## 브라우저 관측

1. provider를 ComfyUI로 선택 → model selector에 VIDEO MODELS 그룹이 나타남.
2. `Stub Video Workflow` 클릭 → **선택이 유지됨**. 이전에는 onModelChange가 조기
   return해서 클릭이 버려졌다 (사용자가 보고한 증상).
3. 선택 후 상단 컨트롤이 `ComfyUI` / `Stub Vide…`로 표시됨.

## 관측이 잡아낸 회귀

첫 스크린샷에서 H3 라벨이 `MiniMax H3 FL2VA pruned NVF`로 잘렸다. lockReason이
사라지면서 `stacked: true`도 함께 조건부가 됐는데, 그 플래그가 `is-stacked` CSS의
`white-space: normal`을 켜는 유일한 경로였다 (controls.css:103-108). 260824 유닛이
같은 300px 포털에서 고쳤던 문제가 되살아난 것이다.

수정: workflow 이름은 사용자가 정하므로 사유 유무와 무관하게 항상 stacked로 둔다.
재관측 결과 데스크톱/모바일 모두 `MiniMax H3 FL2VA pruned NVFP4 — offline`이 두
줄로 완전히 표시된다.

정적 게이트(tsc/build/test)는 이 회귀를 하나도 잡지 못했다. 렌더 관측만이 잡았다.

## Evidence

- `evidence/010_comfy_video_selected.png` — 선택 유지 (데스크톱)
- `evidence/011_comfy_video_dropdown.png` — 잘림 회귀 (수정 전)
- `evidence/012_comfy_video_dropdown_fixed.png` — 수정 후 데스크톱
- `evidence/013_comfy_video_dropdown_mobile.png` — 수정 후 모바일 390x844
