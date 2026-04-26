import { create } from "zustand";
import { t } from "../i18n";
import { useAppStore } from "./useAppStore";
import {
  draftCardNews,
  getCardNewsJob,
  getCardNewsSet,
  listCardNewsImageTemplates,
  listCardNewsRoleTemplates,
  normalizeCardNewsCard,
  normalizeCardNewsPlan,
  regenerateCardNewsCard,
  startCardNewsJob,
  type CardNewsCard,
  type CardNewsJobSummary,
  type CardNewsPlannerMeta,
  type CardNewsPlan,
  type CardNewsTextField,
  type ImageTemplate,
  type RoleTemplate,
} from "../lib/cardNewsApi";

type CardNewsOutputSizePreset = "1024x1024" | "2048x2048" | "custom";

type CardNewsState = {
  templates: ImageTemplate[];
  roleTemplates: RoleTemplate[];
  activePlan: CardNewsPlan | null;
  selectedCardId: string | null;
  selectedTextFieldId: string | null;
  topic: string;
  audience: string;
  goal: string;
  contentBrief: string;
  imageTemplateId: string;
  roleTemplateId: string;
  outputSizePreset: CardNewsOutputSizePreset;
  customW: number;
  customH: number;
  loading: boolean;
  generating: boolean;
  error: string | null;
  draftError: string | null;
  plannerMeta: CardNewsPlannerMeta | null;
  hydrate: () => Promise<void>;
  setBriefField: (field: "topic" | "audience" | "goal" | "contentBrief", value: string) => void;
  setImageTemplate: (id: string) => void;
  setRoleTemplate: (id: string) => void;
  setOutputSizePreset: (preset: CardNewsOutputSizePreset) => void;
  setCustomSize: (w: number, h: number) => void;
  draft: () => Promise<void>;
  updateCard: (id: string, patch: Partial<CardNewsCard>) => void;
  updateTextField: (cardId: string, fieldId: string, patch: Partial<CardNewsTextField>) => void;
  addTextField: (cardId: string, field: CardNewsTextField) => void;
  removeTextField: (cardId: string, fieldId: string) => void;
  selectCard: (id: string) => void;
  selectTextField: (fieldId: string | null) => void;
  getGenerationSummary: () => {
    total: number;
    done: number;
    queued: number;
    generating: number;
    errors: number;
    skipped: number;
  };
  generateSet: () => Promise<void>;
  retryCard: (cardId: string) => Promise<void>;
  loadSet: (setId: string) => Promise<void>;
};

function defaultTemplateId(templates: ImageTemplate[]) {
  return templates[0]?.id || "academy-lesson-square";
}

function defaultRoleTemplateId(roleTemplates: RoleTemplate[]) {
  return roleTemplates.find((r) => r.id === "mid-5")?.id || roleTemplates[0]?.id || "mid-5";
}

function snap16(n: number): number {
  return Math.round(n / 16) * 16;
}

function clampSide(n: number): number {
  return Math.min(3824, Math.max(1024, snap16(n)));
}

function resolvedOutputSize(s: CardNewsState): string {
  if (s.outputSizePreset !== "custom") return s.outputSizePreset;
  return `${clampSide(s.customW)}x${clampSide(s.customH)}`;
}

function normalizeCardError(error: unknown): string | undefined {
  if (!error) return undefined;
  if (typeof error === "string") return error;
  if (typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    return typeof message === "string" ? message : undefined;
  }
  return String(error);
}

function mergeGeneratedCard(card: CardNewsCard, generated: CardNewsCard): CardNewsCard {
  const status = generated.status || "generated";
  return {
    ...card,
    ...generated,
    textFields: Array.isArray(generated.textFields) ? generated.textFields : card.textFields,
    status,
    error: status === "error" ? normalizeCardError(generated.error) || t("cardNews.error") : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function applyJobSummary(plan: CardNewsPlan, summary: CardNewsJobSummary): CardNewsPlan {
  const byId = new Map(summary.cards.map((card) => [card.id, card]));
  return {
    ...plan,
    cards: plan.cards.map((card) => {
      const jobCard = byId.get(card.id);
      if (!jobCard) return card;
      return {
        ...card,
        ...jobCard,
        textFields: Array.isArray(jobCard.textFields) ? jobCard.textFields : card.textFields,
        status: jobCard.status || card.status,
        error: normalizeCardError(jobCard.error),
      };
    }),
  };
}

export const useCardNewsStore = create<CardNewsState>((set, get) => ({
  templates: [],
  roleTemplates: [],
  activePlan: null,
  selectedCardId: null,
  selectedTextFieldId: null,
  topic: "",
  audience: "",
  goal: "",
  contentBrief: "",
  imageTemplateId: "academy-lesson-square",
  roleTemplateId: "mid-5",
  outputSizePreset: "2048x2048",
  customW: 2048,
  customH: 2048,
  loading: false,
  generating: false,
  error: null,
  draftError: null,
  plannerMeta: null,

  async hydrate() {
    if (get().loading || get().templates.length > 0) return;
    set({ loading: true, error: null });
    try {
      const [templateRes, roleRes] = await Promise.all([
        listCardNewsImageTemplates(),
        listCardNewsRoleTemplates(),
      ]);
      set({
        templates: templateRes.templates,
        roleTemplates: roleRes.templates,
        imageTemplateId: defaultTemplateId(templateRes.templates),
        roleTemplateId: defaultRoleTemplateId(roleRes.templates),
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },

  setBriefField(field, value) {
    set({ [field]: value } as Pick<CardNewsState, typeof field>);
  },

  setImageTemplate(id) {
    set({ imageTemplateId: id });
  },

  setRoleTemplate(id) {
    set({ roleTemplateId: id });
  },

  setOutputSizePreset(preset) {
    set({ outputSizePreset: preset });
  },

  setCustomSize(w, h) {
    set({ customW: clampSide(w), customH: clampSide(h) });
  },

  async draft() {
    const s = get();
    set({ loading: true, error: null, draftError: null });
    try {
      const { plan, planner } = await draftCardNews({
        topic: s.topic,
        audience: s.audience,
        goal: s.goal,
        contentBrief: s.contentBrief,
        imageTemplateId: s.imageTemplateId,
        roleTemplateId: s.roleTemplateId,
        size: resolvedOutputSize(s),
      });
      set({
        activePlan: normalizeCardNewsPlan(plan),
        selectedCardId: plan.cards[0]?.id || null,
        selectedTextFieldId: null,
        plannerMeta: planner || null,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set({ loading: false, draftError: message, error: message });
    }
  },

  updateCard(id, patch) {
    set((s) => ({
      activePlan: s.activePlan ? {
        ...s.activePlan,
        cards: s.activePlan.cards.map((card) => card.id === id ? { ...card, ...patch } : card),
      } : null,
    }));
  },

  updateTextField(cardId, fieldId, patch) {
    set((s) => ({
      activePlan: s.activePlan ? {
        ...s.activePlan,
        cards: s.activePlan.cards.map((card) => {
          if (card.id !== cardId || card.locked) return card;
          return {
            ...card,
            textFields: card.textFields.map((field) => (
              field.id === fieldId ? { ...field, ...patch, source: patch.source || "user" } : field
            )),
          };
        }),
      } : null,
    }));
  },

  addTextField(cardId, field) {
    set((s) => ({
      activePlan: s.activePlan ? {
        ...s.activePlan,
        cards: s.activePlan.cards.map((card) => (
          card.id === cardId && !card.locked
            ? { ...card, textFields: [...card.textFields, { ...field, source: "user" }] }
            : card
        )),
      } : null,
      selectedTextFieldId: field.id,
    }));
  },

  removeTextField(cardId, fieldId) {
    set((s) => ({
      activePlan: s.activePlan ? {
        ...s.activePlan,
        cards: s.activePlan.cards.map((card) => (
          card.id === cardId && !card.locked
            ? { ...card, textFields: card.textFields.filter((field) => field.id !== fieldId) }
            : card
        )),
      } : null,
      selectedTextFieldId: s.selectedTextFieldId === fieldId ? null : s.selectedTextFieldId,
    }));
  },

  selectCard(id) {
    set({ selectedCardId: id, selectedTextFieldId: null });
  },

  selectTextField(fieldId) {
    set({ selectedTextFieldId: fieldId });
  },

  getGenerationSummary() {
    const cards = get().activePlan?.cards || [];
    return {
      total: cards.length,
      done: cards.filter((card) => card.status === "generated").length,
      queued: cards.filter((card) => card.status === "queued").length,
      generating: cards.filter((card) => card.status === "generating").length,
      errors: cards.filter((card) => card.status === "error").length,
      skipped: cards.filter((card) => card.locked || card.status === "skipped").length,
    };
  },

  async generateSet() {
    const s = get();
    if (!s.activePlan) return;
    const app = useAppStore.getState();
    set({
      generating: true,
      error: null,
      activePlan: {
        ...s.activePlan,
        cards: s.activePlan.cards.map((card) => (
          card.locked ? { ...card, status: "skipped" } : { ...card, status: "queued", error: undefined }
        )),
      },
    });
    try {
      const latest = get().activePlan || s.activePlan;
      const first = await startCardNewsJob({
        ...latest,
        size: resolvedOutputSize(s),
        quality: app.quality,
        moderation: app.moderation,
        model: app.imageModel,
        sessionId: app.activeSessionId,
      });
      let summary = first;
      set((cur) => ({
        activePlan: cur.activePlan ? applyJobSummary(cur.activePlan, summary) : cur.activePlan,
      }));
      while (["queued", "running"].includes(summary.status)) {
        await sleep(900);
        summary = await getCardNewsJob(summary.jobId);
        set((cur) => ({
          activePlan: cur.activePlan ? applyJobSummary(cur.activePlan, summary) : cur.activePlan,
        }));
      }
      const loaded = await getCardNewsSet(summary.setId).catch(() => null);
      set((cur) => ({
        generating: false,
        activePlan: loaded?.plan ? normalizeCardNewsPlan(loaded.plan)
          : (cur.activePlan ? applyJobSummary(cur.activePlan, summary) : cur.activePlan),
        selectedTextFieldId: null,
      }));
      app.showToast(t("cardNews.generated", { count: summary.generated }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((cur) => ({
        generating: false,
        error: message,
        activePlan: cur.activePlan ? {
          ...cur.activePlan,
          cards: cur.activePlan.cards.map((card) => (
            card.status === "queued" || card.status === "generating"
              ? { ...card, status: "error", error: message }
              : card
          )),
        } : cur.activePlan,
      }));
    }
  },

  async retryCard(cardId) {
    const s = get();
    const plan = s.activePlan;
    const card = plan?.cards.find((item) => item.id === cardId);
    if (!plan || !card || card.locked || !["draft", "error"].includes(card.status)) return;
    const app = useAppStore.getState();
    set({
      error: null,
      activePlan: {
        ...plan,
        cards: plan.cards.map((item) => (
          item.id === cardId ? { ...item, status: "generating", error: undefined } : item
        )),
      },
    });
    try {
      const { card: generated } = await regenerateCardNewsCard({
        setId: plan.setId,
        card,
        quality: app.quality,
        moderation: app.moderation,
        model: app.imageModel,
      });
      set((cur) => ({
        activePlan: cur.activePlan ? {
          ...cur.activePlan,
          cards: cur.activePlan.cards.map((item) => (
              item.id === cardId ? mergeGeneratedCard(item, normalizeCardNewsCard(generated)) : item
          )),
        } : cur.activePlan,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      set((cur) => ({
        error: message,
        activePlan: cur.activePlan ? {
          ...cur.activePlan,
          cards: cur.activePlan.cards.map((item) => (
            item.id === cardId ? { ...item, status: "error", error: message } : item
          )),
        } : cur.activePlan,
      }));
    }
  },

  async loadSet(setId) {
    set({ loading: true, error: null, selectedTextFieldId: null });
    try {
      const { plan } = await getCardNewsSet(setId);
      set({
        activePlan: normalizeCardNewsPlan(plan),
        selectedCardId: plan.cards[0]?.id || null,
        selectedTextFieldId: null,
        loading: false,
      });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : String(err) });
    }
  },
}));
