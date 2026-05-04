import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, join, normalize, sep } from "node:path";

interface TemplateCtx {
  rootDir?: string;
}

interface SlotInput {
  id?: unknown;
  kind?: unknown;
  textKind?: unknown;
  label?: unknown;
  placement?: unknown;
  x?: unknown;
  y?: unknown;
  w?: unknown;
  h?: unknown;
  required?: unknown;
  maxChars?: unknown;
  safeArea?: unknown;
  [k: string]: unknown;
}

interface NormalizedSlot {
  id: string;
  kind: string;
  textKind: string | null;
  label: string;
  placement: string;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  maxChars: number | null;
  safeArea: boolean;
  [k: string]: unknown;
}

interface TemplateRecord {
  id?: string;
  name?: string;
  description?: string;
  size?: string;
  stylePrompt?: string;
  negativePrompt?: string;
  slots?: SlotInput[];
  palette?: unknown[];
  typography?: unknown;
  recommendedOutputSizes?: string[];
  authoringLabel?: string;
  recommendedRoleNodeIds?: string[];
  createdBy?: string;
  previewFilename?: string;
  baseFilename?: string;
  [k: string]: unknown;
}

type TypedError = Error & { status?: number; code?: string };
function makeError(msg: string, status: number, code: string): TypedError {
  const err = new Error(msg) as TypedError;
  err.status = status;
  err.code = code;
  return err;
}

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

function assertSafeId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[a-z0-9][a-z0-9-]{1,80}$/.test(id)) {
    throw makeError("Invalid template id", 400, "CARD_NEWS_BAD_TEMPLATE_ID");
  }
}

function templateDir(ctx: TemplateCtx, templateId: string): string {
  assertSafeId(templateId);
  const root = join(ctx.rootDir ?? process.cwd(), ...TEMPLATE_ROOT);
  const dir = join(root, templateId);
  const normalizedRoot = normalize(root + sep);
  const normalizedDir = normalize(dir + sep);
  if (!normalizedDir.startsWith(normalizedRoot)) {
    throw makeError("Template path escapes root", 400, "CARD_NEWS_BAD_TEMPLATE_PATH");
  }
  return dir;
}

function publicTemplate(t: TemplateRecord) {
  return {
    id: t.id,
    name: t.name,
    description: t.description || "",
    size: t.size,
    previewUrl: `/api/cardnews/image-templates/${encodeURIComponent(t.id ?? "")}/preview`,
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

function normalizeLegacySlotKind(kind: unknown): { kind: string; textKind: string | null } {
  if (kind === "title") return { kind: "text", textKind: "headline" };
  if (kind === "body") return { kind: "text", textKind: "body" };
  if (kind === "cta") return { kind: "text", textKind: "cta" };
  if (kind === "image") return { kind: "image", textKind: null };
  if (kind === "text" || kind === "mixed" || kind === "safe-area") return { kind: kind as string, textKind: null };
  return { kind: "mixed", textKind: null };
}

function normalizeSlot(slot: SlotInput = {}): NormalizedSlot {
  const legacy = normalizeLegacySlotKind(slot.kind);
  return {
    ...slot,
    id: typeof slot.id === "string" && slot.id ? slot.id : "slot",
    kind: legacy.kind,
    textKind: typeof slot.textKind === "string" && slot.textKind ? slot.textKind : (legacy.textKind || null),
    label: typeof slot.label === "string" && slot.label ? slot.label : (typeof slot.id === "string" && slot.id ? slot.id : "slot"),
    placement: typeof slot.placement === "string" && PLACEMENTS.has(slot.placement) ? slot.placement : "free",
    x: Number.isFinite(slot.x) ? (slot.x as number) : 0,
    y: Number.isFinite(slot.y) ? (slot.y as number) : 0,
    w: Number.isFinite(slot.w) ? (slot.w as number) : 100,
    h: Number.isFinite(slot.h) ? (slot.h as number) : 100,
    required: Boolean(slot.required),
    maxChars: Number.isFinite(slot.maxChars) ? (slot.maxChars as number) : null,
    safeArea: Boolean(slot.safeArea),
  };
}

function normalizeSlots(slots: unknown): NormalizedSlot[] {
  return Array.isArray(slots) ? slots.map((s) => normalizeSlot(s as SlotInput)) : [];
}

function registryEntry(templateId: string) {
  return IMAGE_TEMPLATE_REGISTRY.find((entry) => entry.id === templateId);
}

function validateTemplateAuthoring(template: TemplateRecord): void {
  const problems: string[] = [];
  if (typeof template.name !== "string" || !template.name.trim()) problems.push("name");
  if (typeof template.size !== "string" || !OUTPUT_SIZE_RE.test(template.size)) problems.push("size");
  if (typeof template.stylePrompt !== "string" || !template.stylePrompt.trim()) problems.push("stylePrompt");
  if (!Array.isArray(template.slots) || template.slots.length === 0) problems.push("slots");
  const ids = new Set<string>();
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
    throw makeError(`Template authoring metadata invalid: ${problems.join(", ")}`, 500, "CARD_NEWS_TEMPLATE_AUTHORING_INVALID");
  }
}

async function readTemplate(ctx: TemplateCtx, templateId: string): Promise<TemplateRecord> {
  const dir = templateDir(ctx, templateId);
  const raw = await readFile(join(dir, "template.json"), "utf8");
  const parsed = JSON.parse(raw) as TemplateRecord;
  const id = parsed.id || templateId;
  if (id !== templateId) {
    throw makeError("Template id mismatch", 500, "CARD_NEWS_TEMPLATE_ID_MISMATCH");
  }
  const entry = registryEntry(templateId);
  if (!entry) {
    throw makeError("Template is not registered", 500, "CARD_NEWS_TEMPLATE_NOT_REGISTERED");
  }
  validateTemplateAuthoring(parsed);
  return {
    ...parsed,
    authoringLabel: parsed.authoringLabel || entry.label,
    recommendedOutputSizes: parsed.recommendedOutputSizes || entry.recommendedOutputSizes,
    slots: normalizeSlots(parsed.slots) as unknown as SlotInput[],
    previewFilename: parsed.previewFilename || "preview.png",
    baseFilename: parsed.baseFilename || "base.png",
    createdBy: "system",
  };
}

export async function listImageTemplates(ctx: TemplateCtx) {
  const templates: ReturnType<typeof publicTemplate>[] = [];
  for (const entry of IMAGE_TEMPLATE_REGISTRY) {
    templates.push(publicTemplate(await readTemplate(ctx, entry.id)));
  }
  return templates;
}

export async function getImageTemplate(ctx: TemplateCtx, templateId: string) {
  return readTemplate(ctx, templateId);
}

export async function readTemplatePreview(ctx: TemplateCtx, templateId: string) {
  const template = await readTemplate(ctx, templateId);
  const filename = basename(template.previewFilename || "preview.png");
  const path = join(templateDir(ctx, templateId), filename);
  if (!existsSync(path)) {
    throw makeError("Template preview not found", 404, "CARD_NEWS_TEMPLATE_PREVIEW_NOT_FOUND");
  }
  return readFile(path);
}

export async function readTemplateBaseB64(ctx: TemplateCtx, templateId: string) {
  const template = await readTemplate(ctx, templateId);
  const filename = basename(template.baseFilename || "base.png");
  const path = join(templateDir(ctx, templateId), filename);
  if (!existsSync(path)) {
    throw makeError("Template base image not found", 404, "CARD_NEWS_TEMPLATE_BASE_NOT_FOUND");
  }
  const buf = await readFile(path);
  return {
    template,
    templateBase: join(...TEMPLATE_ROOT, templateId, filename),
    b64: buf.toString("base64"),
  };
}
