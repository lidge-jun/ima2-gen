# 030 — 공통 MCP runtime·OAuth·connection manager

> **Post-interview canonical (2026-07-16).** WP3. ima2-owned execution은 인터뷰 Round 2에서 확정됐다. tool 계약의 정의·availability는 020 catalog가 소유하고, 이 phase는 transport/OAuth/token/connection lifecycle만 소유한다. `toolCatalog.ts`의 sanitize/hash/drift 책임은 040으로 이관됐다 — 여기서는 live tools/list의 획득과 connection 상태 전달까지만 담당한다.

> **Restart recovery receipt (2026-07-17).** `120_restart_recovery/`의 WP1/WP2가 이 phase의 credential/runtime lifecycle을 구현했다. `716fdbb`는 versioned binding, revision/tombstone CAS, memory-only PKCE, SDK invalidation, generation/single-flight를 고정했고, `53656b5`는 actual-port 이후 startup restore, generation+epoch transport 상태, one-shot terminal reconnect, truthful route status, shutdown을 고정했다. 후속 `4b15ec7`은 actual port 게시 전에는 restore가 시작되지 않는 activation harness를 추가했다.

## WP3 감사 round 1 반영 (2026-07-16, FAIL → 수정)

1. **Redirect URI는 live origin에서 파생한다.** 서버가 port fallback으로 다른 포트에 bind될 수 있으므로(`server.ts:430-438`), OAuth redirect URI는 정적 config가 아니라 listen 완료 후의 실제 포트(`http://localhost:<actualPort>/api/mcp/oauth/callback`)로 구성한다. dynamic client registration은 origin별로 저장하고, origin이 바뀌면 재등록·재인증이 필요함을 상태로 노출한다(silent 재사용 금지).
2. **OAuth callback은 loopback 전용이다.** 기존 전역 guard(`x-ima2-token`, 비-loopback 차단)를 우회하는 예외를 만들지 않는다. redirect URI가 항상 localhost이므로 provider 승인 후 브라우저가 같은 머신에서 loopback으로 돌아온다. 비-loopback callback은 기존 guard가 자연 차단하며, 이를 테스트로 고정한다. token을 query로 노출하는 우회는 금지.
3. **state → provider/transport 상관관계를 manager가 소유한다.** callback 경로는 하나(`/api/mcp/oauth/callback`)이고 provider 식별은 OAuth `state`로만 한다: pendingAuth map(state → provider+transport+만료), state 불일치/만료/재사용은 token 교환 전에 400으로 거부, `finishAuth(code)`는 해당 pending transport 인스턴스에만 호출한다.
4. Medium 반영: `mcpConnectionManager`는 RuntimeContext optional 필드로 추가하고 requireRuntimeContext에서 `undefined` 기본값을 보존한다(기존 fixture 무파손). `tokenDir`은 `config.storage` 관례(`join(configDir, "mcp")`)를 따르고 config 중앙에서 해석한다. MCP route는 전역 LAN guard를 상속함을 명시하고 loopback/비-loopback 테스트를 둔다.

### Round 2 잔여 High 해소 — callback guard 예외

전역 guard는 요청 출처가 아니라 설정된 host 기준으로 token을 요구하므로, 비-loopback 배포에서는 localhost callback도 401이 된다(round 2 검증). 해소: **GET `/api/mcp/oauth/callback` 단일 경로만 token guard에서 명시적으로 예외**한다. 근거는 표준 OAuth redirect endpoint 관행과 동일 — 보안 경계는 (a) 단회용·비추측 `state`(pendingAuth 매칭 실패 시 token 교환 없이 400), (b) PKCE, (c) 이 endpoint는 privileged 데이터를 반환하지 않음(HTML 완료 화면). 테스트로 고정: token 없는 callback 성공(유효 state), 무효 state 400, 그 외 `/api/mcp/*`는 guard 유지.

## 목적

원격 MCP를 ima2-gen 내부 provider로 안전하게 호출하는 공통 runtime을 만든다. provider adapter는 transport/token 저장을 직접 구현하지 않는다.

이 runtime은 오픈소스 local MCP client boundary다. ima2 운영자가 provider credential을 받는 hosted broker는 만들지 않으며, official MCP가 없는 provider를 REST adapter로 우회 지원하지 않는다.

## 구조

```text
routes/mcpConnections.ts
        |
        v
lib/mcp/connectionManager.ts
  ├─ oauthProvider.ts
  ├─ tokenStore.ts
  ├─ toolCatalog.ts
  └─ capabilityRegistry.ts
        |
        v
@modelcontextprotocol/sdk Client + StreamableHTTPClientTransport
```

## File change map

| Op | Path | 변경 |
|---|---|---|
| NEW | `lib/mcp/types.ts` | `McpProviderId`, connection state, sanitized tool, capability, normalized call/result/error 타입. |
| NEW | `lib/mcp/providerRegistry.ts` | endpoint/auth mode/allowed capabilities를 가진 정적 provider registry. secrets 없음. |
| NEW | `lib/mcp/tokenStore.ts` | `${configDir}/mcp/<provider>.json` atomic 0600 read/write/delete, permission 검사. |
| NEW | `lib/mcp/oauthProvider.ts` | SDK OAuth provider 구현, PKCE/state, callback handoff, refresh와 revoke-local. |
| NEW | `lib/mcp/connectionManager.ts` | provider별 client lifecycle, connect/reconnect/close, timeout, single-flight refresh. |
| NEW | `lib/mcp/toolCatalog.ts` | paginated tools/list, sanitize/hash/cache, schema drift diagnostic. |
| NEW | `lib/mcp/capabilityRegistry.ts` | tool catalog와 adapter matcher를 합쳐 ima2 capability를 계산. |
| NEW | `routes/mcpConnections.ts` | list/status/connect/callback/disconnect/refresh/capabilities read API. generation route는 아님. |
| MODIFY | `config.ts` | MCP timeout, callback host/port, enabled provider allowlist, token/cache path. endpoint override는 dev-only. |
| MODIFY | `lib/runtimeContext.ts` | `mcpConnectionManager`를 strict RuntimeContext에 주입; route fixture default를 보존. |
| MODIFY | `routes/index.ts` | connection route 등록. |
| MODIFY | `lib/configKeys.ts` | MCP token/config secret key redaction. |
| MODIFY | `package.json` | exact SDK dependency와 필요한 scripts. |
| NEW | `tests/mcp-token-store.test.ts` | atomicity/0600/path traversal/corrupt recovery/no-secret-log. |
| NEW | `tests/mcp-oauth-flow.test.ts` | state/PKCE/callback/refresh/401 single retry/revoke-local. |
| NEW | `tests/mcp-tool-catalog.test.ts` | pagination/schema hash/drift/unavailable capability. |
| NEW | `tests/mcp-connection-routes.test.ts` | route status와 secret-free response. |

## Before → after

- Before: GPT/Grok OAuth와 API keys가 provider별 route/runtime 필드로 분리되어 있고 generic remote OAuth client가 없다.
- After: MCP transport/auth/catalog는 한 subsystem이 소유하고, 외부 route와 adapter는 token을 직접 보지 않는다.

## Public server contract

```text
GET    /api/mcp/providers
GET    /api/mcp/providers/:id/status
POST   /api/mcp/providers/:id/connect
GET    /api/mcp/oauth/callback
POST   /api/mcp/providers/:id/refresh
DELETE /api/mcp/providers/:id/connection
GET    /api/mcp/providers/:id/capabilities
```

응답은 `connected|auth_required|connecting|schema_changed|offline|error`와 secret-free diagnostic만 포함한다.

## Conditional activation scenarios

- 401: mock server가 첫 tools/list에 401, refresh 뒤 200을 반환할 때 정확히 한 번만 retry한다.
- Refresh race: 동시 10요청에서 refresh endpoint 호출이 1회인지 확인한다.
- Corrupt token: malformed file을 읽으면 원본을 덮지 않고 `auth_required`가 되며 token text가 log에 없음을 확인한다.
- Schema drift: 이전 hash와 새 hash가 다르면 generation capability가 잠기고 refresh 후에만 풀린다.
- SSRF guard: registry 밖 endpoint 또는 non-HTTPS endpoint 요청이 network call 전에 거부되는지 확인한다.

## Acceptance criteria

- route 응답·logs·diagnostics 어디에도 token이 없다.
- 모든 token file은 final path에서도 0600이다.
- provider disconnect는 local token/client/cache를 정리하되 provider account revoke를 했다고 거짓 표시하지 않는다.
- server restart 후 refresh token으로 재연결하거나 명시적으로 auth_required가 된다.
- MCP connection failure가 기존 GPT/Grok provider readiness를 망가뜨리지 않는다.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
node --test --import tsx tests/mcp-token-store.test.ts tests/mcp-oauth-flow.test.ts tests/mcp-tool-catalog.test.ts tests/mcp-connection-routes.test.ts
npm run test:inventory
```

Recovery 범위의 현재 자동 증거는 기존 `tests/mcp-token-store.test.ts`, `tests/mcp-connection-manager.test.ts`, `tests/mcp-connection-routes.test.ts`, `tests/mcp-snapshot-pipeline.test.ts`, `tests/mcp-sanitizer.test.ts`, `tests/runtime-ports.test.ts`, `tests/runtime-context-normalize.test.ts`에 있다. 동일 binding restart는 브라우저 redirect 없이 연결되고, mismatch/disabled/corrupt/pending record는 passive하며, close/error/generation race와 shutdown을 함께 검증한다. 아래 090의 clean-install golden task, 장시간 job recovery, 인증된 provider smoke는 이 recovery unit이 완료했다고 주장하지 않는다.
