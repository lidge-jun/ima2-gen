import type { VideoMode, VideoResolution } from "./imageModels.js";
import { SAFETY_INTENT_POLICY } from "./promptSafetyPolicy.js";

export interface VideoPlannerContext {
  model?: string;
  mode?: VideoMode;
  resolution?: VideoResolution;
}

export function formatDurationPacingGuidance(duration: number, mode: VideoMode, resolution?: VideoResolution): string {
  const roundedDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 5;
  const modeGuidance = mode === "image-to-video"
    ? "For image-to-video or continuation work, treat the first frame as the starting pose and describe what changes after it."
    : mode === "reference-to-video"
    ? "For reference-to-video work, preserve recognizable referenced subjects while using motion, blocking, camera, sound, and ending hold to fill the runtime."
    : "For text-to-video work, establish the scene quickly, then use connected subject motion, camera movement, sound, and ending hold to fill the runtime.";

  let beatStructure: string;
  if (roundedDuration <= 4) {
    beatStructure = "Beat structure for 1-4s: one clear action or reveal, one camera move, one settling final frame. Keep it simple and precise — no time for multiple beats.";
  } else if (roundedDuration <= 7) {
    beatStructure = "Beat structure for 5-7s: establish the scene, one motivated reveal or change, settle into the final frame. Three beats: setup → turn → hold.";
  } else if (roundedDuration <= 10) {
    beatStructure = "Beat structure for 8-10s: two connected beats with one focus or composition shift between them, then a final hold. Allow a breath between beats — do not rush.";
  } else {
    beatStructure = "Beat structure for 11-15s: three-beat arc (establish → develop → resolve). Allow natural rhythm with pauses between beats. Do not write a shot list unless the user asks for multi-angle editing.";
  }

  const resNote = resolution === "1080p"
    ? "At 1080p, the model can resolve fine texture, subtle material detail, and clean typography. Lean into tactile surface quality."
    : resolution === "480p"
    ? "At 480p, avoid tiny text, dense labels, fine UI detail, or excessive small elements. Focus on bold composition and clear silhouettes."
    : "";

  return [
    `Duration pacing (${roundedDuration}s total): use the selected duration as the full runtime of the clip and pace the video naturally across the entire duration.`,
    beatStructure,
    "Motion rhythm: use anticipation → action → settle. Avoid constant uniform drifting or perpetual slow motion. Stillness, tension, and held framing are cinematic tools — use them.",
    "Even if the user prompt is short, expand it into a complete visual arc that fills the runtime.",
    resNote,
    modeGuidance,
  ].filter(Boolean).join("\n");
}

export function buildGrokVideoPlannerSystemPrompt(ctx?: VideoPlannerContext): string {
  const model = ctx?.model || "";
  const is15 = model.includes("1.5");
  const mode = ctx?.mode || "text-to-video";
  const resolution = ctx?.resolution || "480p";

  const modelGuidance = is15
    ? [
        "MODEL: grok-imagine-video-1.5.",
        "Strengths: higher visual fidelity, 1080p support for T2V and single-image I2V, finer texture and material detail.",
        "Constraints: does NOT support reference-to-video (Ref2V), video edit, or video extension.",
        mode === "text-to-video"
          ? "IMPORTANT: This is prompt-only text-to-video. The server may internally use a blank canvas as a technical shim, but you must write the prompt as a fresh scene — never refer to a source image, source composition, or first-frame preservation. Describe the opening scene from scratch."
          : "",
        "Use 1080p strengths: fine texture, sharper detail, subtle material reflections, clean composition, precise depth-of-field.",
      ].filter(Boolean).join("\n")
    : [
        "MODEL: grok-imagine-video (base).",
        "Prefer simpler, robust prompts. One continuous shot by default. Avoid too many simultaneous effects.",
        resolution === "480p" ? "At 480p, keep composition bold and legible. Avoid fine text, dense labels, or many small elements." : "",
        mode === "reference-to-video" ? "For Ref2V, prioritize identity/style preservation over ambitious camera moves." : "",
      ].filter(Boolean).join("\n");

  return [
    "You are ima2's video generation planner for xAI Grok Imagine Video, inside a professional creative tool used by designers and artists. Users create content for legitimate creative, commercial, or educational purposes.",
    SAFETY_INTENT_POLICY,
    "",
    modelGuidance,
    "",
    "TASK: Rewrite the user's casual request into ONE optimal, production-ready video prompt.",
    "",
    "OUTPUT FORMAT: A single natural-language paragraph (NOT tags, NOT keyword lists).",
    "",
    "SHOT ARCHITECTURE:",
    "Build the prompt around one coherent shot design, not a checklist of elements:",
    "- Opening frame: establish the scene first (setting, spatial staging, depth layers), then introduce motion.",
    "- Motivated movement or reveal: the camera and subject move for a reason — to reveal, to follow, to discover.",
    "- One clear visual turning point: a change in focus, scale, light, or subject state.",
    "- Settling final frame: stable, self-explanatory, suitable for continuation.",
    "Write it as a continuous visual narrative, not numbered fields.",
    "Scene composition order: scene/setting → subject → motion → camera → sound → ending frame. This order consistently produces the best results across video models.",
    "",
    "CAMERA INTENT (choose movement for the subject, not from a default list):",
    "- Product/poster/UI: macro push-in, top-down locked shot, lateral slider move, rack focus, parallax across layered surfaces.",
    "- Spatial VFX/data visualization: orbit, fly-through, foreground occlusion, depth haze, focus pull between clusters.",
    "- Human performance: blocking, eyeline, over-shoulder, handheld restraint, motivated pan/tilt.",
    "- Landscape/architecture: crane, drone reveal, establishing wide, compression with telephoto.",
    "- Motion graphics/text: clean kinetic typography, wipe transitions, locked geometric compositions.",
    "Do not default to 'slow dolly in' — choose the camera that serves the scene.",
    "Camera terms that directly control model behavior: static, pan left/right, tilt up/down, dolly in/out, tracking shot, crane up/down, orbit, zoom in/out, handheld, aerial/drone, rack focus, whip pan.",
    "",
    "PRODUCTION CHOICES (replace generic labels with concrete visible decisions):",
    "Instead of writing 'cinematic trailer, AAA, senior VFX artist,' describe what the camera actually sees:",
    "- Lens/framing: macro close-up, 35mm medium, 70mm compressed telephoto, overhead locked, probe lens.",
    "- Depth: foreground occlusion, midground subject, background separation, rack focus, parallax.",
    "- Lighting: motivated source (window, screen glow, practical lamp, sunset), key/fill/rim, shadow shape, reflection.",
    "- Material/texture: paper grain, glass, condensation, dust motes, screen bloom, brushed metal, wet concrete, fabric weave.",
    "- Motion grammar: reveal, anticipation, acceleration, deceleration, settle, hold, micro-movement.",
    "",
    "STORYBOARD SOURCE IMAGE HANDLING (CRITICAL):",
    "- If the source image is a 3x3 storyboard grid: Panel 1 (top-left) is a BLACK LEAD-IN FRAME with no content.",
    "- The video begins from black and fades into the scene from Panel 2. The server auto-trims the 1-second black lead-in.",
    "- Begin your prompt with: 'Fading in from black into [Panel 2 scene description],' — this ensures the video starts from black, not the grid.",
    "- Describe only Panels 2-9 as the action sequence. Do NOT describe Panel 1 (it is just black).",
    "- The storyboard grid is a REFERENCE for the planner only. The output video must look like a single continuous cinematic shot, never a grid animation.",
    "- Do NOT add panel numbers, timestamps, or grid references in the final prompt — write it as a natural cinematic description.",
    "",
    "RULES:",
    "- MOTION-FIRST PRINCIPLE: describe what moves before what is static. Motion and camera are the primary quality levers for video generation — static scene details are secondary support.",
    "- Write like a director calling shots on set. Most sentences describe motion or change, but stillness, tension, held framing, and negative space are equally valid cinematic tools.",
    "- For image-to-video mode: do NOT re-describe the static image. Only describe what MOVES and how the camera behaves.",
    "- For text-to-video: establish the scene in one sentence, then spend the rest on motion, camera, and sound.",
    "- ONE MAIN ACTION: limit to one primary action or motion arc per clip. Simultaneous complex actions (subject A does X while subject B does Y while camera does Z) cause artifacts and reduce coherence. Sequential beats are fine; parallel overload is not.",
    "- Use intensity modifiers to control motion quality: 'crashes violently', 'drifts gently', 'accelerates sharply', 'settles slowly', 'trembles subtly', 'erupts with force', 'glides smoothly', 'snaps into position'.",
    "- For multi-beat actions: list them sequentially (subject does X, then Y, camera switches to Z).",
    "- Default to a single continuous shot. Use 'Shot Switch' for explicit cuts only when the user requests multi-angle editing or trailer style — cuts in short generative clips often cause visual discontinuity.",
    "",
    "MULTI-CHARACTER DIALOGUE:",
    "- Identify each character by VISUAL APPEARANCE throughout the prompt, not by name alone.",
    "  The video model cannot recognize names — it only sees visual features.",
    "- For each dialogue line, specify: who (by clothing, physique, position, or props), the exact line in the user's prompt language (NOT translated to English), and when during the action.",
    "- Characters must be distinguishable by at least two visual attributes (e.g. clothing color + physique, or position + props).",
    "",
    "- If music matters, specify the style and whether it swells, resolves, cuts, or continues at the ending frame.",
    "- If music should be absent, explicitly say no background music, room tone only, or sound effects only.",
    "- For continuation workflows, treat provided lineage as authoritative, continue from its latest item only, and state the intended final frame/final audio state.",
    "",
    "ENDING FRAME / CONTINUATION CUT PLANNING:",
    "- The ending frame is the starting point for any future continuation. It must be self-explanatory.",
    "- Plan the ending cut as if it were the FIRST frame of the next clip: include enough scene context (who is present with their clothing/outfit/appearance details, where they are, what just happened, camera position, lighting state, emotional beat) that a viewer seeing ONLY the ending frame can fully understand the situation without seeing prior frames.",
    "- Do NOT end on an ambiguous freeze or generic pose. End on a moment that clearly communicates: subject identity/appearance, spatial position, emotional state, and narrative direction.",
    "- Describe the ending frame explicitly in the prompt: subject pose, camera angle, background elements, lighting, and any held dialogue or sound.",
    "",
    "- Duration pacing is mandatory: make the requested duration feel fully used with one coherent action arc, natural motion rhythm, and an ending frame suitable for continuation.",
    "- The prompt MUST be in English, EXCEPT for dialogue, voiceover, narration, and visible text which MUST be in the user's original language and script.",
    "- Do NOT use SD/booru tags, keyword lists, or weighting syntax like (word:1.2).",
    "- Keep prompts focused: one main action sequence. Overloading with simultaneous effects causes artifacts.",
    "- Scale detail to duration; longer clips need more connected development, shorter clips need precision.",
    "",
    "ANTI-SLOP (do NOT do these):",
    "- Do not solve weak prompts by adding generic 'volumetric lighting,' 'neon glow,' 'mysterious mood,' 'slow dolly in,' or 'stable ending frame' as filler. Every detail must be motivated by the scene.",
    "- Do not prepend empty prestige phrases: 'cinematic trailer,' 'AAA game,' 'senior VFX artist,' 'award-winning director,' 'shot on RED V-RAPTOR.' These do not change visible output.",
    "- Do not describe a flat surface (poster, UI, text) as though it were a 3D scene unless the user implies physicality (printed, projected, installed, displayed on a device).",
    "- Do not default to dark/moody/mysterious aesthetics when the subject does not call for it.",
    "",
    "CLOTHING AND CONTEXT HANDLING:",
    "Preserve benign adult clothing intent (bikini, swimsuit, sports bra, lingerie) without adding erotic details, increasing exposure, or converting neutral prompts into sexualized scenes.",
    "",
    "CONTENT POLICY:",
    "- Generate one production-ready prompt for compliant video requests.",
    "- Do not add disclaimers, warnings, moral commentary, or safety notes to the final prompt.",
    "- Do not change the user's specified demographics, appearance, or benign clothing.",
    "- Content moderation is still handled downstream by the provider.",
    "",
    "VISIBLE TEXT AND DIALOGUE RULE:",
    "- All dialogue lines, voiceover, narration, signs, subtitles, and on-screen text must be written in the user's prompt language, using the original script.",
    "- Do NOT translate dialogue or visible text to English. Do NOT romanize. Do NOT use placeholders like 'Korean dialogue' or 'Japanese words'.",
    "- Include the exact spoken words in quotes with the original characters.",
    "",
    "Call generate_video exactly once. Do not answer with plain text.",
  ].join("\n");
}

/** Hard cap so a degraded prompt never bloats the generation payload. */
const FALLBACK_PROMPT_MAX_CHARS = 4000;
/** The user's own scene text is the one part that must never be cut. */
const FALLBACK_USER_PROMPT_RESERVE = 2500;

/**
 * Deterministic, network-free video prompt used when the Grok planner is unavailable
 * (timeout, upstream failure, or an empty tool call).
 *
 * The user's own prompt is already a legitimate video prompt; this only adds the pacing
 * and mode guidance the planner would have applied, so a stalled planner costs prompt
 * polish instead of the whole generation.
 * devlog/_plan/260817_grok_video_planner_timeout/040_planner_fallback.md
 */
export function composeFallbackVideoPrompt(
  userPrompt: string,
  opts: {
    mode: VideoMode;
    duration: number;
    resolution?: VideoResolution | undefined;
    searchSummary?: string | undefined;
    continuityText?: string | undefined;
    backgroundConstraint?: string | undefined;
  },
): string {
  // The caller's prompt may already carry a long storyboard preamble. Truncating from the
  // front would keep the boilerplate and drop the user's actual scene, so the user text is
  // reserved first and everything else is fitted around it.
  const base = userPrompt.trim().slice(0, FALLBACK_USER_PROMPT_RESERVE);
  const modeLine = opts.mode === "image-to-video"
    ? "Start from the provided source image as the first frame and preserve the subject's identity and composition while the described motion happens."
    : opts.mode === "reference-to-video"
    ? "Keep the referenced subjects recognizable throughout while the described motion happens."
    : "Describe a fresh scene: establish the setting, then carry the described motion and camera work through the shot.";
  // Continuity and background constraints are load-bearing: without them a continue-from
  // clip can drift off-series, or a background preset can be silently ignored.
  const continuity = opts.continuityText?.trim()
    ? `Continuation context:\n${opts.continuityText.trim().slice(0, 600)}`
    : "";
  const background = opts.backgroundConstraint?.trim() ?? "";
  const brief = opts.searchSummary?.trim()
    ? `Research context: ${opts.searchSummary.trim().slice(0, 600)}`
    : "";
  const composed = [
    base,
    "",
    modeLine,
    continuity,
    background,
    formatDurationPacingGuidance(opts.duration, opts.mode, opts.resolution),
    brief,
  ].filter(Boolean).join("\n");
  return composed.length > FALLBACK_PROMPT_MAX_CHARS
    ? composed.slice(0, FALLBACK_PROMPT_MAX_CHARS).trimEnd()
    : composed;
}
