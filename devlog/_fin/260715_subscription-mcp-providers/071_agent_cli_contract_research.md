# 071 — Agent-facing CLI 계약 관행 조사 (WP7 입력)

조사일: 2026-07-16. 조사자: sol/high explorer + cxc-search Tier 2(원문 열람). 목적: `ima2 tools` CLI — agent가 tool을 소비하는 UX 표면 — 의 설계 근거.

## 1. CLI 계약 관행 (원문 확인)

- **gh**: `--json`은 명시 필드 요구, 값 생략 시 가용 필드 목록을 반환(발견과 소비가 한 명령), `--jq`/`--template` 내장. → 발견-선택-소비 단일 표면. [gh formatting](https://cli.github.com/manual/gh_help_formatting)
- **kubectl**: `explain`이 서버측 OpenAPI 필드 설명 반환, `api-resources`/`api-versions`가 카탈로그·버전 발견. [kubectl explain](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_explain/)
- **aws**: `--generate-cli-skeleton`/`--cli-input-json` — 단 skeleton은 버전 간 불안정 명시(스캐폴딩이지 계약 아님). [skeleton guide](https://docs.aws.amazon.com/cli/latest/userguide/cli-usage-skeleton.html)
- **cargo**: `cargo metadata --format-version=1` — 안정·버전드 JSON, 빌드 이벤트는 JSONL. 가장 강한 선례. [external tools](https://doc.rust-lang.org/cargo/reference/external-tools.html)
- **docker**: 명령별 JSON/Go-template + 버전 협상되는 Engine OpenAPI. [formatting](https://docs.docker.com/engine/cli/formatting/)
- 공통 패턴: **discover → 필드/스키마 버전 선택 → invoke → 순수 JSON/JSONL**, 사람용 표현은 별도 레이어.

## 2. Agent-native 표면 (2025-26)

- Claude/Codex skills: **progressive disclosure** — 기동 시 name+description만, 본문은 선택 후 로드. [Claude skills](https://code.claude.com/docs/en/skills)
- MCP: capability 협상, paginated tools/list, 고유 name, JSON Schema inputSchema/outputSchema, `tools/list_changed` 알림. [MCP tools spec](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)
- OpenAI function calling: `strict: true` + `additionalProperties: false`로 인자 생성 제약. [function calling](https://developers.openai.com/api/docs/guides/function-calling)
- llms.txt: 예측 가능한 발견 URL이지만 실행 계약은 아님. [llmstxt.org](https://llmstxt.org/)

## 3. 오류 계약

- RFC 9457 problem+json: 안정된 `type` + `status`/`title`/`detail`, **detail 파싱 금지 명시**. [RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html)
- gRPC: 유한 status 어휘가 재시도/상태수리/영구실패를 지시. [status codes](https://grpc.io/docs/guides/status-codes/)
- GraphQL: `errors[]` + `extensions.code`, partial data 보존. [spec](https://spec.graphql.org/September2025/#sec-Errors)

## 4. 버전/드리프트 신호

- Kubernetes: preferred group versions 반환. Docker: client/server 버전 협상. Terraform: `format_version` + minor 전방호환 + 미지원 major 거부. [terraform providers schema](https://developer.hashicorp.com/terraform/cli/commands/providers/schema)

## 설계 반영 (070 구현 계약에 채택)

1. `ima2 tools list --json` = zero-context entrypoint.
2. 봉투: `{ok, data, catalogVersion, schemaVersion, cliVersion, requestId, generatedAt}` — catalog hash 별도 버전.
3. tool마다 name/description/inputSchema(+outputSchema)/examples.
4. `ima2 tools show <id> --json` (aws explain류) — 호출 직전 재확인용 `schema` subcommand 유지.
5. stdout은 순수 JSON, 진행/진단은 stderr.
6. 오류: `{code, message, retryable, retryAfterMs?, details?}` — code는 유한 어휘(gRPC류), message 파싱 금지 원칙 문서화(RFC 9457류).
7. 미지원 catalog major 거부(terraform류), sanitizedHash를 catalogVersion으로 노출.
8. skill/docs projection은 동일 canonical catalog에서 생성해 drift 차단(권고 10 채택 — 040/070에 이미 계획됨).
9. 필드 projection(선택 출력)은 v2 후보로 기록만.
10. progressive disclosure: `tools list`는 요약(이름+한줄+availability), 전체 schema는 `show`/`schema`에서.
