import { create } from "zustand";
import {
  postPromptBuilderChat,
  type PromptBuilderChatRequest,
} from "../lib/api";
import type { GenerateItem } from "../types";
import { t } from "../i18n";

export type PromptBuilderAttachment = {
  id: string;
  kind: "image" | "text" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  text?: string;
};

export type PromptBuilderModel = "gpt-5.5" | "gpt-5.4" | "gpt-5.4-mini" | "gpt-5.6-sol" | "gpt-5.6-terra" | "gpt-5.6-luna";

export type PromptBuilderMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: PromptBuilderAttachment[];
};

export type PromptBuilderScope =
  | { kind: "draft" }
  | { kind: "image"; imageKey: string };

type PromptBuilderState = {
  messages: PromptBuilderMessage[];
  scope: PromptBuilderScope;
  draft: string;
  model: PromptBuilderModel;
  loading: boolean;
  attachments: PromptBuilderAttachment[];
  error: string | null;

  setDraft: (draft: string) => void;
  setModel: (model: PromptBuilderModel) => void;
  clearMessages: () => void;
  clearImageScope: () => void;
  setScopeFromImage: (item: GenerateItem) => void;
  addAttachments: (files: File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  sendMessage: (context: PromptBuilderChatRequest["context"]) => Promise<void>;
};

function getImageKey(item: GenerateItem): string {
  return item.filename ?? item.url ?? item.image;
}

let nextId = 0;
function uid(): string {
  return `pb_${Date.now()}_${++nextId}`;
}

async function fileToAttachment(file: File): Promise<PromptBuilderAttachment> {
  const id = uid();
  const kind = file.type.startsWith("image/") ? "image" as const : "file" as const;
  if (kind === "image") {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error ?? new Error(t("modal.attachmentReadFailed")));
      reader.readAsDataURL(file);
    });
    return { id, kind, name: file.name, mimeType: file.type, size: file.size, dataUrl };
  }
  return { id, kind, name: file.name, mimeType: file.type, size: file.size };
}

export const usePromptBuilderStore = create<PromptBuilderState>()((set, get) => ({
  messages: [],
  scope: { kind: "draft" },
  draft: "",
  model: "gpt-5.6-luna",
  loading: false,
  attachments: [],
  error: null,

  setDraft: (draft) => set({ draft }),
  setModel: (model) => set({ model }),
  clearMessages: () => set({ messages: [], error: null }),
  clearImageScope: () => set({ scope: { kind: "draft" } }),

  setScopeFromImage: (item) => {
    const imageKey = getImageKey(item);
    set({ scope: { kind: "image", imageKey } });
  },

  addAttachments: async (files) => {
    try {
      const items = await Promise.all(files.map(fileToAttachment));
      set((s) => ({ attachments: [...s.attachments, ...items], error: null }));
    } catch {
      set({ error: t("modal.attachmentReadFailed") });
    }
  },

  removeAttachment: (id) => {
    set((s) => ({ attachments: s.attachments.filter((a) => a.id !== id) }));
  },

  sendMessage: async (context) => {
    const { draft, attachments, model, messages } = get();
    const content = draft.trim() || (attachments.length > 0 ? "Use the attached file as context and help with the prompt" : "");
    if (!content && attachments.length === 0) return;

    const userMessage: PromptBuilderMessage = {
      id: uid(),
      role: "user",
      content,
      attachments: attachments.length > 0 ? [...attachments] : undefined,
    };

    set((s) => ({
      messages: [...s.messages, userMessage],
      draft: "",
      attachments: [],
      loading: true,
      error: null,
    }));

    try {
      const apiMessages = [...messages, userMessage].map((m) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments?.map((a) => ({
          kind: a.kind,
          name: a.name,
          mimeType: a.mimeType,
          size: a.size,
          dataUrl: a.dataUrl,
          text: a.text,
        })),
      }));

      const result = await postPromptBuilderChat({
        model,
        messages: apiMessages,
        context,
      });

      const assistantMessage: PromptBuilderMessage = {
        id: uid(),
        role: "assistant",
        content: result.message.content,
      };

      set((s) => ({
        messages: [...s.messages, assistantMessage],
        loading: false,
      }));
    } catch (e) {
      const message = e instanceof Error ? e.message : "Prompt builder request failed";
      set({ loading: false, error: message });
    }
  },
}));
