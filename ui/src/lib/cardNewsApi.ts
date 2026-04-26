export type CardNewsGenerationStrategy =
  | "parallel-template-i2i"
  | "selected-card-i2i"
  | "sequential-continuity-i2i";

export type CardNewsCardStatus =
  | "draft"
  | "queued"
  | "generating"
  | "generated"
  | "error"
  | "skipped";

export type CardNewsTextPlacement =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center-left"
  | "center"
  | "center-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "free";

export type CardNewsTextKind =
  | "headline"
  | "body"
  | "caption"
  | "cta"
  | "badge"
  | "number";

export type CardNewsRenderMode = "in-image" | "ui-only";
export type CardNewsTextHierarchy = "primary" | "secondary" | "supporting";

export type CardNewsTextField = {
  id: string;
  kind: CardNewsTextKind;
  text: string;
  renderMode: CardNewsRenderMode;
  placement: CardNewsTextPlacement;
  slotId: string | null;
  hierarchy: CardNewsTextHierarchy;
  maxChars: number | null;
  language: string | null;
  source: "planner" | "user";
};

export type CardNewsPlannerMeta = {
  mode: "structured-output" | "json-mode" | "deterministic-fallback";
  model: string;
  repaired: boolean;
};

export type ImageTemplate = {
  id: string;
  name: string;
  description: string;
  size: string;
  previewUrl: string;
  stylePrompt: string;
  negativePrompt?: string;
  slots: ImageTemplateSlot[];
  palette: string[];
  typography: Record<string, unknown> | null;
  recommendedOutputSizes: string[];
  authoringLabel: string;
  recommendedRoleNodeIds: string[];
  createdBy: "system" | "user";
};

export type ImageTemplateSlot = {
  id: string;
  kind: "image" | "text" | "mixed" | "safe-area";
  label: string;
  placement: CardNewsTextPlacement;
  x: number;
  y: number;
  w: number;
  h: number;
  required: boolean;
  textKind: CardNewsTextKind | null;
  maxChars: number | null;
  safeArea: boolean;
};

export type RoleTemplate = {
  id: string;
  name: string;
  defaultCount: number;
  roles: Array<{
    role: string;
    required: boolean;
    promptHint: string;
    preferredSlots: string[];
  }>;
};

export type CardNewsCard = {
  id: string;
  order: number;
  role: string;
  headline: string;
  body: string;
  visualPrompt: string;
  textFields: CardNewsTextField[];
  templateSlotAssignments?: Record<string, string>;
  references: string[];
  locked: boolean;
  status: CardNewsCardStatus;
  error?: string;
  generatedAt?: number;
  imageFilename?: string;
  url?: string;
};

export type CardNewsPlan = {
  setId: string;
  title: string;
  topic: string;
  imageTemplateId: string;
  roleTemplateId: string;
  size: string;
  generationStrategy: CardNewsGenerationStrategy;
  cards: CardNewsCard[];
};

export function normalizeCardNewsCard(card: CardNewsCard): CardNewsCard {
  return {
    ...card,
    textFields: Array.isArray(card.textFields) ? card.textFields : [],
  };
}

export function normalizeCardNewsPlan(plan: CardNewsPlan): CardNewsPlan {
  return {
    ...plan,
    cards: Array.isArray(plan.cards) ? plan.cards.map(normalizeCardNewsCard) : [],
  };
}

export type CardNewsSetSummary = {
  setId: string;
  title: string;
  cardCount: number;
  url?: string;
  cards?: Array<Partial<CardNewsCard>>;
};

export type CardNewsJobStatus = "queued" | "running" | "partial" | "done" | "error";

export type CardNewsJobSummary = {
  jobId: string;
  setId: string;
  status: CardNewsJobStatus;
  total: number;
  generated: number;
  errors: number;
  cards: Array<Partial<CardNewsCard> & {
    id: string;
    order: number;
    status: CardNewsCardStatus;
  }>;
  updatedAt: number;
};

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const raw = data as { error?: { message?: string; code?: string } | string };
    const message =
      typeof raw.error === "string" ? raw.error :
        raw.error?.message || `Request failed: ${res.status}`;
    const err = new Error(message) as Error & { code?: string };
    if (typeof raw.error !== "string") err.code = raw.error?.code;
    throw err;
  }
  return data as T;
}

export function listCardNewsImageTemplates(): Promise<{ templates: ImageTemplate[] }> {
  return jsonFetch("/api/cardnews/image-templates");
}

export function listCardNewsRoleTemplates(): Promise<{ templates: RoleTemplate[] }> {
  return jsonFetch("/api/cardnews/role-templates");
}

export async function draftCardNews(payload: {
  title?: string;
  topic: string;
  audience?: string;
  goal?: string;
  contentBrief?: string;
  imageTemplateId: string;
  roleTemplateId: string;
  size: string;
}): Promise<{ plan: CardNewsPlan; planner?: CardNewsPlannerMeta }> {
  const result = await jsonFetch<{ plan: CardNewsPlan; planner?: CardNewsPlannerMeta }>("/api/cardnews/draft", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { ...result, plan: normalizeCardNewsPlan(result.plan) };
}

export function generateCardNews(payload: CardNewsPlan & {
  quality: string;
  moderation: "low" | "auto";
  model?: string;
  sessionId?: string | null;
}): Promise<{ setId: string; cards: CardNewsCard[]; manifest: Record<string, unknown> }> {
  return jsonFetch("/api/cardnews/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function startCardNewsJob(payload: CardNewsPlan & {
  quality: string;
  moderation: "low" | "auto";
  model?: string;
  sessionId?: string | null;
}): Promise<CardNewsJobSummary> {
  return jsonFetch("/api/cardnews/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function getCardNewsJob(jobId: string): Promise<CardNewsJobSummary> {
  return jsonFetch(`/api/cardnews/jobs/${encodeURIComponent(jobId)}`);
}

export async function regenerateCardNewsCard(payload: {
  setId: string;
  card: CardNewsCard;
  quality: string;
  moderation: "low" | "auto";
  model?: string;
}): Promise<{ card: CardNewsCard }> {
  const result = await jsonFetch<{ setId: string; cards: CardNewsCard[]; manifest: Record<string, unknown> }>(
    `/api/cardnews/cards/${encodeURIComponent(payload.card.id)}/regenerate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        cards: [payload.card],
      }),
    },
  );
  const card = result.cards.find((item) => item.id === payload.card.id);
  if (!card) throw new Error("Regenerated card not found");
  return { card };
}

export function listCardNewsSets(): Promise<{ sets: CardNewsSetSummary[] }> {
  return jsonFetch("/api/cardnews/sets");
}

export function getCardNewsSet(setId: string): Promise<{ plan: CardNewsPlan }> {
  return jsonFetch<{ plan: CardNewsPlan }>(`/api/cardnews/sets/${encodeURIComponent(setId)}`)
    .then((result) => ({ ...result, plan: normalizeCardNewsPlan(result.plan) }));
}
