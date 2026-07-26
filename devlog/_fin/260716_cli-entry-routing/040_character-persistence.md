# 040 — wp4: 캐릭터/레퍼런스 영속성 (자체 저장 판정 + 프로바이더 브리지)

질문: "ima2가 자체적으로 캐릭터를 저장할 수 있는가?" — **판정: 가능하고, 이미 절반은 있다.**
ima2의 elements 시스템(kind=character 에셋)이 로컬 저장소 역할을 하고, 프로바이더별로는
"스테이트리스 브리지(레퍼런스 이미지 재전송)"가 1차, "서버측 영속 id(soul_id) 연동"이 2차다.

## 조사 결론 (2026-07-16, Tier2 원문 증명 — 상세 URL은 §소스 근거)

### Runway: 레퍼런스는 요청 단위, 라이브러리는 앱 전용
- Gen-4 References: 이미지 1장으로 캐릭터 일관성, **생성당 최대 3장**, `@name` 태그 문법. [proven]
- 앱 내 저장: 레퍼런스에 이름을 붙이면 세션 넘어 저장·워크스페이스 공유. **단 이 라이브러리의 MCP/API 접근은 미문서화.** [라이브러리 존재 proven / API 접근 unverified]
- API 전송 계약: `referenceImages[{uri,tag}]`, HTTPS URL 또는 base64 data URI, `@tag`로 프롬프트에서 참조. 이미지 640²~4K, JPEG/PNG/WebP. [proven]
- Seedance 2.0 (Runway 내 파트너 모델): **비디오 레퍼런스 최대 3개, 각 50MB 미만, 총 15초 미만, mp4/mov, ≤720p.** [proven]
- 결론: Runway 브리지는 **스테이트리스** — ima2가 로컬에 캐릭터를 저장하고 생성 때마다 레퍼런스+태그를 재전송. 서버측 저장 의존 금지.

### Higgsfield: 서버측 학습 identity(soul_id) — 결제 필요
- Soul ID = 학습된 identity. 사진 20+장(MCP 스키마는 5-20장, ~10분 학습), 계정 내 영속, 이름으로 재선택. [proven]
- **모델 파일 export 불가** — identity는 Higgsfield 생태계 안에만. [proven]
- MCP tool 실측(스냅샷): `show_characters` action=list|train|status, train은 name+5-20 ref images(media_id/job_id/https URL), soul_id로 상태 조회. `show_reference_elements` action=list|get|create — 워크스페이스 단위 재사용 캐릭터/환경/소품, create는 media_upload→PUT→media_confirm 후 medias[] 전달, category=auto 분류. [스냅샷 proven / 공개 문서로는 unverified]
- 과금: 유료 플랜 필요 + Soul 생성 25크레딧. [proven] 정확한 티어 게이팅·계정당 개수 제한 unverified.
- 결론: Higgsfield 브리지는 **영속 id 연동형** — 로컬 캐릭터의 원본 사진 매니페스트에서 train 호출, 반환된 soul_id를 로컬 레코드에 저장. 결제 후 Tier2 트랙.

## ima2 자체 캐릭터 스토어 설계 (diff-level)

### 1. 데이터 모델 — MODIFY lib/assetsStore.ts (+ 스키마 마이그레이션)

기존 element(kind=character) 메타데이터에 provider bindings 추가:

```ts
type CharacterProviderBinding = {
  provider: "runway" | "higgsfield";
  mode: "stateless-refs" | "trained-id";
  externalId?: string;        // higgsfield soul_id (opaque)
  refFilenames: string[];     // 로컬 레퍼런스 이미지 매니페스트 (원본 보존 — export 불가 대비)
  tag?: string;               // runway @tag
  trainedAt?: string; status?: "ready"|"training"|"failed";
};
// element.meta.characterBindings?: CharacterProviderBinding[]
```

원본 사진 로컬 보존이 1급 요구사항: Higgsfield는 export가 없어 soul_id가 유일한 열쇠이므로,
재학습 가능성을 로컬 매니페스트로 담보한다.

### 2. 생성 파이프라인 연결 — MODIFY routes/mcpMedia.ts, lib/mcp/adapters/runway.ts (wp3 위에)

- 요청에 `characterElementId?` 수용 → runway lane이면 binding의 refFilenames를 referenceImages[{url,tag}]로 자동 전개(030 파이프라인 재사용, 3장 상한).
- higgsfield lane(결제 후)이면 binding.externalId를 params.soul_id로 전달.

### 3. UI — MODIFY ElementDetail.tsx + McpGenerationControls

- character element 상세에 "프로바이더 연동" 카드: Runway(태그 편집, 상시 가능) / Higgsfield(Train 버튼, 크레딧 고지, 결제 필요 배지).
- MCP 레인 composer에 캐릭터 선택 슬롯(inputRoles에 image_references 있는 모델만).

### 4. CLI — `ima2 gen/video --character <element-id|name>` (wp1 resolver 위에)

## 소스 근거 (접속일 2026-07-16)

| 주장 | 소스 | 상태 |
|------|------|------|
| Gen-4 References 3장/@name | help.runwayml.com Gen-4 Image References 문서 | proven |
| 레퍼런스 저장·공유(앱) | help.runwayml.com Using reference media 문서 | proven |
| API referenceImages{uri,tag} | docs.dev.runwayml.com/guides/using-the-api | proven |
| 이미지 포맷/크기 | docs.dev.runwayml.com/assets/inputs | proven (Gen-4 API 최대 장수는 unverified) |
| Seedance 2.0 비디오 레퍼런스 3개/50MB/15s | help.runwayml.com Creating with Seedance 2.0 | proven |
| Soul ID 학습/영속/비export | higgsfield.ai/blog Soul-ID-AI-Character-Consistency | proven |
| Soul 유료+25크레딧 | higgsfield.ai/blog sould-id-best-character-consistency | proven |
| show_characters/show_reference_elements 스키마 | ~/.ima2/mcp/snapshots/higgsfield.json (로컬 실측) | proven(스냅샷)/공개문서 unverified |
| Runway 저장 레퍼런스의 MCP 접근 | runwayml.com/mcp | unverified (미문서화) |

## Accept (wp4 구현 사이클)

1. character element에 binding 저장/조회 roundtrip 테스트 green.
2. Runway 캐릭터 생성 1건(승인 시)이 refs+tag로 통과, lineage에 characterElementId 기록.
3. Higgsfield 트랙은 결제 전까지 UI 배지+train 비활성(계약 테스트로 고정).
