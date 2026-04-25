import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, normalize, sep } from "node:path";

const TEMPLATE_ROOT = ["assets", "card-news", "templates"];

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
    slots: t.slots,
    palette: t.palette || [],
    typography: t.typography || null,
    recommendedRoleNodeIds: t.recommendedRoleNodeIds || [],
    createdBy: t.createdBy || "system",
  };
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
