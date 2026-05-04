export const CARD_NEWS_TEXT_KINDS = ["headline", "body", "caption", "cta", "badge", "number"];
export const CARD_NEWS_RENDER_MODES = ["in-image", "ui-only"];
export const CARD_NEWS_PLACEMENTS = [
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
  "free",
];
export const CARD_NEWS_HIERARCHIES = ["primary", "secondary", "supporting"];
export const CARD_NEWS_TEXT_SOURCES = ["planner", "user"];

const TEXT_FIELD_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "kind",
    "text",
    "renderMode",
    "placement",
    "slotId",
    "hierarchy",
    "maxChars",
    "language",
    "source",
  ],
  properties: {
    id: { type: "string" },
    kind: { type: "string", enum: CARD_NEWS_TEXT_KINDS },
    text: { type: "string" },
    renderMode: { type: "string", enum: CARD_NEWS_RENDER_MODES },
    placement: { type: "string", enum: CARD_NEWS_PLACEMENTS },
    slotId: { type: ["string", "null"] },
    hierarchy: { type: "string", enum: CARD_NEWS_HIERARCHIES },
    maxChars: { type: ["integer", "null"] },
    language: { type: ["string", "null"] },
    source: { type: "string", enum: CARD_NEWS_TEXT_SOURCES },
  },
};

export const CARD_NEWS_PLANNER_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["title", "topic", "cards"],
  properties: {
    title: { type: "string" },
    topic: { type: "string" },
    audience: { type: "string" },
    goal: { type: "string" },
    cards: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["order", "role", "headline", "body", "visualPrompt", "textFields", "references", "locked"],
        properties: {
          order: { type: "integer" },
          role: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          visualPrompt: { type: "string" },
          textFields: { type: "array", items: TEXT_FIELD_SCHEMA },
          references: { type: "array", items: { type: "string" } },
          locked: { type: "boolean" },
        },
      },
    },
  },
};

interface TextFieldRecord {
  id?: unknown;
  kind?: unknown;
  text?: unknown;
  renderMode?: unknown;
  placement?: unknown;
  slotId?: unknown;
  hierarchy?: unknown;
  maxChars?: unknown;
  language?: unknown;
  source?: unknown;
}

interface NormalizedTextField {
  id: string;
  kind: string;
  text: string;
  renderMode: string;
  placement: string;
  slotId: string | null;
  hierarchy: string;
  maxChars: number | null;
  language: string | null;
  source: string;
}

interface CardRecord {
  order?: unknown;
  role?: unknown;
  headline?: unknown;
  body?: unknown;
  visualPrompt?: unknown;
  textFields?: unknown;
  references?: unknown;
  locked?: unknown;
}

interface RoleEntry {
  role: string;
  promptHint?: string;
}

interface RoleTemplate {
  roles: RoleEntry[];
}

interface BriefInput {
  topic?: string;
  title?: string;
  audience?: string;
  goal?: string;
  contentBrief?: string;
  roleTemplate?: RoleTemplate;
}

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function detectBriefLanguage(input: BriefInput = {}): "ko" | "en" | "und" {
  const text = [input.topic, input.audience, input.goal, input.contentBrief].filter(Boolean).join(" ");
  if (/[가-힣]/.test(text)) return "ko";
  if (/[A-Za-z]/.test(text)) return "en";
  return "und";
}

function fallbackCopy(input: BriefInput = {}, kind = "body"): string {
  const lang = detectBriefLanguage(input);
  const topic = asText(input.topic, asText(input.title, "Card news"));
  const goal = asText(input.goal, topic);
  const brief = asText(input.contentBrief, goal);
  if (kind === "headline") return topic;
  if (lang === "ko") return brief || `${topic} 핵심 내용을 정리합니다.`;
  if (lang === "en") return brief || `Summarize the key point for ${topic}.`;
  return brief || topic;
}

function normalizeTextField(field: unknown, index: number): NormalizedTextField | null {
  if (!field || typeof field !== "object") return null;
  const f = field as TextFieldRecord;
  const text = asText(f.text);
  if (!text) return null;
  return {
    id: asText(f.id, `tf_${index + 1}`),
    kind: typeof f.kind === "string" && CARD_NEWS_TEXT_KINDS.includes(f.kind) ? f.kind : "body",
    text,
    renderMode: typeof f.renderMode === "string" && CARD_NEWS_RENDER_MODES.includes(f.renderMode) ? f.renderMode : "in-image",
    placement: typeof f.placement === "string" && CARD_NEWS_PLACEMENTS.includes(f.placement) ? f.placement : "free",
    slotId: typeof f.slotId === "string" && f.slotId.trim() ? f.slotId.trim() : null,
    hierarchy: typeof f.hierarchy === "string" && CARD_NEWS_HIERARCHIES.includes(f.hierarchy) ? f.hierarchy : "supporting",
    maxChars: Number.isInteger(f.maxChars) ? (f.maxChars as number) : null,
    language: typeof f.language === "string" && f.language.trim() ? f.language.trim() : null,
    source: typeof f.source === "string" && CARD_NEWS_TEXT_SOURCES.includes(f.source) ? f.source : "planner",
  };
}

function normalizeTextFields(value: unknown): NormalizedTextField[] {
  if (!Array.isArray(value)) return [];
  return value.map((item, idx) => normalizeTextField(item, idx)).filter((field): field is NormalizedTextField => field !== null);
}

function stripExactVisibleText(visualPrompt: unknown, textFields: NormalizedTextField[]): string {
  let next = asText(visualPrompt);
  for (const field of textFields) {
    const text = asText(field.text);
    if (text.length >= 4 && next.includes(text)) {
      next = next.split(text).join("visible text box");
    }
  }
  return next.trim();
}

function normalizeCard(card: CardRecord | null | undefined, role: RoleEntry, index: number, input: BriefInput) {
  const topic = asText(input.topic, "Card news");
  const textFields = normalizeTextFields(card?.textFields);
  return {
    order: index + 1,
    role: role.role,
    headline: asText(card?.headline, index === 0 ? topic : fallbackCopy(input, "headline")),
    body: asText(card?.body, fallbackCopy(input, "body")),
    visualPrompt: stripExactVisibleText(
      asText(card?.visualPrompt, `${asText(role.promptHint, role.role)}, ${topic}`),
      textFields,
    ),
    textFields,
    references: Array.isArray(card?.references)
      ? (card.references as unknown[]).filter((ref): ref is string => typeof ref === "string")
      : [],
    locked: false,
  };
}

export function repairPlannerOutput(output: unknown, input: BriefInput = {}) {
  const roles = input.roleTemplate?.roles || [];
  const outputCards = (output && typeof output === "object" && Array.isArray((output as { cards?: unknown }).cards))
    ? (output as { cards: CardRecord[] }).cards
    : null;
  const cards = roles.map((role, index) => {
    const original = outputCards ? outputCards[index] : null;
    return normalizeCard(original, role, index, input);
  });
  const out = (output ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    repaired: true,
    errors: [] as string[],
    plan: {
      title: asText(out.title, asText(input.topic, "Untitled card news")),
      topic: asText(out.topic, asText(input.topic, "Untitled card news")),
      audience: asText(out.audience, asText(input.audience)),
      goal: asText(out.goal, asText(input.goal)),
      cards,
    },
  };
}

function validateTextField(field: unknown, path: string, errors: string[]): void {
  if (!field || typeof field !== "object") {
    errors.push(`${path} must be object`);
    return;
  }
  const f = field as TextFieldRecord;
  if (typeof f.id !== "string") errors.push(`${path}.id must be string`);
  if (typeof f.kind !== "string" || !CARD_NEWS_TEXT_KINDS.includes(f.kind)) errors.push(`${path}.kind invalid`);
  if (typeof f.text !== "string") errors.push(`${path}.text must be string`);
  if (typeof f.text === "string" && !f.text.trim()) errors.push(`${path}.text must not be empty`);
  if (typeof f.renderMode !== "string" || !CARD_NEWS_RENDER_MODES.includes(f.renderMode)) errors.push(`${path}.renderMode invalid`);
  if (typeof f.placement !== "string" || !CARD_NEWS_PLACEMENTS.includes(f.placement)) errors.push(`${path}.placement invalid`);
  if (!(typeof f.slotId === "string" || f.slotId === null)) errors.push(`${path}.slotId invalid`);
  if (typeof f.hierarchy !== "string" || !CARD_NEWS_HIERARCHIES.includes(f.hierarchy)) errors.push(`${path}.hierarchy invalid`);
  if (!(Number.isInteger(f.maxChars) || f.maxChars === null)) errors.push(`${path}.maxChars invalid`);
  if (!(typeof f.language === "string" || f.language === null)) errors.push(`${path}.language invalid`);
  if (typeof f.source !== "string" || !CARD_NEWS_TEXT_SOURCES.includes(f.source)) errors.push(`${path}.source invalid`);
}

export function validatePlannerOutput(output: unknown, roleTemplate: RoleTemplate | null | undefined) {
  const errors: string[] = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, repaired: false, errors: ["output must be an object"] };
  }
  const out = output as { title?: unknown; topic?: unknown; cards?: unknown; audience?: unknown; goal?: unknown };
  if (typeof out.title !== "string") errors.push("title must be a string");
  if (typeof out.topic !== "string") errors.push("topic must be a string");
  if (!Array.isArray(out.cards)) errors.push("cards must be an array");

  const roles = roleTemplate?.roles || [];
  if (Array.isArray(out.cards) && out.cards.length !== roles.length) {
    errors.push("cards length must match role template");
  }

  const cards: CardRecord[] = Array.isArray(out.cards) ? (out.cards as CardRecord[]) : [];
  cards.forEach((card, index) => {
    const expected = roles[index];
    if (!card || typeof card !== "object") {
      errors.push(`card ${index + 1} must be an object`);
      return;
    }
    if (card.order !== index + 1) errors.push(`card ${index + 1} order mismatch`);
    if (expected && card.role !== expected.role) errors.push(`card ${index + 1} role mismatch`);
    for (const key of ["headline", "body", "visualPrompt"] as const) {
      if (typeof card[key] !== "string") errors.push(`card ${index + 1} ${key} must be string`);
    }
    if (!Array.isArray(card.textFields)) errors.push(`card ${index + 1} textFields must be array`);
    if (Array.isArray(card.textFields)) {
      card.textFields.forEach((field, fieldIndex) =>
        validateTextField(field, `card ${index + 1} textFields ${fieldIndex + 1}`, errors));
      for (const field of card.textFields as TextFieldRecord[]) {
        if (
          field?.renderMode === "in-image" &&
          typeof field.text === "string" &&
          field.text.trim().length >= 4 &&
          typeof card.visualPrompt === "string" &&
          card.visualPrompt.includes(field.text.trim())
        ) {
          errors.push(`card ${index + 1} visualPrompt must not duplicate exact visible text`);
        }
      }
    }
    if (!Array.isArray(card.references)) errors.push(`card ${index + 1} references must be array`);
    if (card.locked !== false) errors.push(`card ${index + 1} locked must be false`);
  });

  if (errors.length) return { ok: false, repaired: false, errors };
  return {
    ok: true,
    repaired: false,
    errors: [] as string[],
    plan: {
      title: (out.title as string).trim(),
      topic: (out.topic as string).trim(),
      audience: asText(out.audience),
      goal: asText(out.goal),
      cards: cards.map((card) => ({
        order: card.order as number,
        role: card.role as string,
        headline: (card.headline as string).trim(),
        body: (card.body as string).trim(),
        visualPrompt: (card.visualPrompt as string).trim(),
        textFields: normalizeTextFields(card.textFields),
        references: (card.references as unknown[]).filter((ref): ref is string => typeof ref === "string"),
        locked: false,
      })),
    },
  };
}
