# Round 2: Planner Character/Dialogue Enhancement

## Summary
비디오 플래너가 다중 인물 씬에서 누가 무슨 대사를 하는지 외형 묘사 기반으로 구분하도록 시스템 프롬프트를 강화합니다.

## Changes

### MODIFY: `lib/grokVideoPlannerPrompt.ts`

**Before (line 43):**
```
"- If dialogue matters, include the exact line, speaker, and whether it finishes before the final cut.",
```

**After:**
```
"- If dialogue matters, include the exact line, speaker, and whether it finishes before the final cut.",
"",
"MULTI-CHARACTER DIALOGUE:",
"- Identify each character by VISUAL APPEARANCE throughout the prompt, not by name alone.",
"  The video model cannot recognize names — it only sees visual features.",
"  Wrong: 'Bruce Lee delivers the line'",
"  Right: 'the lean Asian fighter in the bright yellow-and-black tracksuit delivers the line'",
"- For each dialogue line, specify: who (by clothing, physique, position, or props), the exact line in original language, and when during the action.",
"- When the user provides character names, map each name to a unique visual description on first mention, then use that description consistently for the rest of the prompt.",
"- Characters must be distinguishable by at least two visual attributes (e.g. clothing color + physique, or position + props).",
```

### MODIFY: `lib/grokImageAdapter.ts` (Grok image planner — same fix)

Add the same multi-character visual ID rule to the image planner system prompt.

## Acceptance
- Planner system prompt contains MULTI-CHARACTER DIALOGUE section
- tsc clean, tests pass
