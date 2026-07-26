# 110 — Provider 확장 2+: Tier A/specialist backlog

> **Gated backlog (2026-07-16).** 001 원장의 나머지 후보를 100과 같은 절차로 추가하기 위한 대기열이다. phase 계획이 아니라 우선순위·진입 게이트 원장이며, 실행 시점에 개별 cycle의 P가 당시 provider 문서/약관을 재조사한다.

## 우선순위 대기열

| 순위 | Provider | 근거 | 진입 게이트 |
|---:|---|---|---|
| 1 | Krea | OAuth, image/video + enhance/upscale + user workflow, Veo/Kling/Runway/Sora 접근 | tools/list에서 과금 방식 재확인 (`account compute` 추정 미실증) |
| 2 | Ideogram | OAuth, generate/bulk/edit/reframe/background/upscale + dataset/train | 예시 tool 이름의 live 대조 |
| 3 | BFL FLUX | OAuth, 이미지 전문(FLUX.2 generate/edit/multi-ref/inpaint/outpaint) | organization credits 과금 UX 설계 |
| 4 | HeyGen | avatar/translation/lip-sync 전문 lane | 별도 제품 mode 결정 필요 |
| 5 | Rendley | 생성 후 editor/timeline lane | 별도 제품 mode 결정 필요 |
| — | Canva | design workflow | terms-blocked: competitive-product/export policy 검토 전 disabled |
| — | Pika | T2V/I2V/V2V + trim/stitch/overlay | provider 스스로 experimental 명시 — 격리 spike만, token store 미공유 |
| — | fal/Replicate/Leonardo/HiAPI/MiniMax/Hera/Golpo | official MCP이나 API-key/paygo | secondary opt-in lane 제품 결정 후 |

## 공통 규칙

- 추가 절차는 100의 6단계를 그대로 따른다. core 분기문 증가 0이 유지 조건.
- API-key lane은 구독 OAuth lane과 기본 UX를 섞지 않는다 (000 hard gate 2).
- 각 provider 착수 전 약관 재확인 + snapshot 번들 여부를 개별 기록한다 (040 배포 게이트).
