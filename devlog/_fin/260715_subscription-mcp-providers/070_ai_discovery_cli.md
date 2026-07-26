# 070 — AI discovery CLI: machine contract entrypoint + skill projection

> **Post-interview canonical (2026-07-16).** WP7. 인터뷰 Goal의 최종 판정 질문 — "깨끗한 환경의 AI가 별도 설명 없이 ima2 CLI를 보고, 알려진 tool과 지금 호출 가능한 tool을 구분하고, 올바른 입력을 구성할 수 있는가" — 를 CLI 표면으로 구현하는 phase다. 020 catalog와 040 snapshot이 선행한다.

## WP7 감사 round 1 반영 (2026-07-16, FAIL 4 High → 계약 확정)

1. **Execution binding 블록 (High 1):** raw upstream inputSchema는 reference일 뿐 실행 계약이 아니다. `tools show`의 executable tool은 명시적 `execution` 블록을 포함한다: `{binding: "mcp-generate"|"mcp-media-action"|null, endpoint, inputContract: <normalized JSON Schema — prompt/kind/model/ratio/startFrameFilename 또는 action/files/prompt>, note}`. `tools call`은 **inputContract만** 받는다(raw schema 아님). binding이 없는 tool의 call은 typed `execution_unbound`. binding→route 매핑은 테스트로 고정한다.
2. **Callable 증거 (High 2):** availability 승격 규칙 — `callable`은 (a) provider 세션 connected, (b) **local ingested snapshot의 `fetchedAt` > 세션 `connectedAt`** (연결 후 live ingest 성공 증거), (c) tool이 그 snapshot에 존재, (d) drifted 목록에 없음 — 전부 만족할 때만. ingest 실패로 (b)가 없으면 tool은 `connected` 상태로만 표시된다(callable 아님). 진리표 테스트 필수.
3. **Offline fallback 판별 (High 3):** CLI의 로컬 fallback은 연결 거부(SERVER_UNREACHABLE)일 때만. HTTP 오류(4xx/5xx/schema_changed)는 typed로 전파한다. 결정적 테스트를 위해 `--offline` 플래그를 추가한다(로컬 서버가 떠 있어도 spawn 테스트가 흔들리지 않게).
4. **정합화 (High 4):** file map에 `lib/contracts/discovery.ts`+`tests/contracts-discovery.test.ts` 추가, envelope는 071 권고안(`{ok, data, catalogVersion, schemaVersion, cliVersion, generatedAt}` / `{ok:false, error:{code,message,retryable}}`)으로 확정, `execution_unbound`를 `TypedErrorCode` union에 추가, `docs/API.md`에 `/api/contracts` 2개 route 문서화(inventory 계약 테스트), 검증 매트릭스에 `npm run build:server`와 `node scripts/generate-contract-docs.mjs --check` 추가.

## 목적

AI가 1회 학습으로 쓸 수 있는 machine-readable contract entrypoint를 만든다. 사람용 help text가 아니라 JSON 계약이 1급 출력이다.

## CLI 계약 (diff-level)

```bash
ima2 tools list --json                    # 전체 catalog: id, namespace, availability, 요약
ima2 tools list --namespace mcp.higgsfield --json
ima2 tools show mcp.higgsfield.<tool> --json   # 전체 contract: inputSchema/output/error/provenance
ima2 tools schema ima2.video.extend --json     # inputSchema만 (호출 직전 재확인용)
ima2 tools call <id> --input '<json>'          # 실행: 030 runtime에 위임, typed error 반환
```

응답 봉투(모든 subcommand 공통):

```json
{ "ok": true, "data": { ... }, "catalogVersion": "<hash>", "schemaVersion": 1, "cliVersion": "<pkg>", "requestId": "<id>", "generatedAt": "<ts>" }
{ "ok": false, "error": { "code": "auth_required|unavailable|schema_changed|unknown_tool|execution_unbound|invalid_input", "message": "...", "retryable": false }, "catalogVersion": "<hash>", "schemaVersion": 1, "cliVersion": "<pkg>", "requestId": "<id>", "generatedAt": "<ts>" }
```

규칙:

- `list`는 availability를 항상 포함하고, `documented`-only tool의 `call`은 network 시도 전에 typed `auth_required`/`unavailable`로 거부한다.
- description은 quoted data로 출력한다 (020 trust 규칙).
- server 미기동 시 `list/show/schema`는 번들/캐시 snapshot으로 동작하되 `availability.evidence`에 offline 판정 근거를 남긴다. `call`은 server 필수.

## Skill/docs projection

- `skills/ima2/SKILL.md`의 MCP provider 섹션과 `docs/` provider reference를 catalog에서 생성한다: `scripts/generate-contract-docs.mjs`가 catalog → Markdown projection을 렌더링하고, CI diff 검사로 수기 drift를 막는다.
- `ima2 skill` 설치 경로는 유지 — 생성물이 기존 skill 파일을 대체한다.

## File change map

| Op | Path | 변경 |
|---|---|---|
| NEW | `bin/commands/tools.ts` | 위 CLI 계약 구현. server API 우선, snapshot fallback. |
| NEW | `lib/contracts/discovery.ts` | envelope/catalogVersion/availability 승격 규칙/execution binding — 순수 함수, CLI와 route가 공유. |
| MODIFY | `bin/ima2.ts` | `tools` subcommand 등록 + `ima2 capabilities` help에서 machine entrypoint로 `ima2 tools`를 안내. |
| NEW | `routes/contracts.ts` | `GET /api/contracts`, `GET /api/contracts/:id` — catalog projection API. |
| MODIFY | `routes/index.ts` | contracts route 등록. |
| MODIFY | `lib/contracts/types.ts` | `execution_unbound` error code 추가. |
| MODIFY | `docs/API.md` | `/api/contracts` route 문서화. |
| NEW | `scripts/generate-contract-docs.mjs` | catalog → skill/docs Markdown projection 생성기. |
| MODIFY | `skills/ima2/SKILL.md` | MCP provider 섹션을 generated marker 블록으로 전환. |
| NEW | `tests/contracts-discovery.test.ts` | envelope shape, catalogVersion 결정성, callable 승격 진리표, binding 매핑. |
| NEW | `tests/tools-cli-contract.test.ts` | 봉투 shape, availability 구분, documented-call 거부, offline fallback, secret-free. |
| NEW | `tests/contract-docs-projection.test.ts` | 생성물 결정성(같은 catalog → 같은 출력), generated marker 보존. |

## Conditional activation scenarios

- Clean install discovery: server 없이 `ima2 tools list --json`이 번들 snapshot 기반 `documented` 목록을 반환한다.
- 오판 방지: `documented` tool에 `tools call`을 시도하면 upstream network 호출 0회로 typed 거부된다.
- schema 재확인: `tools schema`가 stale 상태에서 `schema_changed`를 반환하고 이전 schema를 반환하지 않는다.
- 문서 drift: catalog 변경 후 projection 미생성 상태를 CI diff가 잡는다.

## Acceptance criteria

- 깨끗한 설치에서 AI가 `ima2 tools list/show/schema --json`만으로 tool 존재·입력 schema·호출 가능 여부를 구분할 수 있다 (090 Tier 1 golden task의 대상 표면).
- 모든 오류가 typed code로 반환되고 자유 텍스트 추측이 필요 없다.
- skill/docs의 provider 섹션이 catalog 생성물로 대체되고 수기 drift가 CI에서 차단된다.

## Verification

```bash
npm run typecheck
npm run typecheck:tests
npm run build:server
npm run build:cli
node --test --import tsx tests/contracts-discovery.test.ts tests/tools-cli-contract.test.ts tests/contract-docs-projection.test.ts
node scripts/generate-contract-docs.mjs --check
npm run test:inventory
```
