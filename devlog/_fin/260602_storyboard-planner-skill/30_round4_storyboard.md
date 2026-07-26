# Round 4: Storyboard Mode UI + Pipeline

## Summary
프롬프트 컴포저에 스토리보드 토글을 추가하고, 이미지/비디오 모드에서 자동 스토리보드 워크플로우를 구현합니다.

## File Changes

### NEW: `ui/src/lib/storyboard.ts`
스토리보드 상태 및 프롬프트 주입 로직.
- `buildStoryboardPrefix(frameIndex, anchorPrompt)` — 프롬프트 앞에 스토리보드 컨텍스트 주입
- `getStoryboardFrameIndex(lineage)` — lineage entries에서 프레임 인덱스 추출

### MODIFY: `ui/src/store/useAppStore.ts`
- Add `storyboardActive: boolean` state + `toggleStoryboard()` action
- `storyboardActive` persisted to localStorage via existing persistence system

### MODIFY: `ui/src/components/PromptComposer.tsx`
- Add 3rd toolbar row: full-width "스토리보드" toggle button
- When active + lastframe present: show storyboard context area (below button, above textarea)
- Wire toggle to store `toggleStoryboard()`

### MODIFY: `ui/src/i18n/en.json` + `ko.json`
- `prompt.storyboard`: "Storyboard" / "스토리보드"
- `prompt.storyboardTitle`: tooltip text

### MODIFY: `ui/src/index.css`
- `.composer__tool--storyboard`: full-width spanning all 3 grid columns
- `.composer__storyboard-context`: expandable area below toggle

### MODIFY: `routes/generate.ts`
- Read `req.body.storyboard: boolean`
- If true, prepend storyboard instruction to prompt

### MODIFY: `routes/video.ts`
- Read `req.body.storyboard: boolean`
- If true + no ref provided: auto-generate keyframe via GPT Image 2 (OAuth → grok+ fallback)
- Pass keyframe as sourceImage to video generation

## Acceptance
1. 스토리보드 토글 ON/OFF 동작
2. 이미지 모드: 프롬프트에 스토리보드 컨텍스트 주입됨
3. 비디오 모드: 자동 키프레임 이미지 생성 → ref로 전달
4. tsc clean, tests pass
5. 직원 검증
