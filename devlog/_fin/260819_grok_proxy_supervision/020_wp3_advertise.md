---
created: 2026-08-19
updated: 2026-08-19
tags: [ima2-gen, devlog, grok, advertise, ports, wp3]
---

# 020 — WP3: advertise 파일이 죽은 포트를 광고하지 않는다

결함 2를 고친다. 근거는 `000_research.md` "결함 2".

## 실측 재확인

```
/api/health (pid 34239)  grok.actualPort = 18646   ← 실제 리스너
~/.ima2/server.json      grok.actualPort = 18647   ← 낡음, 리스너 없음
curl 18647/v1/models  → 연결 실패
curl 18646/v1/models  → 200
```

## 원인

`advertise()`는 `ctx.grokActualPort`를 그대로 직렬화한다
(`server.ts:318-322`). 호출 지점은 세 곳뿐이다: `onPortSelected`,
`onReady`(`server.ts:462-469`), 그리고 리슨 직후(`server.ts:510`).

빠진 것은 **프록시가 죽는 순간**이다. 자식이 exit해도 advertise 파일은
마지막으로 살아 있던 포트를 계속 광고한다. 파일을 믿는 소비자는 죽은 포트로
간다. opencodex가 "bind 후에만 기록하고, 종료 시 조건부로 철회"하는 이유가
정확히 이것이다 (`001_opencodex.md` 채택 2).

## 변경 1 — 사망 시 철회 (`server.ts`)

런처의 `onExit` 콜백을 연결한다. 현재 호출부는 `onPortSelected`/`onReady`만
넘긴다 (`server.ts:462-469`).

```ts
onExit: () => {
  ctx.markGrokProxyDown();
  advertise(ctx);
},
```

### 죽은 상태의 계약 (감사 지적 B5 반영)

초판은 `live: false` 플래그만 추가하려 했다. 감사가 옳게 지적했듯 그것은
**모르는 필드를 무시하는 소비자에게 여전히 죽은 엔드포인트를 건네는** 설계라
이 문서의 제목("죽은 포트를 광고하지 않는다")을 만족하지 못한다.

저장소 내 실제 소비자를 확인한 결과(`bin/lib/client.ts`,
`integrations/comfyui/.../nodes.py`) **아무도 `grok` 절을 읽지 않는다**.
즉 지금 이 절을 강하게 바꿔도 깨질 in-repo 소비자가 없다. 그래서 미지근한
플래그 대신 강제 가능한 계약을 택한다.

```ts
// 살아있을 때만 엔드포인트를 싣는다.
grok: ctx.grokProxyLive
  ? {
      configuredPort: Number(ctx.grokPort),
      actualPort: Number(ctx.grokActualPort || ctx.grokPort),
      url: ctx.grokUrl,
      live: true,
    }
  : {
      configuredPort: Number(ctx.grokPort),
      actualPort: null,
      url: null,
      live: false,
    },
```

`configuredPort`는 진단에 유용하므로 남긴다. `actualPort`/`url`은 **살아
있다는 주장**이므로 죽었을 때 `null`이 정직하다. `live`는 이 의도를 읽기 쉽게
만드는 보조 필드다.

### 타입 파급 (감사 지적 B7)

`grokProxyLive`를 **필수** 필드로 넣으면 세 곳을 함께 고쳐야 한다.

- `server.ts:367` 부근 프로덕션 컨텍스트 리터럴에 초기값 추가
- `lib/runtimeContext.ts:158` 부근 `createTestRuntimeContext`에 초기값 추가
- `lib/runtimeContext.ts:78` `requireRuntimeContext`에서 정규화

테스트 컨텍스트 부담을 줄이기 위해 `grokProxyLive?: boolean`(optional)로 두고
advertise에서 `=== true`로 읽는다. 그러면 정규화만 추가하면 되고 기존 부분
컨텍스트가 전부 유효하다.

## 변경 2 — 상태 전이마다 갱신

`onPortSelected`는 `live: false`(아직 리슨 전), `onReady`는 `live: true`,
`onExit`는 `live: false`. advertise가 감독자 상태를 그대로 따라간다.

`onPortSelected`에서 곧바로 `live: true`로 쓰면 안 된다. 포트 선택은
"바인드하겠다는 의도"지 성공이 아니다.

## 테스트 이음매 (감사 지적 B6)

`advertise()`는 `server.ts` 내부 private 함수이고(`server.ts:293`),
`startServer`는 Grok 런처 주입 지점을 제공하지 않는다(`server.ts:339-343`은
`oauthChild`만 받는다). 따라서 advertiseFile 경로만 바꿔서는
`onReady → onExit` 전이를 **구동할 방법이 없다**.

해결: 페이로드 생성을 순수 함수로 분리해 export한다.

```ts
// server.ts
export function buildAdvertisePayload(ctx: RuntimeContext) { ... }
function advertise(ctx: RuntimeContext) {
  if (!ctx.serverActualPort) return;
  writeFileSync(..., JSON.stringify(buildAdvertisePayload(ctx)));
}
```

테스트는 순수 함수를 직접 호출한다. 파일 IO도, 서버 기동도, 실제 progrok도
필요 없다. 이것이 이 계약을 검증하는 가장 정직한 최소 이음매다.

`tests/grok-advertise-liveness-contract.test.ts` 신설.

1. `grokProxyLive`가 false/미설정이면 `grok.url`과 `grok.actualPort`가
   `null`이다 (수정 전 실패: 지금은 죽은 포트를 그대로 싣는다).
2. true면 `actualPort`가 실제 포트와 일치하고 `live`가 true다.
3. `configuredPort`는 두 경우 모두 유지된다 (진단용).

새 테스트 파일이므로 `docs/migration/runtime-test-inventory.md`를 함께
갱신한다 (감사 지적 B8).

## 알려진 남은 간극

`routes/health.ts:20-23`도 같은 문제를 갖는다 — 감독자 상태 없이 포트/URL을
무조건 노출한다. WP3에서 같은 `buildAdvertisePayload` 규약을 적용하거나,
최소한 `live` 값을 함께 실어 두 표면이 어긋나지 않게 한다.

## 범위 밖

관리 밖 progrok(18645, pid 3012)을 죽이는 것은 이 작업이 아니다. 사용자
소유 프로세스이므로 건드리지 않는다.
