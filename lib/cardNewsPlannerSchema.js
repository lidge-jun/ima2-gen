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
        required: ["order", "role", "headline", "body", "visualPrompt", "references", "locked"],
        properties: {
          order: { type: "integer" },
          role: { type: "string" },
          headline: { type: "string" },
          body: { type: "string" },
          visualPrompt: { type: "string" },
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

function normalizeCard(card, role, index, input) {
  const topic = asText(input.topic, "Card news");
  return {
    order: index + 1,
    role: role.role,
    headline: asText(card?.headline, index === 0 ? topic : role.role),
    body: asText(card?.body, role.promptHint || topic),
    visualPrompt: asText(card?.visualPrompt, `${role.promptHint || role.role}, ${topic}`),
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
        references: card.references.filter((ref) => typeof ref === "string"),
        locked: false,
      })),
    },
  };
}
