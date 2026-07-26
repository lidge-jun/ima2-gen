# 100 — Provider 확장 1: Recraft·Magnific

> **Post-090 확장 레인 (2026-07-16 사용자 결정).** pilot(Higgsfield·Runway)이 010~090을 통과한 뒤 실행한다. 이 문서는 010~090이 만든 재사용 계약(spike script, catalog, snapshot pipeline, adapter interface, 2-tier verifier) 위에서 provider를 추가하는 절차의 사전 계획이며, 실행 cycle의 P가 당시 코드/스키마 기준으로 재검증한다.

## 전제 (진입 게이트)

- 010~090 완료: `scripts/mcp-schema-spike.mjs`, `lib/contracts/*`, `lib/mcp/snapshotPipeline.ts`, `lib/mcp/providerAdapter.ts`, Tier 1 golden tasks가 존재하고 green.
- 새 provider 추가가 "registry entry + snapshot + adapter matcher + fixture" 단위로 끝나는지가 이 phase의 핵심 검증이기도 하다 — core CLI/route 분기문을 늘리면 020의 확장성 수용 기준 위반.

## 대상

| Provider | 이연된 조사 항목 (010에서 이동) | 추가 확인 |
|---|---|---|
| Recraft | 공개 tool 문서(`generate_image`, `image_to_image`, `remove_background`, `crisp_upscale`, `creative_upscale`, `get_user`)와 live schema의 파라미터 단위 대조 — sanitizer/normalizer의 control fixture | web subscription credits 계정 필요 |
| Magnific | video concatenation/project/clip editor가 독립 MCP tool인지, 입력이 ordered clip URL/ref를 받는지 판정 | 유료 plan 필요. MCP 호출은 항상 credits 소비 명시 → tools/list 무과금 여부 실증. 제품 통합 관점의 약관 재확인(문서상 제품/파이프라인은 API 안내) 후 adapter 착수 |

## 작업 절차 (provider당 1 PABCD cycle 이하 목표)

1. 010 spike script에 provider entry 추가 → 사용자 OAuth 승인 → sanitized snapshot 확보(`tests/fixtures/mcp/<provider>-tools.sanitized.json`).
2. 040 pipeline으로 snapshot 승격 (`assets/mcp-snapshots/<provider>.sanitized.json`) + 약관 재확인 기록.
3. 050 adapter matcher 작성 (`lib/mcp/adapters/<provider>.ts`) — verified tool만 매핑.
4. 060 media workflow 라우팅표에 native tool 존재 여부 반영 (Magnific concat이 확인되면 `video.stitch` native 후보).
5. 080 selector에는 자동 반영되어야 함(catalog 파생이므로 코드 변경 0 목표 — 아니면 020 회귀).
6. 090 Tier 1 golden task에 snapshot 추가, Tier 2 smoke는 provider당 최소 1건.

## Acceptance criteria

- Recraft 공개 문서 vs live schema 대조 결과가 일치/불일치 목록으로 기록된다 (sanitizer control 확보).
- Magnific video editor/concat tool의 실존 여부가 이름+schema로 판정된다.
- 두 provider 추가에서 core 분기문 증가 0 — registry/snapshot/adapter 단위 확장만으로 UI·CLI에 노출된다.
- Tier 1/Tier 2 검증이 pilot과 동일 기준으로 통과한다.
