# Storyboard Prompt Research (2026-06-02)

## Sources
- [MindStudio: Storyboards + Character Sheets for AI Video](https://www.mindstudio.ai/blog/storyboards-character-sheets-ai-video-generation/)
- [TrueFan: AI Video Prompt Engineering 2026](https://truefan.ai/blogs/ai-video-prompt-engineering-2026-guide)
- [AWS Nova: Video Generation Prompting](https://docs.aws.amazon.com/nova/latest/userguide/prompting-video-generation.html)
- [LTX Studio: AI Video Prompt Guide](https://ltx.studio/blog/ai-video-prompt-guide)
- [OpenAI: Image Gen Models Prompting Guide](https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide)
- [fal.ai: GPT Image 2 Prompting Guide](https://fal.ai/learn/tools/prompting-gpt-image-2)
- [murphy.inc: Consistent Characters in AI Storyboards](https://murphy.inc/consistent-characters-in-ai-generated-storyboard/)
- [PixVerse: GPT Image 2 Review & Prompt Guide](https://pixverse.ai/en/blog/gpt-image-2-review-and-prompt-guide)

## Key Findings

### GPT Image 2 Storyboard Keyframe Generation

#### Recommended Workflow
1. **Generate character anchor** (Frame 0): detailed reference sheet or strong portrait
2. **Outline sequence**: break story into numbered keyframes with clear progression
3. **Sequential generation**: Frame 1 full prompt, Frames 2+ upload prior frame + describe only changes
4. **Maintain consistency**: repeat fixed character description, specify "preserve exact identity from reference"

#### Core Prompt Template (Structured)
```
Scene: [environment, time, lighting, continuation notes from prior frame]
Subject: [Fixed character description] performing [action], with [expression/pose]
Important details: Camera [type, angle], Lighting [specific], Mood [tone], Props
Use case: Sequential storyboard keyframe for [project type]
Constraints: Preserve exact character identity from reference. Consistent style/palette/lighting. No changes unless stated.
```

#### Character Anchor Prompt
```
Create a professional character reference sheet for [description].
Include: front/side/back views, 4-6 expression variations, costume breakdowns, color swatches.
Consistent face/hair/proportions. Clean background, concept art style. 16:9.
```

#### Frame Continuation (2+)
```
Keyframe [N] — direct continuation of previous keyframe.
Same exact character as reference image.
[Only changes: new action, expression, camera shift, lighting progression]
Maintain perfect visual consistency.
```

### Video Storyboard Best Practices

#### Character Sheet as "Bible"
- 2-3 most distinctive visual identifiers per character (not full essay)
- Physical: height/build, skin tone, face shape, hair
- Clothing: specific items and placement
- Posture/movement defaults

#### Location Documents
- Scale, key objects, color palette, lighting defaults, atmosphere

#### Prompt Layering (Video)
1. Shot foundation: type + camera motion (at start or end of prompt)
2. Subject + action (from character sheet)
3. Environment (from location doc)
4. Technical: lens (85mm f/1.4), lighting (5600K key), color grade, fps, grain
5. Mood/emotion/motion physics
6. Continuity anchors: inherited tokens, seed, palette

#### Frame Chaining Rules
- Upload last frame of prior clip as start frame for next
- Inherit exact tokens/seeds/palettes
- Describe motion RELATIVE to reference frame
- One change per iteration for maximum stability
- Flag any continuity risks

### Critical Anti-Patterns
- Do NOT re-describe core character traits — only specify deltas
- Do NOT use negations ("no bananas" → adds bananas)
- Do NOT overwhelm with too many details per prompt
- Do NOT skip the anchor frame — it carries all identity load

## Applied to ima2-gen

### Image Mode (routes/generate.ts) Storyboard Prefix
- CHARACTER LOCK: verbatim description, 2-3 visual identifiers
- SCENE CONTINUITY: lighting/palette/environment locked
- Only change: action, shot scale, camera, expression
- Reference image = canonical anchor

### Video Mode (routes/video.ts) Storyboard Prefix
- CHARACTER LOCK: visual appearance identification, not names
- CONTINUITY: previous frame composition/pose/spatial carry
- PROMPT STRUCTURE: shot type → camera → subject → environment → dialogue → ending
- ENDING FRAME: must be stable for continuation
