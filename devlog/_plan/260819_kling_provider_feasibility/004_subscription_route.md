---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, research, provider, video, kling, subscription]
---

# 004 — 보유한 Kling 구독을 연결할 수 있나

002/003은 "돈을 새로 낼 때"의 경로를 다뤘다. 이 문서는 다른 질문에 답한다:
**이미 내고 있는 Kling 구독을 ima2에 물릴 수 있나.**

ima2는 이미 사용자 계정을 활성화해 쓰는 provider를 여럿 두고 있으므로
뜬금없는 요구가 아니다. 선례는 §3에 있다.

## 결론

**공식 경로로는 불가능하다. 비공식 경로는 기술적으로 존재하나 ToS가
자동화를 명시적으로 금지하며, ima2의 기존 선례들보다 기술적으로 확연히
취약하다.**

한 가지 미리 밝혀둔다. 초안은 "기존 선례는 공식이고 Kling만 비공식"이라고
썼는데 **틀렸다.** 독립 감사가 잡아냈고 §3에서 정정했다. 실제 차이는
공식/비공식이 아니라 **기술적 재사용 가능성**이다.

---

## 1. 구독 크레딧과 API Unit은 지갑이 다르다

이게 핵심이고, 공식 문서로 확정된다.

| | 소비자 구독 | 개발자 Open Platform |
|---|---|---|
| 화폐 단위 | **Credits** | **Units** (선불 리소스 팩) |
| 충전 | 멤버십 월 지급 / $1 = 66 Credits | 리소스 팩 별도 구매, 1 Unit = $0.14 |
| 사용처 | "Kling AI platform and partner's platforms", Website/APP 기능 | API 호출 |
| 이월 | 지급일로부터 1개월 | "does not carry over and will be cleared upon expiration" |

공식 Credits Policy 원문: "Credits can only be used for access specific
features and services on the Kling AI platform and partner's platforms."
— API가 아니라 **플랫폼 기능**이다.

더 결정적인 것은 Credits가 서로 옮겨지지도 않는다는 조항이다:
"Credits cannot be transferred or gifted between different Users, between
different accounts controlled by the same User, or between different spaces
owned by the same User." 같은 사람의 다른 스페이스끼리도 안 넘어간다.

다만 정확히 말하면 **"Credits를 API Unit으로 전환할 수 없다"는 한 문장짜리
조항은 찾지 못했다.** 확인된 것은 두 지갑이 현재 별도 제품·별도 과금 단위로
운영된다는 것이고, 공개 정책 어디에도 전환·연계 경로가 없다는 것이다.
영구히 불가능하다는 명제가 아니라 현재 제품 구조가 그렇다는 뜻이다.

### 구독 티어에 API가 포함된 등급은 없다

2026-07-28자 공식 요금표(Basic/Standard/Pro/Premier/Ultra)의 혜택 항목은
Element 생성 수, fast-track, 1080p, 업스케일, 워터마크 제거, 영상 연장,
신기능 우선권, 상업적 이용 허용이다. **API / Open Platform / 리소스 팩은
어느 등급에도 없다.**

참고로 Standard $6.99/월이 660 Credits = 720p 영상 33건이다. 구독이
영상 단가로는 오히려 싸다 — 그래서 이걸 쓰고 싶은 게 자연스러운 요구다.

## 2. 위임 메커니즘이 아예 없다

"내 구독으로 이 앱이 대신 생성하게 해줘"에 해당하는 공식 장치를 전수 조사했다.

| 찾은 것 | 결과 |
|---|---|
| OAuth "Connect your Kling account" | **없음** |
| 멤버십에 묶인 personal access token | **없음** |
| 공식 MCP 서버 | **없음** (GitHub의 `199-mcp/mcp-kling` 등은 전부 서드파티) |
| 서드파티 앱 인가 체계 | **없음** |
| 파트너 연동 | 존재하나 Kling이 정한 파트너(예: Honor)에 한함. 임의 앱 대상 아님 |

개발자 인증은 콘솔에서 발급하는 Access Key/Secret 뿐이고, 이건 **구독
계정이 아니라 별도 개발자 신원**에 붙는다. 즉 "로그인해서 내 구독을
빌려주는" 구조 자체가 없다.

## 3. ima2의 기존 선례와 왜 다른가

ima2에는 사용자 계정을 활성화해 쓰는 provider가 **셋** 있다.
성격이 조금씩 다르므로 구분해서 봐야 한다.

| 선례 | 방식 | credential kind | 근거 |
|---|---|---|---|
| ChatGPT | `openai-oauth` 로컬 OAuth 프록시 | `oauth-proxy` | `vendor/openai-oauth-1.0.2-ima2.1.tgz`, `lib/oauthProxy/` |
| Grok | `progrok` — xAI OAuth 세션을 로컬 API로 활성화 | `oauth-proxy` | `vendor/progrok-0.2.0.tgz`, `config.ts:315-332` |
| Antigravity | 로그인된 `agy` CLI 바이너리를 호출 | `local-cli` | `lib/providers/registry.ts:105`, `docs/FAQ.md:110` |

`agy`는 OAuth 토큰을 직접 다루지 않고 **이미 로그인된 CLI에 위임**한다.
"사용자가 인증한 계정을 ima2가 활성화한다"는 넓은 의미의 선례로는 세 번째다.
(그 계정이 유료 구독 quota를 쓰는지는 로컬 증거만으로 확정 못 한다.)

progrok README가 이 패턴의 전제를 말한다:

> "Requires an active SuperGrok subscription. progrok does not bypass xAI
> account access, quotas, pricing, or product limits."

### 정정: 기존 선례도 벤더 승인이 아니다 (감사 B1)

초안은 여기서 "ChatGPT/Grok은 벤더가 설계한 흐름이라 우회가 아니다"라고
썼다. **자기 저장소에 유리한 서술이었고, 사실이 아니다.**

- `openai-oauth` README 자신이 명시한다: "This is an unofficial,
  community-maintained project and is not affiliated with, endorsed by, or
  sponsored by OpenAI, Inc." (`node_modules/openai-oauth/README.md:68`).
  기본 client id는 `app_EMoamEEZ73f0CkXaXp7hrann` — 자기 앱용으로 발급받은
  것이 아니라 **기존 공식 클라이언트의 id를 재사용**한다 (`:36`).
- `progrok` 역시 xAI에서 client id를 발급받지 않았다. README가 인정한다:
  "progrok's OAuth client attribution comes from Hermes Agent and OpenClaw"
  (`node_modules/progrok/README.md:258`). 공유 client lineage를 탄 것이다.

즉 세 provider 모두 **벤더가 제3자 앱에게 승인한 경로는 아니다.**

### 그러면 진짜 차이는 무엇인가

공식/비공식이 아니라 **기술적 재사용 가능성**이다.

| | ChatGPT / Grok | Kling 소비자 웹 |
|---|---|---|
| 인증 산출물 | 표준 OAuth **토큰** — 재사용·갱신 가능 | **쿠키 + 매 요청 JS 서명** |
| 로컬 보관 | 토큰 파일 하나 | 쿠키 + localStorage + UA + 상주 Chrome 프로필 |
| 호출 방식 | HTTP 클라이언트 | **Chromium을 띄워 벤더 JS 서명기 실행** |
| 깨지는 계기 | 토큰 만료 / OAuth 스펙 변경 | **웹 번들 배포 때마다** |

이게 실질적 차이다. OAuth 토큰은 표준 산출물이라 한 번 얻으면 재사용되지만,
Kling은 서명이 프론트엔드 코드에 묶여 있어 **그 코드가 바뀌면 같이 깨진다.**
ToS 판단은 §5에서 별도로 다룬다 — 기술 난이도와 약관은 다른 축이다.

## 4. 비공식 경로의 실제 상태

가능한지 여부만 말하면 **가능하다.** 다만 상태가 좋지 않다.

| 프로젝트 | 언어 | ★ | 마지막 푸시 | 상태 |
|---|---|---|---|---|
| `yihong0618/klingCreator` | Python | 220 | 2025-07 | **고장.** submit이 500 `내부系统繁忙` / `MID.S4B` (issue #32). 2026 서명 도입 이전 코드 |
| `carzygod/kling2api` | Go + chromedp | 1 | 2026-07 | 최근 유지보수. 실제 브라우저 프로필 상주 필요 |
| `feixingfeibi/kling-free-api` | Node + Playwright | 2 | 2026-03 | 저자 스스로 experimental. 직접 HTTP 경로는 legacy 표기 |

**추세가 결론을 말한다.** 220스타짜리 순수 쿠키 클라이언트는 죽었고,
2026년 후속 프로젝트들은 전부 **Chromium을 띄워 Kling 자신의 JS 서명기를
실행**하는 방식으로 옮겨갔다. 이건 "HTTP 복제로는 안 된다"는 자백이다.
kling-free-api 문서의 표현: "Plain HTTP replay is fragile."

즉 ima2가 이 길을 가면 **로컬 서버 하나가 아니라 상주 브라우저 프로필을
안고 가야 한다.** 그리고 웹 번들이 배포될 때마다 깨질 것을 각오해야 한다.

## 5. ToS — 여기가 진짜 차단선

기술적 난이도보다 이쪽이 결정적이다. Kling User Policy 금지 조항 원문:

> (h) use automated scripts to collect information from or otherwise
> **interact with the Services**;

> (g) incorporate the Services or any portion thereof into **any other
> program or product**;

> (f) ... or bypass any measures we may use to prevent or restrict access
> to the Services;

Payment Policy 7.3.1은 더 구체적이다:

> Theft, exploitation of system loopholes (including but not limited to
> using robot software, spider software, crawler software, screen-scraping
> software, etc.) ... or obtaining the use of any one or more Paid Services
> ... through any **non-official or authorised channels**

**결정적인 것은 (h)와 7.3.1이다.** (h)는 "자동 스크립트로 Services와
상호작용"을 직접 금지하므로, 자기 계정만 쓰더라도 브라우저 자동화가
정면으로 걸린다. 7.3.1은 crawler/screen-scraping software로 유료 서비스를
"non-official channels"로 얻는 것을 금지한다.

(g)는 보조 근거로만 둔다. "incorporate the Services into any other program"은
**서비스 코드나 구성요소를 자기 제품에 임베드하는 행위**로 좁게 읽힐 여지가
있어서, 개인 계정으로 요청하고 결과를 로컬 UI에 띄우는 경우까지 반드시
포함한다고 단정할 수 없다. 법률 해석을 확정 사실처럼 쓰지 않는다. (감사 B5)

비교하자면 §3에서 봤듯 OpenAI/xAI 경로도 벤더 승인은 아니다. 다만 그쪽
약관에서 (h)/7.3.1에 대응하는 조항을 이 조사에서 검토하지 않았으므로,
**"Kling만 위험하다"가 아니라 "Kling은 금지 조항을 직접 확인했다"가**
정확한 서술이다.

## 6. 그래서 무엇을 할 수 있나

구독을 직접 물리는 길이 막혔으므로, 남는 선택지는 셋이다.

### (가) 구독은 구독대로 쓰고, ima2는 다른 Kling 경로를 쓴다

**먼저 분명히 할 것: 이건 원 요구를 충족하지 않는다.** 보유 구독을 ima2에
연결하는 게 아니라, 구독은 웹에서 손으로 쓰고 자동화는 별도 계정·별도
예산으로 돌리는 **분리 운영**이다. (감사 B2)

003의 L1이 여기 해당한다. Runway 워크스페이스를 이미 쓰고 있다면
`kling-o3-pro`/`kling-3-pro`가 이미 코드에 있다. Kling 구독과 무관하게
Kling **모델**에는 닿는다.

비용은 0이 아니다. Runway 워크스페이스 크레딧을 쓰며, 잔여량과 과금 조건은
이 조사에서 확인하지 않았다. "코드가 이미 있다"와 "호출이 공짜다"는 다르다.

### (나) Open Platform 리소스 팩을 별도 구매한다

구독과 별개 지출이라 "이미 내는 돈으로"라는 원래 요구는 충족 못 한다.
다만 조사 중 확인된 완화 요소가 하나 있다 — 공식이 **Trial Resource
Package**를 "joint debugging and testing" 용도로 제공한다. 유료 결정
전에 계약을 실측할 수단은 된다.

### (다) 하지 않는다

비공식 경로는 ToS 위반이고, 위반의 대가가 **자동화 실패가 아니라 계정**
이다. 구독이 있다는 것은 잃을 것이 있다는 뜻이기도 하다.

## 7. 판단

**원 요구 — 보유 Kling 구독을 ima2에 연결 — 는 충족 불가다.** 공식 위임
장치가 없고, 구독 지갑과 API 지갑이 분리돼 있으며, 소비자 웹 자동화는
약관 (h)/7.3.1에 정면으로 걸린다. 이건 우선순위 문제가 아니라 경로 부재다.

그 위에서 차선을 고른다면 **(가)**다. 단 위에서 밝힌 대로 이건 대체안이지
요구 충족이 아니며, Runway 크레딧이라는 별도 비용을 쓴다.

1. 추가 구현 0 — 코드가 이미 있다 (호출 비용은 별개)
2. 약관 리스크 낮음 — Runway MCP는 정식 인증 경로. 다만 Runway가 Kling
   모델을 어떤 라이선스로 재판매하는지는 확인하지 않았다
3. Kling 구독의 가치를 잃지 않는다 — 웹에서 쓰던 대로 쓰면 된다

(나)는 자동화 물량이 쌓여 Runway 크레딧보다 Kling Unit이 싸지는 시점에
재검토할 문제다. 지금은 그 데이터가 없다. Trial Resource Package로 계약만
먼저 실측하는 것은 지금도 가능하다.

(다)에 대해: 기술적으로 못 해서가 아니라 **약관이 자동화를 직접 금지하고,
구현이 상주 브라우저를 요구하며 웹 배포마다 깨지기 때문**이다. 기존
선례가 공식이어서가 아니다 — §3에서 봤듯 그것들도 공식은 아니었다.
잃을 것이 있는 유료 계정이라는 점이 판단을 더 보수적으로 만든다.

## 8. UNVERIFIED

1. 2026-08 현재 실제 결제 화면의 티어별 가격/크레딧 (블로그는 07-28자, SPA라 미추출)
2. "멤버십 Credits로 API Unit을 못 낸다"는 **한 문장짜리 명시 조항** —
   두 지갑이 분리돼 있다는 것은 확정이나, 그걸 한 줄로 못박은 원문은 못 찾았다
3. Trial Resource Package를 한국 개인 개발자가 추가 KYC 없이 받을 수 있는지
4. 자기 계정 자동화로 실제 정지된 사례 — 보고를 못 찾았으나 **없다는 증거는 아니다**
5. `__NS_hxfalcon` 서명이 모든 지역/경로의 submit에 필수인지
6. Runway 워크스페이스의 잔여 크레딧과 Kling 모델 호출 단가 (미확인)
7. Runway가 Kling 모델을 재판매하는 라이선스 관계 및 이용약관
8. OpenAI/xAI 약관에 Kling (h)/7.3.1에 대응하는 자동화 금지 조항이 있는지
   — 이 조사는 Kling 약관만 읽었다. 기존 선례의 약관 리스크는 **미평가**다
