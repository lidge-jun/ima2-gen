# 260602 — Storyboard + Planner + Skill Enhancement Plan

## Overview

4 work items, each a separate PABCD round:

1. **CLI `--planner-model` flag** (smallest, do first)
2. **Planner character/dialogue prompt enhancement** (prompt-only, no API change)
3. **i2v skill guide strengthening** (docs only)
4. **Storyboard mode UI + pipeline** (largest, last)

---

## Round 1: CLI `--planner-model`

### What
Add `--planner-model <name>` flag to `ima2 video` command.

### Where
- `bin/commands/video.ts` — add option parsing
- `routes/video.ts` — pass `plannerModel` from request body
- `lib/grokVideoAdapter.ts` — already supports `plannerModel` in config, just needs per-request override
- `skills/ima2/SKILL.md` — document the new flag

### Acceptance
```bash
ima2 video "prompt" --planner-model grok-4.3
ima2 video "prompt" --planner-model grok-composer-2.5-fast
```

---

## Round 2: Planner Character/Dialogue Enhancement

### Problem
Planner prompt says "include the exact line, speaker" but doesn't guide **visual-appearance-based character identification**. Video models don't know names — they need physical descriptions.

### What to change
`lib/grokVideoPlannerPrompt.ts` — add to system prompt:

```
MULTI-CHARACTER DIALOGUE RULES:
- Identify each character by VISUAL APPEARANCE, not by name alone.
  Wrong: "Bruce Lee says X"
  Right: "the lean Asian fighter in the bright yellow-and-black tracksuit says X"
- For each dialogue line, state: who (by appearance), exact line (original language), when in the action.
- Characters must be distinguishable by clothing, physique, position, or props — never rely on name recognition alone.
```

### Acceptance
Planner output for multi-character prompts includes visual descriptions for each speaker.

---

## Round 3: i2v Skill Guide

### Problem
Skill guide lacks:
- First-frame image composition strategy for i2v
- ref2v vs i2v decision tree
- Storyboard-to-video chaining workflow
- GPT Image 2 reference image best practices

### What to add to `skills/ima2/SKILL.md`

#### First-Frame Strategy
```
For i2v: ALWAYS generate the first frame as a GPT Image 2 still first,
with ALL characters and the environment composed together in one image.
Do NOT use individual portrait refs for i2v — the video model needs
a single composed scene to animate from.
```

#### ref2v vs i2v Decision Tree
```
| Scenario | Use | Why |
|----------|-----|-----|
| 2+ character refs, need identity lock | ref2v (grok-imagine-video, max 7 refs) | Refs lock character appearance |
| Single composed scene image | i2v (1.5-preview or base) | Better motion from composed start |
| Continue from previous video | video continue (last frame as i2v ref) | Lineage metadata preserved |
```

#### Storyboard Chaining
```
1. Generate keyframe image (GPT Image 2, composed scene)
2. Animate to video (i2v, 10s)
3. Extract last frame
4. Generate next keyframe (GPT Image 2, last frame as ref + metadata)
5. Animate next clip (i2v)
6. Repeat
```

#### GPT Image 2 Storyboard Prompting
Research findings from web:
- Character description verbatim copy across all frames (no paraphrasing)
- Anchor frame: first establishing shot sets visual baseline
- One variable per turn: change only shot scale/action/camera
- Metadata: [Shot N] (Ns): camera + action + dialogue
- Thinking mode for up to 8 consistent frames
- API: `images.edit` with `image[]` array for multi-ref, or Responses API with `input_image` content blocks

---

## Round 4: Storyboard Mode UI + Pipeline

### UI Layout

Current toolbar (2 rows × 3 cols):
```
[첨부] [이어가기] [🎬비디오]
[1:1]  [🌐웹검색] [저장]
```

With storyboard active (3 rows):
```
[첨부] [이어가기] [🎬비디오]
[1:1]  [🌐웹검색] [저장]
[────── 스토리보드 ──────]   ← full-width toggle, expands area below
```

Storyboard area expands BELOW the button, does NOT eat prompt textarea.

### Storyboard Toggle Behavior

#### Image mode + storyboard ON:
1. Carry prompt queue metadata from previous frames
2. Inject storyboard instruction: "This is storyboard frame N. Generate the next sequential frame continuing from the previous frame's composition, maintaining character descriptions verbatim."
3. User can parallel-generate and pick best frame

#### Video mode + storyboard ON:
1. Auto-generate keyframe image via GPT 5.5 Image 2 (current reasoning settings)
   - Fallback: grok+ (when OAuth auth fails)
2. Carry prompt queue metadata + storyboard context into image generation
3. Auto-pass generated image as ref to video model
4. Video model receives full prompt + storyboard metadata

### Storyboard State
- `storyboardActive: boolean` in store
- `storyboardFrameIndex: number` (auto-incremented from lineage)
- Metadata embedded in sidecar JSON: `{ storyboard: { index: N, totalPlanned: null, anchorFrame: "filename" } }`

### API Surface
- `/api/generate` — accept `storyboard: true` in body, inject storyboard prompt prefix
- `/api/video/generate` — when `storyboard: true`, auto-generate keyframe first if no ref provided

### GPT Image 2 Keyframe Generation (for video storyboard mode)
Uses existing `editViaResponses()` or generate path:
- Pass last frame as `input_image` via Responses API content array
- Prompt includes: storyboard context + character descriptions + next scene direction
- Quality: current reasoning effort setting
- Fallback: if OAuth fails → grok+ image generation

---

## Web Research References

- [GPT Image 2 + Seedance Storyboard Workflow](https://vicsee.com/blog/gpt-image-2-seedance-storyboard-workflow)
- [Solo Storyboard with GPT Image 2](https://floatboat.ai/blog/gpt-image-2-storyboard-solo)
- [OpenAI Image Generation Guide](https://developers.openai.com/api/docs/guides/image-generation)
- [GPT Image 2 Prompt Guide — Framia](https://framia.converge.ai/page/en-US/blog/gpt-image-2-prompt-guide)
- [Higgsfield Storyboard Generator](https://higgsfield.ai/storyboard-generator)

### Key API Findings
- `images.edit` accepts `image[]` array for multi-reference
- Responses API: `input_image` content blocks with `image_url: "data:image/jpeg;base64,..."`
- ima2 already uses this pattern in `responsesImageAdapter.ts:426` for reference images
- Character consistency: model may drift — verbatim description copy + anchor frame is the mitigation
- No storyboard-specific API endpoint — this is a workflow pattern built on edit/generate
