import { create } from "zustand";
import {
  getPromptBuilderConfig,
  postPromptBuilderChat,
  putPromptBuilderConfig,
  type PromptBuilderBackend,
  type PromptBuilderChatRequest,
  type PromptBuilderConfigResponse,
} from "../lib/api";
import type { GenerateItem } from "../types";
import { t } from "../i18n";

export type { PromptBuilderBackend } from "../lib/api";

export type PromptBuilderAttachment = {
  id: string;
  kind: "image" | "text" | "file";
  name: string;
  mimeType: string;
  size: number;
  dataUrl?: string;
  text?: string;
};

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
  backend: PromptBuilderBackend;
  model: string;
  modelOptions: string[];
  backendOptions: PromptBuilderBackend[];
  locked: { backend: boolean; model: boolean };
  configLoaded: boolean;
  configLoading: boolean;
  lastBackend: Exclude<PromptBuilderBackend, "auto"> | null;
  loading: boolean;
  attachments: PromptBuilderAttachment[];
  error: string | null;

  setDraft: (draft: string) => void;
  clearMessages: () => void;
  clearImageScope: () => void;
  setScopeFromImage: (item: GenerateItem) => void;
  addAttachments: (files: File[]) => Promise<void>;
  removeAttachment: (id: string) => void;
  loadConfig: () => Promise<void>;
  updateConfig: (backend: PromptBuilderBackend, model?: string) => Promise<void>;
  sendMessage: (context: PromptBuilderChatRequest["context"]) => Promise<void>;
};

const INITIAL_BACKENDS: PromptBuilderBackend[] = [
  "auto", "oauth", "grok", "api", "grok-api",
];

let modelCatalog: PromptBuilderConfigResponse["options"]["models"] = {
  auto: ["auto"],
  oauth: [],
  grok: [],
  api: [],
  "grok-api": [],
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

function configPatch(result: PromptBuilderConfigResponse) {
  modelCatalog = result.options.models;
  return {
    backend: result.backend,
    model: result.model,
    modelOptions: result.options.models[result.backend],
    backendOptions: result.options.backends,
    locked: result.locked,
    configLoaded: true,
    configLoading: false,
    error: null,
  };
}

function configErrorMessage(error: unknown): string {
  const code = error instanceof Error
    ? (error as Error & { code?: string }).code
    : undefined;
  return code === "PROMPT_BUILDER_CONFIG_UNREADABLE"
    ? t("promptBuilder.configUnreadable")
    : t("promptBuilder.failed");
}

function createUserMessage(
  draft: string,
  attachments: PromptBuilderAttachment[],
): PromptBuilderMessage | null {
  const content = draft.trim() || (
    attachments.length > 0 ? t("promptBuilder.attachmentOnlyMessage") : ""
  );
  if (!content && attachments.length === 0) return null;
  return {
    id: uid(),
    role: "user",
    content,
    attachments: attachments.length > 0 ? [...attachments] : undefined,
  };
}

function serializeMessages(messages: PromptBuilderMessage[]) {
  return messages.map((message) => ({
    role: message.role,
    content: message.content,
    attachments: message.attachments?.map((attachment) => ({
      kind: attachment.kind,
      name: attachment.name,
      mimeType: attachment.mimeType,
      size: attachment.size,
      dataUrl: attachment.dataUrl,
      text: attachment.text,
    })),
  }));
}

export const usePromptBuilderStore = create<PromptBuilderState>()((set, get) => ({
  messages: [],
  scope: { kind: "draft" },
  draft: "",
  backend: "auto",
  model: "auto",
  modelOptions: ["auto"],
  backendOptions: INITIAL_BACKENDS,
  locked: { backend: false, model: false },
  configLoaded: false,
  configLoading: false,
  lastBackend: null,
  loading: false,
  attachments: [],
  error: null,

  setDraft: (draft) => set({ draft }),
  clearMessages: () => set({ messages: [], error: null, lastBackend: null }),
  clearImageScope: () => set({ scope: { kind: "draft" } }),

  setScopeFromImage: (item) => {
    set({ scope: { kind: "image", imageKey: getImageKey(item) } });
  },

  addAttachments: async (files) => {
    try {
      const items = await Promise.all(files.map(fileToAttachment));
      set((state) => ({
        attachments: [...state.attachments, ...items],
        error: null,
      }));
    } catch {
      set({ error: t("modal.attachmentReadFailed") });
    }
  },

  removeAttachment: (id) => {
    set((state) => ({
      attachments: state.attachments.filter((attachment) => attachment.id !== id),
    }));
  },

  loadConfig: async () => {
    if (get().configLoaded || get().configLoading) return;
    set({ configLoading: true, error: null });
    try {
      set(configPatch(await getPromptBuilderConfig()));
    } catch (error) {
      set({ configLoading: false, error: configErrorMessage(error) });
    }
  },

  updateConfig: async (backend, model) => {
    const previous = get();
    const nextModel = model ?? (
      backend === previous.backend
        ? previous.model
        : modelCatalog[backend][0] ?? previous.model
    );
    set({
      backend,
      model: nextModel,
      modelOptions: modelCatalog[backend],
      error: null,
    });
    try {
      set(configPatch(await putPromptBuilderConfig({ backend, model: nextModel })));
    } catch (error) {
      set({
        backend: previous.backend,
        model: previous.model,
        modelOptions: previous.modelOptions,
        backendOptions: previous.backendOptions,
        locked: previous.locked,
        error: configErrorMessage(error),
      });
    }
  },

  sendMessage: async (context) => {
    const state = get();
    if (!state.configLoaded) {
      set({ error: t("promptBuilder.configLoading") });
      return;
    }
    const userMessage = createUserMessage(state.draft, state.attachments);
    if (!userMessage) return;
    set((current) => ({
      messages: [...current.messages, userMessage],
      draft: "",
      attachments: [],
      loading: true,
      error: null,
    }));
    try {
      const result = await postPromptBuilderChat({
        backend: state.backend,
        model: state.model,
        messages: serializeMessages([...state.messages, userMessage]),
        context,
      });
      const assistantMessage: PromptBuilderMessage = {
        id: uid(),
        role: "assistant",
        content: result.message.content,
      };
      set((current) => ({
        messages: [...current.messages, assistantMessage],
        loading: false,
        lastBackend: result.backend,
      }));
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : t("promptBuilder.failed");
      set({ loading: false, error: message });
    }
  },
}));
