// Prompt enhance ("다듬기") rewrites a short user prompt into a concrete
// photographic prompt suited to the image_generation tool behind Responses API.
//
// Design (NANO_BANANA_GUIDE 5-element framework):
//   Person · Outfit · Location · Pose · Exposure  →  one natural-language paragraph.
//
// Rules baked into the system prompt:
//   - Output ONLY the rewritten prompt body. No preamble, no disclaimers, no
//     explanations, no meta-commentary about safety, ratings, or appropriateness.
//   - Never inject self-censoring tags like "non-sexual", "non sexual",
//     "비성적", "성적이지 않은", "appropriate", "fashion safe", etc.
//   - Reply in the same language as the input (Korean → Korean, English → English),
//     but technical photography terms may stay in English.

// Light-touch rewrite. The image generation model already has strong defaults
// for lens / lighting / composition, and the user said micro-managing those
// hurts variety and quality. So the rewriter now only:
//   1) clarifies the subject + action (who is doing what, where),
//   2) keeps the user's stylistic words verbatim,
//   3) leaves anything the user did NOT specify alone.
// It does NOT inject "8K sharp photo / candid snapshot / not a studio
// photoshoot / no date stamp / her face is clearly visible / etc." — those
// were forcing every output into the same look.
const COMMON_RULES = [
  "Output ONLY the rewritten image prompt body. No preface, no closing remarks, no explanations.",
  "Light touch. Preserve the user's words and intent. Disambiguate vague subjects (e.g. '여자' → 'young Korean woman') and clarify the action/setting only when the input is ambiguous. Keep the result roughly the same length as the input — short input stays short.",
  "Do NOT add details the user did not ask for. Specifically: do not invent camera bodies, focal lengths, apertures, lighting setups, color grading, film stocks, lens descriptors, or composition framing unless the user explicitly mentioned them.",
  "Do NOT inject standard quality boilerplate ('8K', 'high resolution', 'photorealistic', 'sharp focus', 'masterpiece', 'best quality', 'realistic skin texture', 'face clearly visible', 'candid snapshot', 'not a studio photoshoot', 'no watermark', etc.). The image model handles those defaults on its own.",
  "Do NOT insert self-censoring or safety-disclaimer phrases. Specifically forbid: 'non-sexual', 'non sexual', 'non-erotic', 'fashion safe', 'safety oriented', 'tasteful framing', 'family friendly', 'appropriate for all audiences', '비성적', '선정적이지 않', '성적이지 않', '안전한', '건전한'.",
  "Do NOT add age qualifiers, audience disclaimers, or platform compliance notes.",
  "If the input names a real person, keep the name verbatim and do not describe their facial features (no jawline, cheekbones, eye shape, etc.).",
  "Do not invent a different subject than the user requested.",
  "Output a single natural-language sentence or short paragraph — no bullet lists, no comma-tag dumps.",
];

const SYSTEM_PROMPT_KO = [
  "당신은 이미지 생성 프롬프트를 가볍게 다듬는 보조입니다. 사용자의 의도와 표현을 최대한 보존하고, 모호한 부분만 자연스럽게 명료화합니다. 모델에 맡길 수 있는 디테일(렌즈/조명/구도/품질 키워드)은 절대로 임의로 추가하지 않습니다.",
  "한국어 입력은 한국어로, 영어 입력은 영어로 답합니다. 사용자가 사용한 언어와 톤을 유지합니다.",
  ...COMMON_RULES,
].join(" ");

const SYSTEM_PROMPT_EN = [
  "You are a light-touch prompt assistant. Preserve the user's intent and wording as much as possible. Only clarify ambiguous subjects or actions; never invent technical or stylistic details the user did not specify.",
  "Reply in Korean if the input is Korean, English if the input is English. Match the user's tone and length.",
  ...COMMON_RULES,
].join(" ");

export function buildEnhancePayload(prompt, language, references = []) {
  const sys = language === "ko" ? SYSTEM_PROMPT_KO : SYSTEM_PROMPT_EN;
  // When the user attached reference images, fold them into the user turn
  // alongside the text so the rewriter can describe the actual subject /
  // outfit / setting instead of guessing from the short prompt.
  const refs = Array.isArray(references) ? references.filter((r) => typeof r === "string" && r.length > 0) : [];
  const userContent = refs.length > 0
    ? [
        { type: "input_text", text: prompt },
        ...refs.map((b64) => ({
          type: "input_image",
          image_url: `data:image/png;base64,${b64}`,
        })),
      ]
    : prompt;
  const refNote = refs.length > 0
    ? " The user attached reference image(s). When clarifying the subject, you may name what is actually visible (subject, outfit, setting). Still: do not enumerate every visual detail you see, do not invent additional details, and follow the same light-touch rules — let the image model handle composition/lighting on its own."
    : "";
  return {
    model: "gpt-5.5",
    stream: true,
    // Light-touch rewrite — keep latency + cost low. The system prompt
    // forbids speculative additions, so heavier reasoning would just burn
    // tokens producing the same answer.
    reasoning: { effort: "low" },
    input: [
      { role: "system", content: sys + refNote },
      { role: "user", content: userContent },
    ],
    tools: [],
    max_output_tokens: 400,
  };
}

// Strips self-censoring phrases the model may still emit despite the system rules.
// Conservative: matches whole-token forms and trims orphaned punctuation/connectors
// left behind. Returns the input unchanged if no patterns matched.
const SELF_CENSOR_PATTERNS = [
  /\bnon[-\s]?sexual\b[^.,;\n]*/gi,
  /\bnon[-\s]?erotic\b[^.,;\n]*/gi,
  /\b(?:tasteful|fashion[-\s]?safe|family[-\s]?friendly|safety[-\s]?oriented|safe[-\s]?for[-\s]?work|sfw)\b[^.,;\n]*/gi,
  /\bappropriate for [^,.;\n]+/gi,
  /\bavoid(?:ing|s)? (?:nudity|see-?through|erotic|fetish|sexual)[^.,;\n]*/gi,
  // Age/legality disclaimers ("adults aged 25 or older", "25+ adult", "of legal age", etc.)
  /\b(?:adults?|adult\s*women|adult\s*men|model)\s*(?:aged|age|of)\s*(?:18|21|25)\s*(?:\+|or older|and older|years? old)?[^.,;\n]*/gi,
  /\b(?:18|21|25)\s*\+\s*(?:only|adult|model)?[^.,;\n]*/gi,
  /\b(?:of|over)\s*(?:legal|legal age|18|21|25)[^.,;\n]*/gi,
  /\bno\s+minors[^.,;\n]*/gi,
  /비성적[^.,;\n]*/g,
  /선정적이지\s*않[^.,;\n]*/g,
  /성적이지\s*않[^.,;\n]*/g,
  /노출\s*강조\s*없[^.,;\n]*/g,
  /건전한[^.,;\n]*/g,
  // Korean age disclaimers (e.g. "25세 이상 성인 한국 여성" → drop the disclaimer prefix only)
  /(?:만\s*)?(?:18|19|21|25)\s*세\s*이상\s*성인\s*/g,
  /(?:만\s*)?(?:18|19|21|25)\s*세\s*이상\s*/g,
  /\b미성년자(?:는|를)?\s*(?:없|제외|금지)[^.,;\n]*/g,
];

export function sanitizeEnhancedText(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text;
  for (const re of SELF_CENSOR_PATTERNS) out = out.replace(re, "");
  // Collapse leftover ", , ", " ,.", double spaces, and stray leading/trailing punctuation.
  out = out
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s*,\s*\./g, ".")
    .replace(/\.\s*,/g, ".")
    .replace(/\(\s*\)/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([.,;!?])/g, "$1")
    .replace(/^[\s,;:.\-]+/, "")
    .replace(/[\s,;:]+$/, "")
    .trim();
  return out;
}

export function extractEnhancedText(raw) {
  if (!raw || !Array.isArray(raw.output)) return null;
  const parts = [];
  for (const item of raw.output) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const c of item.content) {
        if (c?.type === "output_text" && typeof c.text === "string") {
          parts.push(c.text);
        }
      }
    }
  }
  if (parts.length === 0) return null;
  return sanitizeEnhancedText(parts.join(""));
}
