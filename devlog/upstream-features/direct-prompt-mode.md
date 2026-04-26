# Direct Prompt Mode + revised_prompt 캡처

> 마스터: [README.md](README.md) — Phase 3.1
> 참조: upstream `391d9e7` `ef4a9e0` (frontend contracts)

## 배경

OpenAI 이미지 모델은 사용자 프롬프트를 자체적으로 "revise"(의역)해서 생성에 사용함. 이 의역이 사용자 의도를 흐리는 경우가 있고, 응답에 포함된 `revised_prompt` 필드는 모델이 어떻게 해석했는지 보여주는 단서지만 우리는 현재 무시 중.

**Direct mode**: 사용자 프롬프트를 1:1로 모델에 전달, 의역 최소화. 토글로 on/off.
**revised_prompt 캡처**: 모델이 실제로 사용한 프롬프트를 사이드카에 저장해 디버깅·재현·갤러리 메타에 활용.

## 동작 명세

### Server (`server.js`)
1. **상수 추가**:
   ```js
   const PROMPT_FIDELITY_SUFFIX = '\n\n[Render exactly as described. Do not paraphrase or add unrelated details.]';
   ```
2. **`buildUserTextPrompt(prompt, mode)` 헬퍼**:
   - `mode === 'direct'` 이면 `${prompt}${PROMPT_FIDELITY_SUFFIX}` 반환
   - `mode === 'agent'`(기본) 이면 prompt 그대로
3. **`/api/generate` 페이로드에 `mode` 추가**:
   - body에서 `mode` 읽고 (`'direct' | 'agent'`, 기본 `'agent'`)
   - `buildUserTextPrompt(prompt, mode)`로 모델 호출
4. **응답에서 `revised_prompt` 추출**:
   - SSE 스트림: `data.item.revised_prompt`
   - 비스트림 / retry 경로 동일
5. **응답 + 사이드카에 메타 추가**:
   - 응답: `extra: { promptMode, userPrompt, revisedPrompt }`
   - 사이드카 JSON에도 동일 3필드 저장

### UI (`ui/`)
1. **store** (`useAppStore.ts`):
   ```ts
   promptMode: 'agent' | 'direct'
   setPromptMode: (m) => void
   ```
   기본값 `'agent'`
2. **PromptComposer**: "Direct" 토글 chip 추가 (1:1 아이콘 또는 한국어 라벨 "원문 그대로")
3. **generate 페이로드에 `mode` 포함**
4. **결과 표시**: 메타 패널에 `promptMode`, `revisedPrompt`(있을 때) 노출

### types
```ts
type PromptMode = 'agent' | 'direct';

interface GenerateMeta {
  userPrompt: string;
  revisedPrompt?: string;
  promptMode: PromptMode;
  // ...
}
```

## 영향 파일 (우리 코드 기준)

| 파일 | 변경 |
|------|------|
| `server.js` | `PROMPT_FIDELITY_SUFFIX`, `buildUserTextPrompt`, `/api/generate` mode 처리, revised_prompt 캡처. `/api/edit`도 동일하게 적용 권장 |
| `lib/sidecar.js` (있으면) | 메타에 `promptMode`/`revisedPrompt` 추가 |
| `ui/src/store/useAppStore.ts` | `promptMode` 상태 |
| `ui/src/components/PromptComposer.tsx` | Direct 토글 chip |
| `ui/src/types.ts` | `PromptMode` 타입 |
| `ui/src/lib/api.ts` | generate 호출 페이로드에 mode 추가 |

## 검증

1. **단위 테스트**: `tests/prompt-fidelity.test.js` 신규 — buildUserTextPrompt 분기, mode 미지정 시 'agent' 기본
2. **E2E**: Direct ON → 동일 프롬프트로 생성 → 결과 메타에 `promptMode: 'direct'`, `revisedPrompt`가 원문과 거의 동일한지 육안 확인
3. **회귀**: Direct OFF로 생성한 기존 이미지가 정상 렌더링되는지

## 의존성 / 순서

- 단독 진행 가능. Phase 1·2와 무관
- Phase 3.2 StyleSheet와 같이 가도 됨 (StyleSheet 활성 시 prefix가 추가되는데, Direct mode면 suffix도 적용 — prefix는 스타일, suffix는 fidelity 강제로 의도 다름)
