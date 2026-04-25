import { ulid } from "ulid";
import { getRoleTemplate } from "./cardNewsRoleTemplateStore.js";
import { getImageTemplate } from "./cardNewsTemplateStore.js";
import { buildCardNewsPlannerMessages } from "./cardNewsPlannerPrompt.js";
import { requestCardNewsPlannerJson } from "./cardNewsPlannerClient.js";
import { repairPlannerOutput, validatePlannerOutput } from "./cardNewsPlannerSchema.js";

function compactText(value, fallback) {
  const text = typeof value === "string" ? value.trim() : "";
  return text || fallback;
}

function headlineFor(role, topic) {
  const label = compactText(topic, "Card news");
  if (role === "cover" || role === "hook") return label;
  if (role === "cta") return "다음 행동";
  if (role === "problem") return "왜 중요한가";
  if (role === "insight") return "핵심 인사이트";
  if (role === "example") return "예시로 보기";
  if (role === "data") return "숫자로 확인";
  if (role === "summary") return "요약";
  return role;
}

function bodyFor(role, brief) {
  const target = compactText(brief.audience, "독자");
  const goal = compactText(brief.goal, "핵심 메시지");
  if (role === "cta") return `${target}가 바로 실행할 수 있는 다음 단계를 제안합니다.`;
  if (role === "problem") return `${target}가 겪는 문제를 짧고 분명하게 보여줍니다.`;
  if (role === "insight") return `${goal}을 이해하기 쉬운 한 문장으로 정리합니다.`;
  return compactText(brief.content, `${goal}을 카드 역할에 맞춰 전달합니다.`);
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

export function createDeterministicCardNewsDraft(input = {}) {
  const roleTemplate = getRoleTemplate(input.roleTemplateId);
  const topic = compactText(input.topic, input.title || "Untitled card news");
  const title = compactText(input.title, topic);
  const brief = {
    audience: input.audience,
    goal: input.goal,
    content: input.contentBrief,
  };
  const output = {
    title,
    topic,
    audience: compactText(input.audience, ""),
    goal: compactText(input.goal, ""),
    cards: roleTemplate.roles.map((role, idx) => ({
      order: idx + 1,
      role: role.role,
      headline: headlineFor(role.role, topic),
      body: bodyFor(role.role, brief),
      visualPrompt: `${role.promptHint}, ${topic}`,
      references: [],
      locked: false,
    })),
  };
  return toCardNewsPlan(output, input, roleTemplate);
}

function plannerError(message, code, status) {
  const err = new Error(message);
  err.code = code;
  err.status = status;
  return err;
}

export async function createCardNewsDraft(ctxOrInput = {}, maybeInput = {}) {
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
