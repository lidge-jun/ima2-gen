---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, research, provider, video, kling, outcome]
---

# 090 — 조사 결론

**terminal outcome: DONE (조사 완료)** — 구현은 이 유닛의 범위가 아니다.

## 한 문장

Kling은 도입 가능하고, 사실 **이미 일부 도입되어 있으며**, 남은 진짜
질문은 "넣을 수 있나"가 아니라 "이미 들어와 있는 것이 동작하는가"다.

## 확정된 사실 (1차 증거)

| # | 사실 | 근거 |
|---|---|---|
| F1 | Runway 어댑터에 `kling-o3-pro`, `kling-3-pro`가 하드코딩돼 있고 실행 가능 상태 | `lib/mcp/adapters/runway.ts:51-52`, `:359` |
| F2 | Runway multishot은 모델 파라미터 없이 통째로 Kling 3.0 엔진 | `assets/mcp-snapshots/runway.sanitized.json:638` |
| F3 | 제품 문서가 이미 Kling 지원을 공표 | `site/src/pages/docs/concepts/providers.astro:178` |
| F4 | Higgsfield 인증 스냅샷에 `kling3_0`/`kling3_0_turbo` 존재, 상수 목록에는 부재 | `lib/mcp/adapters/higgsfield.ts:60-67` vs 스냅샷 |
| F5 | Higgsfield `motion_control`은 Kling 3.0 전용 툴이며 상수에 이름만 있고 **소비자가 없다** (노출 아님) | `lib/mcp/adapters/higgsfield.ts:24,34` (선언 유일), 스냅샷 `:15453` |
| F9 | higgsfield 광고 계약과 실행 허용 계약은 **독립**이다 | `lib/mcp/modelsCatalog.ts:7,194-214` vs `adapters/higgsfield.ts:179` |
| F6 | 코어 provider 8종에 Kling 없음, 비디오 코어 레인은 grok 계열뿐 | `lib/providers/registry.ts` |
| F7 | `ProviderAdapterV1`에 비디오 메서드 자체가 없음 (#151 대기) | `lib/providers/adapters/types.ts` |
| F8 | 공식 Kling 신규 3.x는 단순 API key 인증 — JWT는 레거시 전용 | kling.ai/document-api |

## 이번 조사가 막아낸 것

서브에이전트가 공개 문서만 보고 "Runway MCP는 Kling을 지원하지 않는다"고
결론냈다 (002 R-1). 그 말을 그대로 받았다면 **이미 있는 기능을 없다고 적고
처음부터 만드는 계획**을 세웠을 것이다. 우리 저장소의 인증 스냅샷이 그것을
반증했다.

일반화하면: **원격 MCP 서버가 노출하는 모델 표면은 그 벤더의 공개 HTTP API
문서보다 넓을 수 있다.** Runway와 Higgsfield 양쪽에서 같은 격차가 관측됐다.
provider 조사에서 공개 문서는 하한선이지 사실이 아니다.

## 죽은 가설

- ~~"Kling을 쓰려면 새 provider를 만들어야 한다"~~ — F1이 반증.
- ~~"Higgsfield 상수에 Kling을 추가하면 노출된다"~~ — 상수는 **실행 허용**만
  정하고, 노출은 런타임 `models_explore`가 정한다. 둘은 독립 계약이다.
- ~~"상수는 런타임 카탈로그에 덮어써진다"~~ — 초안의 표현이 틀렸다.
  덮어쓰기가 아니라 **애초에 서로 다른 소비자를 가진 별개 계약**이다.
  `lib/mcp/modelsCatalog.ts`는 higgsfield 상수를 import조차 하지 않는다.
  (독립 감사 B1이 잡아냄)
- ~~"Kling 기능이 이미 하나 노출돼 있다" (motion_control)~~ — `HIGGSFIELD_MEDIA_TOOLS`는
  선언부 외에 소비자가 0이다. 메모지 노출이 아니다. (독립 감사 B2)
- ~~"공식 API는 JWT 서명 구현이 필요하다"~~ — 신규 3.x 경로는 API key다.
  레거시 `model_name` 방식을 포기하면 회피된다.

## 미해결 — 사람이 풀어야 하는 것

| # | 질문 | 왜 에이전트가 못 푸나 |
|---|---|---|
| Q1 | Runway/Higgsfield 라이브 생성으로 Kling이 실제로 도는가 | **크레딧이 소모된다.** 과금 승인 사안 (#152 선례) |
| Q2 | 연결 계정의 `models_explore`가 Kling 3.0을 주는가 | 라이브 MCP 연결 필요 |
| Q5 | Kling이 광고되는데 실행 허용 목록에 없으면 어떤 에러가 나는가 | 라이브 연결 + 생성 시도 필요 |
| Q3 | 공식 Kling에 한국 카드로 결제 가능한가 | 결제 페이지가 JS 앱, 실제 가입 필요 |
| Q4 | L3까지 갈 것인가 | #151 종속. 제품 방향 결정 |

Q1은 특히 성격이 미묘하다. 검증에 돈이 들지만, **검증하지 않은 채로 제품
문서는 이미 Kling 지원을 광고하고 있다** (F3). 이 상태를 유지하는 것도
비용이다.

## 다음 유닛이 시작할 지점

승인되면 별도 구현 유닛에서 003의 L1 검증 항목 V1~V4부터 시작한다.
V1(스냅샷 재캡처)은 크레딧을 쓰지 않으므로 **승인 없이도 가능한 유일한
항목**이다. V2~V4는 생성 과금이 발생한다.

L2는 Q2 응답 이후에만 착수한다. L3는 #151 진척과 Q3 없이는 착수하지 않는다.

## 감사 기록

독립 리뷰어(`gpt-5.6-sol`, read-only)가 001/003의 `파일:line` 주장을
전수 재검증했다. **VERDICT: GO-WITH-FIXES (blockers=4)**.

| # | 등급 | 지적 | 처분 |
|---|---|---|---|
| B1 | High | 상수가 광고 카탈로그를 통제한다는 서술이 틀림 | **수용.** 001 §3에 두 계약 표 추가, 003 L2 재작성 |
| B2 | High | `motion_control` 노출 주장 근거 없음 (소비자 0) | **수용.** F5 정정, "노출" 주장 철회 |
| B3 | Medium | `rg -l minimax` 30개는 오측, 실제 66개 | **수용.** 재측정 후 정정 |
| B4 | Medium | 인용 line 번호 다수 stale (:33→:34, :60-67→:62-69, :70-90→:74-113, :92-118→:93-117) | **수용.** 전부 갱신 |

B1/B2는 결론의 방향을 바꾸지는 않았지만 **L2의 작업 목록을 바꿨다** —
"상수 2줄이면 끝"이 "두 계약을 같이 손대야 함"으로 바뀌었다.
감사가 없었다면 L2 구현자는 `/api/models`가 안 바뀌는 이유를 못 찾고 헤맸을 것이다.

리뷰어가 확인한 F1/F2/F3/F4/F6/F7/F8은 모두 **참으로 재확인**됐다.
