---
created: 2026-08-24
tags: [ima2-gen, devlog, review, comfyui, minimax-h3, phase2]
---

# 024 — wp2 pre-execution main review

두 Sol implementation reviewer가 3회 bounded wait 안에 artifact를 내지 못했고,
세 번째 fork는 untracked 파일을 볼 수 없어 FAIL했다. harness를 `4298cd41`에
checkpoint한 뒤 재시도했으나 두 번째 committed-head reviewer도 silent라 main이
패킷을 회수했다.

Direct line audit findings:

1. stale `020_comfy_tail.log`/result가 남으면 새 run이 false-pass 가능.
   - 모든 run-owned receipt/output을 mutation 전에 explicit remove.
2. fresh log가 Native line만 요구해 startup/다른 load와 혼동 가능.
   - 같은 fresh segment에 `Requested to load MiniMaxH3`도 필수.
3. `completed:false`를 즉시 terminal error로 취급하면 future schema에서 running
   history를 오판 가능.
   - explicit error/failed만 즉시 실패; queue에서 5회 사라진 non-success history는 실패.
4. cleanup이 GPU app 0을 assert하지 않음.
   - 서비스·power와 함께 compute app empty를 postcondition으로 추가.
5. remote tool/sudo availability가 mutation 뒤 드러날 수 있음.
   - `curl/file/ffprobe/xxd`와 `sudo -n true`를 power/service 변경 전에 검사.

수정 후 `bash -n`, Python compile, 14-node JSON static checks를 다시 실행한다.
