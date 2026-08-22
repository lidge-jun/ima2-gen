---
created: 2026-08-23
tags: [ima2-gen, devlog, provider, comfyui, evidence, live]
---

# 001 — 실기 검증 기록 (lidge, RTX 5090)

000 로드맵을 쓸 때 로컬에 ComfyUI가 없어 프로토콜을 **2차 근거**(소스 +
공식 문서)로만 적었다. 이 문서는 그 항목들을 **1차 근거**로 승격한 기록이다.

## 환경

| 항목 | 값 |
|---|---|
| 호스트 | `ssh lidge` (lidge-AI-AI, Ubuntu, Linux 7.0.0-28-generic) |
| GPU | NVIDIA GeForce RTX 5090, 32607 MiB |
| ComfyUI | 0.27.0, frontend 1.45.20, torch 2.11.0+cu128 |
| 바인드 | `--listen 127.0.0.1 --port 8188` |
| 체크포인트 | `rinFlanimeIllustrious_v30.safetensors` (SDXL 계열) |
| 로그 | `~/logs/comfyui-260823.log` |

## 선행 사고: NVIDIA 드라이버 버전 불일치

ComfyUI 기동 전 `torch.cuda.is_available()`가 `False`였다.

    Error 804: forward compatibility was attempted on non supported HW
    NVML library version: 580.173
    NVRM version: ... 580.159.03

원인: 패키지는 `nvidia-driver-580-open 580.173.02`로 올라갔는데 커널에
로드된 모듈은 이전 부팅 시점의 580.159.03이었다. 디스크의 `.ko`는 이미
580.173.02였다(`modinfo nvidia`) — 즉 재설치가 아니라 **모듈 재로드**만
필요한 상태였다.

llama-server(8/16 기동)는 불일치 이전부터 떠 있어서 영향을 받지 않았고,
그래서 증상이 드러나지 않고 있었다.

처치: `systemctl stop gdm3` → GPU를 잡고 있던 gdm greeter의 Xorg(pid 3453)
종료 → `modprobe -r nvidia_drm nvidia_modeset nvidia_uvm nvidia` →
`modprobe nvidia nvidia_uvm` → `systemctl start gdm3`.

안전성 근거: 로컬 tty2 사용자 세션은 `loginctl`상 **2주 5일 전부터
`closing`/idle**이었고 활성 세션은 SSH 원격뿐이었다. gdm은 로그인 화면만
띄우고 있어 잃을 사용자 작업이 없었다. 재부팅(19일 uptime, cloudflared
터널 동반 재시작)보다 영향이 작은 경로를 택했다.

결과:

    NVRM version: ... 580.173.02
    NVIDIA GeForce RTX 5090, 32607 MiB, 0 MiB
    2.11.0+cu128 True / NVIDIA GeForce RTX 5090

## 검증 1 — 클라이언트 지정 prompt_id (000 §"설계를 바꾼 사실 (1)")

요청에 canonical UUID를 실어 보냈다.

    POST /prompt {"prompt": {...}, "prompt_id": "3f2a1c5e-...-8a15be237d41", "client_id": "ima2-probe"}
    -> {"prompt_id": "3f2a1c5e-...-8a15be237d41", "number": 0, "node_errors": {}}

**확인.** 서버가 클라이언트 지정 id를 그대로 채택한다. ima2의 requestId가
UUID 형식이면 상관 추적을 단순화할 수 있다. 단 requestId 형식 보장은
wp3의 선행 과제로 남는다(형식 불일치 시 서버 생성 id를 meta에 저장).

## 검증 2 — 생성 왕복 전체 경로

SDXL 7노드 그래프(768x768, 8 steps)를 제출하고 완주시켰다.

    /history/{id}.keys() -> ['prompt', 'outputs', 'status', 'meta']
    status -> {"status_str": "success", "completed": true, "messages": [...]}
    outputs -> {"9": {"images": [{"filename": "ima2_probe_00001_.png", "subfolder": "", "type": "output"}]}}

`GET /view?filename=...&subfolder=&type=output` → 796,276 바이트 PNG,
시그니처 유효, 768x768. 프롬프트("창가에 앉은 주황 태비 고양이, 부드러운
아침 빛")와 내용이 일치함을 육안 확인했다.

증거물: `evidence/001_live_generate_768.png`

`outputs -> node_id -> images -> [{filename, subfolder, type}]` 구조가
000에 적은 그대로다.

## 검증 3 — PNG tEXt 임베드 (000 §"사전 가정 정정" 확증)

수신한 PNG의 청크를 직접 순회했다.

    text_chunks [('tEXt', 'prompt', 1195)]
    api_graph_nodes ['3', '4', '5', '6', '7', '8', '9']
    node9_class SaveImage
    node6_text a calm orange tabby cat sitting by a window, soft morning li

**확인.** ComfyUI가 API-format 그래프를 tEXt `prompt` 키에 넣는다.
`--from-image` 등록은 실현 가능하다.

주의: 이 이미지에는 `workflow` 키가 **없었다**. UI가 아니라 REST로
제출했기 때문이다(프론트엔드만 `extra_pnginfo.workflow`를 붙인다).
따라서 리더는 `prompt` 키를 1순위로 삼고 `workflow` 부재를 정상으로
취급해야 한다.

## 검증 4 — 취소 경로 분기 (000 §"설계를 바꾼 사실 (2)")

1536x1536 / 60 steps 작업 3건을 동시 제출해 running 상태를 만든 뒤
두 엔드포인트를 각각 때렸다.

    before              running= ['bbbb...bbbb'] pending= []
    delete running      http 200
    after-running-delete running= ['bbbb...bbbb'] pending= []
    RUNNING_SURVIVED_DELETE True
    interrupt           http 200
    after-interrupt     running= [] pending= []
    RUNNING_KILLED_BY_INTERRUPT True
    history_status {"status_str": "error", "completed": false, ...}

**확인, 그리고 함정 하나.** `POST /queue {delete:[id]}`는 running 작업에
대해 **HTTP 200을 반환하면서 아무 일도 하지 않는다**. 성공 응답이
"취소됐다"를 의미하지 않는다. 공식 문서 표(“clear pending/running”)가
코드와 어긋나며, 코드가 맞다.

wp2 설계 반영:

- 취소는 **응답 코드가 아니라 상태 재확인**으로 확인해야 한다.
  `/queue`를 다시 읽어 대상 id가 사라졌는지 본다.
- 순서: `/queue`로 running 여부 판정 → running이면 `/interrupt`,
  pending이면 `/queue delete`. 판정과 실행 사이 레이스가 있으므로
  양쪽을 순차로 쏘는 멱등 처리가 안전하다(둘 다 200이고 부작용이 없다).
- 중단된 작업도 history에 남으며 `status_str: "error"`,
  `completed: false`다. 즉 **history 존재만으로 성공을 판정하면 안 된다.**
  `completed === true` 확인이 필수다.

## 검증 5 — 큐 동시성

3건 동시 제출 시 `queue_running`은 항상 1건이었고 나머지는 순차 소비됐다.
워커 1개 blocking 실행이라는 000의 기술과 일치한다.

부수 관찰: 가벼운 작업 3건은 폴링 간격(3초)보다 빨리 끝나 pending을 한 번도
관측하지 못했다. **테스트에서 pending 상태를 재현하려면 의도적으로 무거운
작업이 필요하다** — wp2 계약 테스트는 stub fetch로 이 상태를 합성한다.

## 000 문서에 대한 정정

000의 "8188/8189 모두 HTTP 000, 실왕복 미검증"은 이 문서로 **해소**됐다.
8189는 여전히 별개다 — `comfyui_hooking_server`(pid 30753)가 점유 중이며
ComfyUI 인스턴스가 아니다. 따라서 **다중 인스턴스(N대) 시나리오는 아직
실기 검증되지 않았다.** origin-per-record 설계의 단일 인스턴스 부분만
실증됐고, prompt_id의 인스턴스 로컬성은 여전히 2차 근거다.

## 미해결로 남은 것

| 항목 | 상태 |
|---|---|
| 다중 ComfyUI 인스턴스 간 prompt_id 격리 | **미검증** (8189는 다른 서비스) |
| WS `/ws` 진행률 스트림 | 미검증 (폴링만 확인) |
| `/upload/image` → LoadImage i2i 왕복 | 미검증 (wp2에서) |
| 깊은 큐 + 90분 inflight TTL 상호작용 | 미검증 (wp3에서) |

## 원상 복구 메모

llama-server(`llama-server-qwen38.service`)는 이 검증을 위해 정지시켰다.
**현재 정지 상태이며 ComfyUI가 8188을 점유 중이다.** 사용자가 llama를
다시 필요로 하면 `systemctl --user start llama-server-qwen38.service`.
두 서비스는 GPU 32GB를 두고 경합한다(llama가 약 5.4GB 상주).
