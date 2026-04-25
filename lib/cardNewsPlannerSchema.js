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

function asText(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function detectBriefLanguage(input = {}) {
  const text = [input.topic, input.audience, input.goal, input.contentBrief].filter(Boolean).join(" ");
  if (/[가-힣]/.test(text)) return "ko";
  if (/[A-Za-z]/.test(text)) return "en";
  return "und";
}

function fallbackCopy(input = {}, kind = "body") {
  const lang = detectBriefLanguage(input);
  const topic = asText(input.topic, asText(input.title, "Card news"));
  const goal = asText(input.goal, topic);
  const brief = asText(input.contentBrief, goal);
  if (kind === "headline") return topic;
  if (lang === "ko") return brief || `${topic} 핵심 내용을 정리합니다.`;
  if (lang === "en") return brief || `Summarize the key point for ${topic}.`;
  return brief || topic;
}

function normalizeTextField(field, index) {
  if (!field || typeof field !== "object") return null;
  const text = asText(field.text);
  if (!text) return null;
  return {
    id: asText(field.id, `tf_${index + 1}`),
    kind: CARD_NEWS_TEXT_KINDS.includes(field.kind) ? field.kind : "body",
    text,
    renderMode: CARD_NEWS_RENDER_MODES.includes(field.renderMode) ? field.renderMode : "in-image",
    placement: CARD_NEWS_PLACEMENTS.includes(field.placement) ? field.placement : "free",
    slotId: typeof field.slotId === "string" && field.slotId.trim() ? field.slotId.trim() : null,
    hierarchy: CARD_NEWS_HIERARCHIES.includes(field.hierarchy) ? field.hierarchy : "supporting",
    maxChars: Number.isInteger(field.maxChars) ? field.maxChars : null,
    language: typeof field.language === "string" && field.language.trim() ? field.language.trim() : null,
    source: CARD_NEWS_TEXT_SOURCES.includes(field.source) ? field.source : "planner",
  };
}

function normalizeTextFields(value) {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeTextField).filter(Boolean);
}

function normalizeCard(card, role, index, input) {
  const topic = asText(input.topic, "Card news");
  return {
    order: index + 1,
    role: role.role,
    headline: asText(card?.headline, index === 0 ? topic : fallbackCopy(input, "headline")),
    body: asText(card?.body, fallbackCopy(input, "body")),
    visualPrompt: asText(card?.visualPrompt, `${asText(role.promptHint, role.role)}, ${topic}`),
    textFields: normalizeTextFields(card?.textFields),
    references: Array.isArray(card?.references)
      ? card.references.filter((ref) => typeof ref === "string")
      : [],
    locked: false,
  };
}

export function repairPlannerOutput(output, input = {}) {
  const roles = input.roleTemplate?.roles || [];
  const cards = roles.map((role, index) => {
    const original = Array.isArray(output?.cards) ? output.cards[index] : null;
    return normalizeCard(original, role, index, input);
  });
  return {
    ok: true,
    repaired: true,
    errors: [],
    plan: {
      title: asText(output?.title, asText(input.topic, "Untitled card news")),
      topic: asText(output?.topic, asText(input.topic, "Untitled card news")),
      audience: asText(output?.audience, asText(input.audience)),
      goal: asText(output?.goal, asText(input.goal)),
      cards,
    },
  };
}

function validateTextField(field, path, errors) {
  if (!field || typeof field !== "object") {
    errors.push(`${path} must be object`);
    return;
  }
  if (typeof field.id !== "string") errors.push(`${path}.id must be string`);
  if (!CARD_NEWS_TEXT_KINDS.includes(field.kind)) errors.push(`${path}.kind invalid`);
  if (typeof field.text !== "string") errors.push(`${path}.text must be string`);
  if (!CARD_NEWS_RENDER_MODES.includes(field.renderMode)) errors.push(`${path}.renderMode invalid`);
  if (!CARD_NEWS_PLACEMENTS.includes(field.placement)) errors.push(`${path}.placement invalid`);
  if (!(typeof field.slotId === "string" || field.slotId === null)) errors.push(`${path}.slotId invalid`);
  if (!CARD_NEWS_HIERARCHIES.includes(field.hierarchy)) errors.push(`${path}.hierarchy invalid`);
  if (!(Number.isInteger(field.maxChars) || field.maxChars === null)) errors.push(`${path}.maxChars invalid`);
  if (!(typeof field.language === "string" || field.language === null)) errors.push(`${path}.language invalid`);
  if (!CARD_NEWS_TEXT_SOURCES.includes(field.source)) errors.push(`${path}.source invalid`);
}

export function validatePlannerOutput(output, roleTemplate) {
  const errors = [];
  if (!output || typeof output !== "object" || Array.isArray(output)) {
    return { ok: false, repaired: false, errors: ["output must be an object"] };
  }
  if (typeof output.title !== "string") errors.push("title must be a string");
  if (typeof output.topic !== "string") errors.push("topic must be a string");
  if (!Array.isArray(output.cards)) errors.push("cards must be an array");

  const roles = roleTemplate?.roles || [];
  if (Array.isArray(output.cards) && output.cards.length !== roles.length) {
    errors.push("cards length must match role template");
  }

  const cards = Array.isArray(output.cards) ? output.cards : [];
  cards.forEach((card, index) => {
    const expected = roles[index];
    if (!card || typeof card !== "object") {
      errors.push(`card ${index + 1} must be an object`);
      return;
    }
    if (card.order !== index + 1) errors.push(`card ${index + 1} order mismatch`);
    if (expected && card.role !== expected.role) errors.push(`card ${index + 1} role mismatch`);
    for (const key of ["headline", "body", "visualPrompt"]) {
      if (typeof card[key] !== "string") errors.push(`card ${index + 1} ${key} must be string`);
    }
    if (!Array.isArray(card.textFields)) errors.push(`card ${index + 1} textFields must be array`);
    if (Array.isArray(card.textFields)) {
      card.textFields.forEach((field, fieldIndex) =>
        validateTextField(field, `card ${index + 1} textFields ${fieldIndex + 1}`, errors));
    }
    if (!Array.isArray(card.references)) errors.push(`card ${index + 1} references must be array`);
    if (card.locked !== false) errors.push(`card ${index + 1} locked must be false`);
  });

  if (errors.length) return { ok: false, repaired: false, errors };
  return {
    ok: true,
    repaired: false,
    errors: [],
    plan: {
      title: output.title.trim(),
      topic: output.topic.trim(),
      audience: asText(output.audience),
      goal: asText(output.goal),
      cards: cards.map((card) => ({
        order: card.order,
        role: card.role,
        headline: card.headline.trim(),
        body: card.body.trim(),
        visualPrompt: card.visualPrompt.trim(),
        textFields: normalizeTextFields(card.textFields),
        references: card.references.filter((ref) => typeof ref === "string"),
        locked: false,
      })),
    },
  };
}
