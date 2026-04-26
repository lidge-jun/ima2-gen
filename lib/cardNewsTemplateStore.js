import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, normalize, sep } from "node:path";

const TEMPLATE_ROOT = ["assets", "card-news", "templates"];
const IMAGE_TEMPLATE_REGISTRY = [
  {
    id: "clean-report-square",
    label: "Clean editorial report",
    recommendedOutputSizes: ["1024x1024", "2048x2048"],
  },
  {
    id: "academy-lesson-square",
    label: "Academy lesson carousel",
    recommendedOutputSizes: ["1024x1024", "2048x2048"],
  },
];
const OUTPUT_SIZE_RE = /^(1024|2048|[1-3][0-9]{3})x(1024|2048|[1-3][0-9]{3})$/;
const PLACEMENTS = new Set([
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
]);

function assertSafeId(id) {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) {
    const err = new Error("Invalid template id");
    err.status = 400;
    err.code = "CARD_NEWS_BAD_TEMPLATE_ID";
    throw err;
  }
}

function templateDir(ctx, templateId) {
  assertSafeId(templateId);
  const root = join(ctx.rootDir, ...TEMPLATE_ROOT);
  const dir = join(root, templateId);
  const normalizedRoot = normalize(root + sep);
  const normalizedDir = normalize(dir + sep);
  if (!normalizedDir.startsWith(normalizedRoot)) {
    const err = new Error("Template path escapes root");
    err.status = 400;
    err.code = "CARD_NEWS_BAD_TEMPLATE_PATH";
    throw err;
  }
  return dir;
}

function publicTemplate(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description || "",
    size: t.size,
    previewUrl: `/api/cardnews/image-templates/${encodeURIComponent(t.id)}/preview`,
    stylePrompt: t.stylePrompt,
    negativePrompt: t.negativePrompt || "",
    slots: normalizeSlots(t.slots),
    palette: t.palette || [],
    typography: t.typography || null,
    recommendedOutputSizes: Array.isArray(t.recommendedOutputSizes) ? t.recommendedOutputSizes : [],
    authoringLabel: t.authoringLabel || t.name,
    recommendedRoleNodeIds: t.recommendedRoleNodeIds || [],
    createdBy: t.createdBy || "system",
  };
}

function normalizeLegacySlotKind(kind) {
  if (kind === "title") return { kind: "text", textKind: "headline" };
  if (kind === "body") return { kind: "text", textKind: "body" };
  if (kind === "cta") return { kind: "text", textKind: "cta" };
  if (kind === "image") return { kind: "image", textKind: null };
  if (kind === "text" || kind === "mixed" || kind === "safe-area") return { kind, textKind: null };
  return { kind: "mixed", textKind: null };
}

function normalizeSlot(slot = {}) {
  const legacy = normalizeLegacySlotKind(slot.kind);
  return {
    ...slot,
    id: typeof slot.id === "string" && slot.id ? slot.id : "slot",
    kind: legacy.kind,
    textKind: slot.textKind || legacy.textKind || null,
    label: typeof slot.label === "string" && slot.label ? slot.label : (slot.id || "slot"),
    placement: PLACEMENTS.has(slot.placement) ? slot.placement : "free",
    x: Number.isFinite(slot.x) ? slot.x : 0,
    y: Number.isFinite(slot.y) ? slot.y : 0,
    w: Number.isFinite(slot.w) ? slot.w : 100,
    h: Number.isFinite(slot.h) ? slot.h : 100,
    required: Boolean(slot.required),
    maxChars: Number.isFinite(slot.maxChars) ? slot.maxChars : null,
    safeArea: Boolean(slot.safeArea),
  };
}

function normalizeSlots(slots) {
  return Array.isArray(slots) ? slots.map(normalizeSlot) : [];
}

function registryEntry(templateId) {
  return IMAGE_TEMPLATE_REGISTRY.find((entry) => entry.id === templateId);
}

function validateTemplateAuthoring(template) {
  const problems = [];
  if (typeof template.name !== "string" || !template.name.trim()) problems.push("name");
  if (typeof template.size !== "string" || !OUTPUT_SIZE_RE.test(template.size)) problems.push("size");
  if (typeof template.stylePrompt !== "string" || !template.stylePrompt.trim()) problems.push("stylePrompt");
  if (!Array.isArray(template.slots) || template.slots.length === 0) problems.push("slots");
  const ids = new Set();
  for (const slot of normalizeSlots(template.slots)) {
    if (ids.has(slot.id)) problems.push(`duplicate slot ${slot.id}`);
    ids.add(slot.id);
    if (!PLACEMENTS.has(slot.placement)) problems.push(`slot ${slot.id} placement`);
    if ((slot.kind === "text" || slot.textKind) && !slot.maxChars) problems.push(`slot ${slot.id} maxChars`);
  }
  if (
    template.recommendedOutputSizes &&
    (!Array.isArray(template.recommendedOutputSizes) ||
      template.recommendedOutputSizes.some((size) => typeof size !== "string" || !OUTPUT_SIZE_RE.test(size)))
  ) {
    problems.push("recommendedOutputSizes");
  }
  if (problems.length) {
    const err = new Error(`Template authoring metadata invalid: ${problems.join(", ")}`);
    err.status = 500;
    err.code = "CARD_NEWS_TEMPLATE_AUTHORING_INVALID";
    throw err;
  }
}

async function readTemplate(ctx, templateId) {
  const dir = templateDir(ctx, templateId);
  const raw = await readFile(join(dir, "template.json"), "utf8");
  const parsed = JSON.parse(raw);
  const id = parsed.id || templateId;
  if (id !== templateId) {
    const err = new Error("Template id mismatch");
    err.status = 500;
    err.code = "CARD_NEWS_TEMPLATE_ID_MISMATCH";
    throw err;
  }
  const entry = registryEntry(templateId);
  if (!entry) {
    const err = new Error("Template is not registered");
    err.status = 500;
    err.code = "CARD_NEWS_TEMPLATE_NOT_REGISTERED";
    throw err;
  }
  validateTemplateAuthoring(parsed);
  return {
    ...parsed,
    authoringLabel: parsed.authoringLabel || entry.label,
    recommendedOutputSizes: parsed.recommendedOutputSizes || entry.recommendedOutputSizes,
    slots: normalizeSlots(parsed.slots),
    previewFilename: parsed.previewFilename || "preview.png",
    baseFilename: parsed.baseFilename || "base.png",
    createdBy: "system",
  };
}

export async function listImageTemplates(ctx) {
  const templates = [];
  for (const entry of IMAGE_TEMPLATE_REGISTRY) {
    templates.push(publicTemplate(await readTemplate(ctx, entry.id)));
  }
  return templates;
}

export async function getImageTemplate(ctx, templateId) {
  return readTemplate(ctx, templateId);
}

export async function readTemplatePreview(ctx, templateId) {
  const template = await readTemplate(ctx, templateId);
  const filename = basename(template.previewFilename || "preview.png");
  const path = join(templateDir(ctx, templateId), filename);
  if (!existsSync(path)) {
    const err = new Error("Template preview not found");
    err.status = 404;
    err.code = "CARD_NEWS_TEMPLATE_PREVIEW_NOT_FOUND";
    throw err;
  }
  return readFile(path);
}

export async function readTemplateBaseB64(ctx, templateId) {
  const template = await readTemplate(ctx, templateId);
  const filename = basename(template.baseFilename || "base.png");
  const path = join(templateDir(ctx, templateId), filename);
  if (!existsSync(path)) {
    const err = new Error("Template base image not found");
    err.status = 404;
    err.code = "CARD_NEWS_TEMPLATE_BASE_NOT_FOUND";
    throw err;
  }
  const buf = await readFile(path);
  return {
    template,
    templateBase: join(...TEMPLATE_ROOT, templateId, filename),
    b64: buf.toString("base64"),
  };
}
