---
created: 2026-08-25
tags: [ima2-gen, devlog, phase4, closeout, outcome]
---

# 090 — outcome: comfy video, provider UX, dynamic capability

terminal outcome: **DONE**

## 사용자가 보고한 것과 실제 원인

"comfy로 연결한 gui에서 minimax h3에서 모델 클릭하고 지정이 안되는거 같은데"

클릭 핸들러 버그가 아니었다. **세 겹의 의도적 lock 위에 미구현 실행 경로**가 있었고,
UI는 네 곳에서 선택을 버렸다.

| 층 | 위치 | 상태 |
|---|---|---|
| 카탈로그 lock | routes/models.ts:55,317 | 제거 |
| video route 거부 | routes/video.ts:188 | comfy 수용 |
| providerOptions 거부 | lib/providerOptions.ts:84 | 사유 교정 (엔드포인트 안내) |
| onModelChange 조기 return | GenProviderModelSelect.tsx:197 | 선택 수용 |
| 행이 영구 disabled | 같은 파일 :302 | 조건부 |
| selectVideoModelImpl 강제 치환 | storeSettingsImpl.ts:493 | 별도 필드로 우회 |
| payload provider 강제 캐스팅 ×2 | storeVideoImpl.ts:129,297 | lane 유도 |

하나만 고쳤다면 실패 지점이 한 칸 뒤로 밀리고 더 조용해졌을 뿐이다.

## 감사 통계

4개 라운드에서 독립 리뷰어가 **27건**의 블로커를 냈다 (6, 8, 8, 5). main이 전부
실제 소스로 재검증했고 **1건을 근거로 기각**했다 — 리뷰어가 core SaveVideo가 `videos`
키로 직렬화한다고 주장했으나 `_ui.py:432-437`을 직접 열어 `images`+`animated`임을
확인했다. 5번째 리뷰어는 20분 무응답으로 은퇴시키고 main이 직접 diff를 감사했다.

가장 값진 발견은 wp2의 B1이었다: 계획대로 플래그만 카탈로그 유도로 바꿨다면 ComfyUI를
고른 상태에서 Grok video 행이 나타나 조용히 provider를 바꿨을 것이다.

## 렌더 관측이 잡은 것 (정적 게이트가 놓친 것)

1. H3 라벨 잘림 — `stacked` 플래그를 조건부로 만들며 재발. tsc/test/build 전부 통과.
2. trigger로 새는 상태 배지 — 감사가 미리 지적, 관측으로 확인.

## 배포 증거

    origin/dev  5e7646cb  (local HEAD와 일치, ahead 0)
    dist build  13:38:34
    process     13:58:00  ← dist보다 늦음

버전 문자열은 재시작 전에도 3.10.0이었다. 프로세스 시작 시각이 dist mtime보다 늦다는
것이 실제 배포 증거다.

라이브 확인:

    /api/models      comfy video H3 lockReason = NONE
    /api/capabilities  lanes 필드 존재, source=server
    ima2 capabilities  12 lane 상태 + 사유 출력
    ima2 video --help  --provider <grok|grok-api|comfy|runway|higgsfield>

## 명시적으로 남긴 것 (놓친 것 아님)

1. **comfy video 라이브 GPU 실행 증거.** 사용자의 18188 박스가 꺼져 있고 이 루프의
   쓰기 범위 밖이다. 코드 경로는 fired-branch trace(`outputs-empty-retry attempt=1,2`)와
   7개 어댑터 테스트로 증명됐으나, 실제 GPU에서 mp4가 나온 것은 확인하지 못했다.
2. `docs/CLI.md` + 번역 3종의 손수 관리 provider 목록.
3. `ProviderStatusSelect.tsx`가 core 9개를 하드코딩하고 comfy가 없다.
4. `locked` 배지와 미지 lane 폴백은 구현됐으나 이 환경에서 발화 불가.

## 남긴 부작용 복구

개발 서버가 `~/.ima2/server.json`을 덮었다가 종료 시 삭제했다. 서비스를 재시작해
복구했고, CLI가 다시 3333을 찾는다. 내가 만든 오염이므로 내가 치웠다.
