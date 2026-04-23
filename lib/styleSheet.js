// Style-sheet extractor (0.10)
//
// Uses GPT-5.4 (chat completions) to derive a structured "style guide" from a
// user prompt and optional reference image. The style guide is stored per
// session and automatically prepended to subsequent image generations so
// continuations feel cohesive — closer to ChatGPT 4o's image carry-over.
//
// Shape:
//   {
//     palette: string[],         // e.g. ["deep navy", "gold leaf"]
//     composition: string,       // e.g. "centered 3/4 portrait, shallow depth"
//     mood: string,              // e.g. "melancholic, reverent"
//     medium: string,            // e.g. "oil painting, glazed layers"
//     subject_details: string,   // identity/pose/outfit cues for character continuity
//     negative: string[]         // things to avoid
//   }
//
// The module is pure JS + openai SDK. When no API key is configured it throws
// STYLE_SHEET_NO_KEY so callers can surface a friendly "connect key" UI.

const STYLE_SHEET_MODEL = process.env.IMA2_STYLE_MODEL || "gpt-5.4-mini";

const SYSTEM_PROMPT = `You extract a reusable visual style guide from a user
image prompt (and an optional reference image). Return ONLY a JSON object with
these keys: palette (array of 3-6 concrete color names), composition (one
sentence), mood (2-4 comma-separated adjectives), medium (one short phrase
naming technique/material), subject_details (one sentence capturing identity
cues: face, outfit, pose, distinctive features), negative (array of 0-4 short
phrases of things to avoid). Keep entries tight — each under 120 characters.
Do not wrap in markdown. Do not add commentary.`;

function coerceStyleSheet(raw) {
  if (!raw || typeof raw !== "object") return null;
  const arr = (v, max = 6) =>
    Array.isArray(v)
      ? v
          .filter((x) => typeof x === "string" && x.trim())
          .slice(0, max)
          .map((s) => s.trim())
      : [];
  const str = (v) => (typeof v === "string" ? v.trim().slice(0, 400) : "");
  return {
    palette: arr(raw.palette, 6),
    composition: str(raw.composition),
    mood: str(raw.mood),
    medium: str(raw.medium),
    subject_details: str(raw.subject_details),
    negative: arr(raw.negative, 4),
  };
}

export async function extractStyleSheet(openai, { prompt, referenceDataUrl }) {
  if (!openai) {
    const err = new Error("No OpenAI client configured for style-sheet extraction");
    err.code = "STYLE_SHEET_NO_KEY";
    throw err;
  }
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    const err = new Error("prompt is required");
    err.code = "STYLE_SHEET_BAD_INPUT";
    throw err;
  }

  const userContent = referenceDataUrl
    ? [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: referenceDataUrl } },
      ]
    : prompt;

  const resp = await openai.chat.completions.create({
    model: STYLE_SHEET_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const raw = resp.choices?.[0]?.message?.content;
  if (!raw) {
    const err = new Error("Empty response from style-sheet model");
    err.code = "STYLE_SHEET_EMPTY";
    throw err;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    const err = new Error("Style-sheet model returned non-JSON");
    err.code = "STYLE_SHEET_PARSE";
    throw err;
  }

  const sheet = coerceStyleSheet(parsed);
  if (!sheet) {
    const err = new Error("Style-sheet shape invalid");
    err.code = "STYLE_SHEET_SHAPE";
    throw err;
  }
  return sheet;
}

// Render a style sheet into a prompt preamble that gpt-image-1/2 can consume.
// Kept short so it doesn't blow the 4K prompt window on long user prompts.
export function renderStyleSheetPrefix(sheet) {
  if (!sheet) return "";
  const parts = [];
  if (sheet.medium) parts.push(`Medium: ${sheet.medium}.`);
  if (sheet.palette?.length) parts.push(`Palette: ${sheet.palette.join(", ")}.`);
  if (sheet.composition) parts.push(`Composition: ${sheet.composition}.`);
  if (sheet.mood) parts.push(`Mood: ${sheet.mood}.`);
  if (sheet.subject_details) parts.push(`Subject: ${sheet.subject_details}.`);
  if (sheet.negative?.length) parts.push(`Avoid: ${sheet.negative.join(", ")}.`);
  return parts.join(" ");
}

export { STYLE_SHEET_MODEL, SYSTEM_PROMPT, coerceStyleSheet };
