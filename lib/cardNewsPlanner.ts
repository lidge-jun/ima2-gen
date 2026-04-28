import { ulid } from "ulid";
import { getRoleTemplate } from "./cardNewsRoleTemplateStore.js";
import { getImageTemplate } from "./cardNewsTemplateStore.js";
import { buildCardNewsPlannerMessages } from "./cardNewsPlannerPrompt.js";
import { requestCardNewsPlannerJson } from "./cardNewsPlannerClient.js";
import { repairPlannerOutput, validatePlannerOutput } from "./cardNewsPlannerSchema.js";
import { waitForOAuthReady } from "./oauthProxy.js";

function compactText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function detectBriefLanguage(input) {
  const text = [input.topic, input.audience, input.goal, input.contentBrief].filter(Boolean).join(" ");
  if (/[가-힣]/.test(text)) return "ko";
  if (/[A-Za-z]/.test(text)) return "en";
  return "und";
}

function fallbackLabel(role, lang) {
  const ko = {
    cta: "다음 행동",
    problem: "왜 중요한가",
    insight: "핵심 인사이트",
    example: "예시로 보기",
    data: "숫자로 확인",
    summary: "요약",
  };
  const en = {
    cta: "Next action",
    problem: "Why it matters",
    insight: "Key insight",
    example: "Example",
    data: "By the numbers",
    summary: "Summary",
  };
  if (lang === "ko") return ko[role] || role;
  if (lang === "en") return en[role] || role;
  return "";
}

function headlineFor(role, topic, lang) {
  const label = compactText(topic, "Card news");
  if (role === "cover" || role === "hook") return label;
  return fallbackLabel(role, lang) || label;
}

function bodyFor(role, brief, lang) {
  const content = compactText(brief.content, "");
  if (content) return content;
  const target = compactText(brief.audience, lang === "ko" ? "독자" : "reader");
  const goal = compactText(brief.goal, lang === "ko" ? "핵심 메시지" : "the key message");
  if (lang === "ko") {
    if (role === "cta") return `${target}가 바로 실행할 수 있는 다음 단계를 제안합니다.`;
    if (role === "problem") return `${target}가 겪는 문제를 짧고 분명하게 보여줍니다.`;
    if (role === "insight") return `${goal}을 이해하기 쉬운 한 문장으로 정리합니다.`;
    return `${goal}을 카드 역할에 맞춰 전달합니다.`;
  }
  if (role === "cta") return `Suggest a next step ${target} can take immediately.`;
  if (role === "problem") return `Show the problem ${target} faces in a concise way.`;
  if (role === "insight") return `Explain ${goal} in one clear sentence.`;
  return `Present ${goal} for this card.`;
}

function normalizeTextFields(fields) {
  return Array.isArray(fields) ? fields : [];
}

function toCardNewsPlan(plannerOutput, input, roleTemplate) {
  const topic = compactText(plannerOutput.topic, compactText(input.topic, input.title || "Untitled card news"));
  return {
    setId: input.setId || `cs_${ulid()}`,
    title: compactText(plannerOutput.title, topic),
    topic,
    imageTemplateId: input.imageTemplateId || "academy-lesson-square",
    roleTemplateId: roleTemplate.id,
    size: input.size || "2048x2048",
    generationStrategy: "parallel-template-i2i",
    cards: plannerOutput.cards.map((card, index) => ({
      id: `card_${index + 1}`,
      order: index + 1,
      role: card.role,
      headline: card.headline,
      body: card.body,
      visualPrompt: card.visualPrompt,
      textFields: normalizeTextFields(card.textFields),
      templateSlotAssignments: {
        title: "headline",
        body: "body",
        image: "visual",
      },
      references: card.references || [],
      locked: false,
      status: "draft",
    })),
  };
}

export function createDeterministicCardNewsDraft(input: any = {}) {
  const roleTemplate = getRoleTemplate(input.roleTemplateId);
  const topic = compactText(input.topic, input.title || "Untitled card news");
  const title = compactText(input.title, topic);
  const brief = {
    audience: input.audience,
    goal: input.goal,
    content: input.contentBrief,
  };
  const lang = detectBriefLanguage(input);
  const output = {
    title,
    topic,
    audience: compactText(input.audience, ""),
    goal: compactText(input.goal, ""),
    cards: roleTemplate.roles.map((role, idx) => ({
      order: idx + 1,
      role: role.role,
      headline: headlineFor(role.role, topic, lang),
      body: bodyFor(role.role, brief, lang),
      visualPrompt: `${role.promptHint}, ${topic}`,
      textFields: [],
      references: [],
      locked: false,
    })),
  };
  return toCardNewsPlan(output, input, roleTemplate);
}

function plannerError(message, code, status) {
  const err: any = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

export async function createCardNewsDraft(ctxOrInput: any = {}, maybeInput: any = {}) {
  const hasCtx = !!ctxOrInput?.config;
  const ctx = hasCtx ? ctxOrInput : null;
  const input = hasCtx ? maybeInput : ctxOrInput;
  const roleTemplate = getRoleTemplate(input.roleTemplateId);

  if (!ctx) return createDeterministicCardNewsDraft(input);
  if (!ctx.config.cardNewsPlanner?.enabled) {
    return {
      plan: createDeterministicCardNewsDraft(input),
      planner: { mode: "deterministic-fallback", model: "none", repaired: false },
    };
  }

  const imageTemplate = await getImageTemplate(ctx, input.imageTemplateId || "academy-lesson-square");
  try {
    await waitForOAuthReady(ctx);
    const messages = buildCardNewsPlannerMessages({ ...input, roleTemplate, imageTemplate });
    const raw = await requestCardNewsPlannerJson({ messages }, {
      oauthUrl: ctx.oauthUrl,
      model: ctx.config.cardNewsPlanner.model,
      timeoutMs: ctx.config.cardNewsPlanner.timeoutMs,
    });
    let result = validatePlannerOutput(raw.output, roleTemplate);
    if (!result.ok) result = repairPlannerOutput(raw.output, { ...input, roleTemplate });
    if (!result.ok) throw plannerError("Planner schema invalid", "PLANNER_SCHEMA_INVALID", 422);
    return {
      plan: toCardNewsPlan(result.plan, input, roleTemplate),
      planner: { mode: raw.mode, model: raw.model, repaired: result.repaired },
    };
  } catch (err) {
    if (ctx.config.cardNewsPlanner.deterministicFallback) {
      return {
        plan: createDeterministicCardNewsDraft(input),
        planner: {
          mode: "deterministic-fallback",
          model: ctx.config.cardNewsPlanner.model,
          repaired: true,
        },
      };
    }
    if (err.code) throw err;
    throw plannerError(err.message || "Planner unavailable", "PLANNER_UNAVAILABLE", 503);
  }
}
