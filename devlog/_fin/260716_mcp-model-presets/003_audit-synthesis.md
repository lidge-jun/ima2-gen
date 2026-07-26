# 003 — A-gate audit synthesis

## Reviewer recovery

- provider-contract sol explorer와 UI/state sol explorer가 각각 current tree를 read-only 감사해 capability information loss, speculative global ratio, implicit input, duplicate catalog/model ownership, route forwarding gap을 확인했다.
- 확정 계획 작성 후 fresh A reviewer 2개가 각각 3회 bounded wait 동안 output을 내지 못해 retire됐다. 성공했던 UI explorer follow-up도 3회 무응답이었다. loop dispatch retirement/reclaim 규칙에 따라 main이 기존 독립 findings를 plan line-by-line에 다시 대조해 A를 회수했다.
- baseline focused MCP suite는 47/47 pass다. 생성/결제 tool call은 0건이다.

## Blocker disposition

1. High — generic provider parameter가 arbitrary upstream key가 될 위험.
   - Trigger: localStorage/direct HTTP가 unknown key 또는 malformed scalar를 보냄.
   - Impact: MCP tool argument injection, credit-affecting option drift.
   - Evidence: 현재 `routes/mcpMedia.ts:201-243`은 parameters 자체가 없고 `runway.ts:17-46`도 capability validation이 없다.
   - Disposition: accepted. 010에 bounded route parser + Runway per-model whitelist + pre-plan typed reject + Higgsfield zero execution을 명시했다.
2. High — stale persisted preset reconcile가 React effect loop를 만들거나 payload에 남을 위험.
   - Trigger: 저장된 seedance 값으로 veo를 선택/복원.
   - Impact: maximum update loop 또는 unsupported upstream call.
   - Evidence: catalog가 두 component에 async 로드되고 Zustand MCP fields는 optional이다.
   - Disposition: accepted. catalog completion event의 single owner를 `GenProviderModelSelect`로 고정하고 delta-only atomic set, Settings no-write, adapter final guard를 추가했다.
3. Medium — provider capability와 ima2 executable capability 혼동.
   - Trigger: Higgsfield rich model entry 또는 Runway provider-only input role이 UI에 보임.
   - Impact: 사용자가 지원 tag를 곧바로 실행 가능으로 오해.
   - Disposition: accepted. input roles는 “Tool inputs” read-only metadata, preset control은 Higgsfield lock 아래 disabled, generation entitlement는 adapter `executable`만 소유한다.
4. Medium — `structure/01-file-function-map.md` dirty collision.
   - Trigger: 이번 cycle이 existing parallel diff와 같은 파일을 수정/commit.
   - Impact: 사용자/다른 agent 변경 섞임.
   - Disposition: accepted. 000/010 file map에서 제거하고 별도 SoT sync residual로 기록했다.
5. Medium — Runway exact per-model video ratio가 provider schema에 없음.
   - Trigger: “some models” 문구를 exact matrix로 과장.
   - Impact: 거짓 option 또는 rejected generation.
   - Disposition: accepted. images는 exact lists, video는 명시된 안전 교집합 3종만 `verified-contract`; unknown resolution/default는 숨김/Auto다.

## Falsification

- Higgsfield rich list가 first-page fixture에만 있다는 가설은 live paginated direct read-only probe에서 61/61 item key를 확인해 기각했다.
- server catalog cache가 duplicate HTTP consumer를 곧바로 upstream 중복 호출로 만든다는 가설은 `modelsCatalog.ts:112-119` 성공 cache로 완화된다. client cache 신설은 이번 범위에서 불필요하다.
- 별도 typed state field(duration/resolution)만으로 충분하다는 가설은 quality/mode/variant 등 provider-declared scalar preset을 버리므로 기각했다. generic state + non-generic adapter whitelist가 정보 보존과 실행 안전을 동시에 만족한다.

```yaml
blocking_issues: 0
residuals:
  - structure/01-file-function-map.md SoT sync after parallel dirty work closes
  - end-frame and video-to-video are catalog metadata only in this cycle
```

VERDICT: GO-WITH-FIXES (blockers=5)
