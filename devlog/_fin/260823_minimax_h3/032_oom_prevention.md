---
created: 2026-08-23
tags: [ima2-gen, devlog, minimax-h3, oom, lidge]
---

# 032 — 32GB RAM에서 호스트가 안 굳게

원인: ComfyUI dynamic VRAM이 pinned (page-locked) host RAM을 크게
예약한다. pinned 메모리는 스왑 불가. MiniMaxH3 스테이징(~24GB)이
30Gi RAM을 잠그면 sshd/cloudflared/tailscaled가 스케줄되지 않고
터널이 죽는다. 스왑을 48G 늘려도 pinned는 못 빠져나간다. 리셋 전
실측: oom-kill python rss=25.9Gi, 이후 모든 SSH 경로(CF/TS/LAN) 무응답.

호스트는 전원 리셋 후 복구됨 (uptime 10분, load 0.00, ComfyUI 미기동).
모델 파일은 디스크에 그대로 있다. 이 문서 시점에서는 재로딩하지 않음.

## 적용한 가드 (리셋 직후, 모델 로드 없음)

| 가드 | 내용 |
|---|---|
| 스왑 persist | /swap_h3.img 48G, fstab 등록, 현재 활성 (8+48=56G) |
| ComfyUI 유닛 | /etc/systemd/system/comfyui.service — `--disable-pinned-memory --cache-none` |
| cgroup 한도 | MemoryHigh=16G, MemoryMax=20G. 넘으면 ComfyUI만 죽음 |
| OOM 우선순위 | ComfyUI +800, cloudflared/sshd/tailscaled -900. 희생 순서가 모델 프로세스 |
| 기동 경로 | `sudo systemctl start comfyui` (또는 ~/bin/comfyui-safe.sh). 유닛은 disabled — 부팅 자동 기동 없음 |

다음 생성은 **유닛으로만** 띄운다. `nohup python main.py` 는 다시
호스트를 굳힌다. 모델 로드는 사용자가 생성 재개를 지시할 때.
