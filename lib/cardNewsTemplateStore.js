import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, normalize, sep } from "node:path";

const TEMPLATE_ROOT = ["assets", "card-news", "templates"];
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
    size: t.size,
    previewUrl: `/api/cardnews/image-templates/${encodeURIComponent(t.id)}/preview`,
    stylePrompt: t.stylePrompt,
    negativePrompt: t.negativePrompt || "",
    slots: normalizeSlots(t.slots),
    palette: t.palette || [],
    typography: t.typography || null,
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
  return {
    ...parsed,
    slots: normalizeSlots(parsed.slots),
    previewFilename: parsed.previewFilename || "preview.png",
    baseFilename: parsed.baseFilename || "base.png",
    createdBy: "system",
  };
}

export async function listImageTemplates(ctx) {
  const ids = ["clean-report-square", "academy-lesson-square"];
  const templates = [];
  for (const id of ids) {
    templates.push(publicTemplate(await readTemplate(ctx, id)));
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
