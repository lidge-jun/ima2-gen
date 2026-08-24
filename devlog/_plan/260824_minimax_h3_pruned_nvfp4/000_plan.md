---
created: 2026-08-24
tags: [ima2-gen, devlog, comfyui, minimax-h3, nvfp4, rtx-5090, roadmap]
---

# 000 — MiniMax H3 pruned NVFP4 실기와 ima2 비디오 workflow 통합

## Loop spec

- Archetype: spec-satisfaction repair.
- Trigger: lidge에는 25.5GB `nvfp4_mixed` DiT가 설치돼 있지만 사용자가 지정한
  12.5GB `pruned_nvfp4` DiT는 없고, ima2는 Comfy workflow를 이미지 모델로만
  투영한다.
- Goal: lidge의 RTX 5090에서 pruned NVFP4를 Native ops로 실제 로드해 H3 비디오
  한 건을 완주하고, 같은 workflow 이름이 ima2의 Comfy 비디오 모델로 정직하게
  표시되게 한다.
- Non-goals: ima2를 통한 Comfy 비디오 실행, R2V/ref2va, 1.0MP 이상 튜닝,
  SageAttention/Sol-Attn 신규 설치, 라이선스 승인 판단, push·PR·release·publish.
- Verifier: 원격 `system_stats`/`object_info`/시작·모델 로드 로그, `/prompt`와
  `/history`, 출력 매직바이트·크기·시간·VRAM; 로컬 typecheck, targeted tests,
  inventory, UI build, 실제 `/api/models`와 렌더된 selector.
- Stop: 모든 criteria가 fresh evidence로 충족되면 DONE. 외부 인증·호스트·파일
  부재는 BLOCKED, 호스트 안정성 위험은 UNSAFE, 라이선스 승인은 NEEDS_HUMAN.
- Memory artifact: 이 폴더의 `000`~`040` 문서와 evidence 하위 경로.
- Escalation: 동일 실패 2회면 RCA, 3회면 P로 복귀한다. 서로 다른 Sol agent 두 명이
  같은 작업 패킷을 실패하면 main이 직접 회수한다.

## Resource bounds

- 도구/자격 범위: `ssh lidge`, 공개 Hugging Face 읽기, 로컬 repo와 localhost.
- 원격 쓰기 범위: `/home/lidgeai/ComfyUI/models/diffusion_models/`,
  `/home/lidgeai/tmp/ima2-h3-pruned/`, 보호된 `comfyui.service`의 start/stop,
  H3 출력 폴더. 기존 mixed 파일은 삭제·이름변경하지 않는다.
- 로컬 쓰기 범위: 이 devlog unit과 감사된 ima2 Comfy/video/UI/test/structure 파일.
- 비용: 공개 파일 다운로드와 로컬 GPU 실행만. 유료 API 호출 없음.
- 벽시계: 총 6시간, 010 60분, 020 120분, 030 120분, 040 60분.
- GPU: H3 실행 전 llama-server 등 5090 점유 프로세스를 소유 unit 기준으로
  정상 stop하고, 종료 시 원래 active 상태를 복원한다.

## 현재 확인된 사실

| 항목 | 2026-08-24 실측 |
|---|---|
| ComfyUI | 0.33.3, `4da9e2dbead52fc1e68beae33fe3d7ad63b63241` |
| torch | 2.13.0+cu130 |
| GPU | RTX 5090, compute capability 12.0 |
| Native NVFP4 | 과거 H3 모델 로드 로그에서 `Native ops: ..., nvfp4, ...`; emulated 0건 |
| 서비스 | `comfyui.service` inactive/dead, disabled |
| 안전 가드 | `--disable-pinned-memory --cache-none`, MemoryHigh 16G, MemoryMax 20G |
| VRAM 충돌 | llama-server PID 3100이 28,338MiB 점유 |
| 설치 DiT | `minimax_h3_fl2va_nvfp4_mixed.safetensors`, 25,543,362,094 bytes |
| 목표 DiT | `minimax_h3_fl2va_pruned_nvfp4.safetensors`, 12,528,636,800 bytes |
| 목표 SHA-256 | `72fa9269ce551fb63ff42a32d9b46d0c122e84b4b2c511e22fa698287b088f70` |

기존 unit의 `021_wp2_download_evidence.md`는 mixed 파일의 역사적 영수증이므로
수정하거나 덮어쓰지 않는다. 새 파일은 별도 이름으로 함께 두고 workflow만
pruned 파일을 가리킨다.

## Dependency-ordered work-phase map

| WP | decade | 결과 | 의존 |
|---|---|---|---|
| wp0 | 000 | 본 docs-only diff-level roadmap 잠금 | — |
| wp1 | 010 | pruned DiT 영수증 + 보호 unit 기동 + current object_info | wp0 |
| wp2 | 020 | bounded T2V/I2V terminal output + Native/VRAM/RAM 증거 | wp1 |
| wp3 | 030 | Comfy video workflow store/catalog/CLI/UI 노출, 실행은 명시적 locked | wp2의 실제 workflow 이름 |
| wp4 | 040 | 전체 게이트·live API/UI smoke·독립 검토·로컬 commit | wp3 |

한 work-phase는 한 PABCD cycle이다. 010과 020을 한 B에 합치지 않는다.

## Existing code gaps

- `lib/comfyWorkflowStore.ts:80`: workflow에 media kind가 없다.
- `routes/models.ts:248-277`: 모든 Comfy workflow를 `models.image`에 넣고
  `models.video`를 비운다.
- `lib/comfyImageAdapter.ts:207-247`: history의 images만 수집하고 다운로드를
  이미지 매직바이트로 제한한다.
- `routes/video.ts:188`: classic video provider가 Grok 계열로 제한된다.
- `ui/src/store/storeVideoImpl.ts:125`: video payload provider가 Grok으로 강제된다.
- `ui/src/store/storeSettingsImpl.ts:383-398`: `setComfyWorkflowImpl` 주석은 있지만
  구현이 없다.
- `ui/src/components/GenProviderModelSelect.tsx:270`: Comfy 목록을 이미지 그룹에만
  그린다.
- `bin/commands/models.ts:48,88`: label을 읽어도 사람용 표에는 출력하지 않는다.

## Necessity gate

- Do nothing: 목표 pruned 파일이 없고 실기 결과도 없어 기각.
- Delete: 기존 mixed 파일은 rollback 영수증이므로 기각.
- Configure only: `--label`로 이름만 보이게 할 수 있지만 H3 비디오가 이미지
  목록에 들어가 실행 시 `COMFY_IMAGE_INVALID`가 되므로 기각.
- Reuse: 현재 native Comfy 제출/폴링/취소와 video artifact persistence를 재사용한다.
- New dependency: 없음.

## Success criteria

1. 원격 파일 크기와 SHA-256이 업스트림 blob metadata와 일치한다.
2. 현재 model-load 로그가 `nvfp4`를 Native ops로 기록하고 emulated에는 기록하지 않는다.
3. bounded H3 job이 terminal success history와 실제 MP4/WebM 산출물을 남긴다.
4. workflow label `MiniMax H3 FL2VA pruned NVFP4`가 `/api/models`, `ima2 models`,
   UI 비디오 그룹에 보이고 기존 image workflow가 유지된다.
5. Comfy 비디오 실행 미지원 상태가 API와 UI에서 locked로 보이며, 이미지 경로로
   잘못 실행돼 `COMFY_IMAGE_INVALID`를 내는 선택은 차단된다.
6. 전체 verifier와 독립 리뷰가 통과하고 evidence 문서와 로컬 commit이 남는다.

## Rollback

- 원격: pruned 파일을 삭제하지 않고 `.disabled`로 이동하는 대신, workflow를
  기존 mixed 파일로 되돌리고 Comfy unit을 stop한다. 기존 mixed 파일 자체는 보존된다.
- GPU peer: 실행 전 확인한 llama-server unit이 원래 active였을 때만 다시 start한다.
- 로컬: 각 B의 atomic commit을 `git revert` 가능하게 분리한다. push하지 않는다.
