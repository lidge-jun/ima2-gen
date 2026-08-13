import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const ACTIVE_VIDEO_PROMPT_GUIDANCE = [
  "Active video prompt required.",
  "Describe visual flow, motion flow, sound or no-music intent, dialogue or no-dialogue intent, and the desired ending frame.",
  "Pace the scene to naturally fill the selected duration, expanding even short requests into an opening composition, connected motion/emotion change, and stable ending frame.",
  "Example: From the attached last frame, the subject turns toward camera, rain sound rises, no background music, one whispered line finishes before a still close-up ending.",
].join(" ");

export type VideoContinuityEntry = {
  id: string;
  ordinal: number;
  role: "start" | "ancestor" | "parent" | "current";
  filename: string | null;
  userPrompt: string | null;
  revisedPrompt: string;
  createdAt: number;
};

export type VideoContinuityLineage = {
  lineageId: string;
  parentFilename: string | null;
  sourceFrame: "last" | null;
  maxEntries: 4;
  retention: "keep-start-plus-latest-3";
  entries: VideoContinuityEntry[];
};

type VideoMeta = {
  prompt?: unknown;
  userPrompt?: unknown;
  revisedPrompt?: unknown;
  createdAt?: unknown;
  videoContinuity?: unknown;
};

export function requireActiveVideoPrompt(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function safeGeneratedVideoFilename(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw Object.assign(new Error("video filename required"), { status: 400 });
  const clean = value.replace(/^\/generated\//, "").replace(/^\/+/, "");
  if (clean.includes("..") || clean.includes("/") || clean.includes("\\")) {
    throw Object.assign(new Error("invalid video filename"), { status: 400 });
  }
  if (!/\.mp4$/i.test(clean)) throw Object.assign(new Error("generated video input must be an .mp4 file"), { status: 400 });
  return clean;
}

export async function readVideoSidecar(generatedDir: string, filename: string): Promise<VideoMeta | null> {
  const safe = safeGeneratedVideoFilename(filename);
  let raw: string;
  try {
    raw = await readFile(join(generatedDir, `${safe}.json`), "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null; // no sidecar — legitimate for pre-lineage artifacts
    // EACCES/EISDIR/other present-but-unreadable failures fail closed, same as
    // malformed JSON — silently treating them as "no sidecar" resets lineage.
    throw Object.assign(new Error("parent video metadata is unreadable"), { status: 500, code: "VIDEO_PARENT_METADATA_INVALID" });
  }
  try {
    return JSON.parse(raw) as VideoMeta;
  } catch {
    // Present-but-unreadable sidecar must fail closed: silently treating it as
    // "no sidecar" would reset lineage on explicit-prompt extension.
    throw Object.assign(new Error("parent video metadata is unreadable"), { status: 500, code: "VIDEO_PARENT_METADATA_INVALID" });
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberOrNow(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Date.now();
}

function entryFromMeta(filename: string, meta: VideoMeta | null): VideoContinuityEntry | null {
  const revisedPrompt = stringOrNull(meta?.revisedPrompt) ?? stringOrNull(meta?.prompt);
  if (!revisedPrompt) return null;
  return {
    id: `clip:${filename}`,
    ordinal: 1,
    role: "start",
    filename,
    userPrompt: stringOrNull(meta?.userPrompt) ?? stringOrNull(meta?.prompt),
    revisedPrompt,
    createdAt: numberOrNow(meta?.createdAt),
  };
}

export function normalizeVideoContinuityLineage(value: unknown): VideoContinuityLineage | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<VideoContinuityLineage>;
  if (!Array.isArray(raw.entries)) return null;
  const entries = raw.entries
    .map((entry, index): VideoContinuityEntry | null => {
      if (!entry || typeof entry !== "object") return null;
      const e = entry as Partial<VideoContinuityEntry>;
      const revisedPrompt = stringOrNull(e.revisedPrompt);
      if (!revisedPrompt) return null;
      return {
        id: stringOrNull(e.id) ?? `entry:${index + 1}`,
        ordinal: index + 1,
        role: index === 0 ? "start" : index === raw.entries!.length - 1 ? "parent" : "ancestor",
        filename: stringOrNull(e.filename),
        userPrompt: stringOrNull(e.userPrompt),
        revisedPrompt,
        createdAt: numberOrNow(e.createdAt),
      };
    })
    .filter((entry): entry is VideoContinuityEntry => Boolean(entry));
  if (entries.length === 0) return null;
  return {
    lineageId: stringOrNull(raw.lineageId) ?? `lineage:${entries[0]?.id ?? "unknown"}`,
    parentFilename: stringOrNull(raw.parentFilename),
    sourceFrame: "last",
    maxEntries: 4,
    retention: "keep-start-plus-latest-3",
    entries: trimLineageEntries(entries),
  };
}

export function trimLineageEntries(entries: VideoContinuityEntry[]): VideoContinuityEntry[] {
  const start = entries[0];
  const kept = entries.length <= 4 || !start ? entries : [start, ...entries.slice(-3)];
  return kept.map((entry, index) => ({
    ...entry,
    ordinal: index + 1,
    role: index === 0 ? "start" : index === kept.length - 1 ? (entry?.role ?? "current") : "ancestor",
  }));
}

export function lineageFromVideoMetadata(filename: string, meta: VideoMeta | null): VideoContinuityLineage | null {
  const existing = normalizeVideoContinuityLineage(meta?.videoContinuity);
  if (existing) {
    return { ...existing, parentFilename: filename, sourceFrame: "last" };
  }
  const entry = entryFromMeta(filename, meta);
  if (!entry) return null;
  return {
    lineageId: `lineage:${filename.replace(/\.[^.]+$/, "")}`,
    parentFilename: filename,
    sourceFrame: "last",
    maxEntries: 4,
    retention: "keep-start-plus-latest-3",
    entries: [entry],
  };
}

export function appendVideoContinuityEntry(
  parent: VideoContinuityLineage | null,
  current: { filename: string; userPrompt: string | null; revisedPrompt: string; createdAt?: number },
): VideoContinuityLineage {
  const parentEntries = parent?.entries ?? [];
  const lineageId = parent?.lineageId ?? `lineage:${current.filename.replace(/\.[^.]+$/, "")}`;
  const currentEntry: VideoContinuityEntry = {
    id: `clip:${current.filename}`,
    ordinal: parentEntries.length + 1,
    role: "current",
    filename: current.filename,
    userPrompt: current.userPrompt,
    revisedPrompt: current.revisedPrompt,
    createdAt: current.createdAt ?? Date.now(),
  };
  const entries = trimLineageEntries([...parentEntries.map((entry) => ({ ...entry, role: entry.role === "current" ? "parent" as const : entry.role })), currentEntry]);
  return {
    lineageId,
    parentFilename: parent?.parentFilename ?? null,
    sourceFrame: parent ? "last" : null,
    maxEntries: 4,
    retention: "keep-start-plus-latest-3",
    entries,
  };
}

export function formatVideoContinuityForPlanner(lineage: VideoContinuityLineage | null | undefined): string {
  if (!lineage?.entries?.length) return "";
  const lines = [
    "[Continuity lineage: branch-local, max 4 entries, start anchor preserved]",
    ...lineage.entries.map((entry) => [
      `${entry.ordinal}. Clip ${entry.ordinal} / ${entry.role}`,
      `   file: ${entry.filename ? basename(entry.filename) : "unknown"}`,
      `   revisedPrompt: ${entry.revisedPrompt}`,
      entry.userPrompt ? `   userPrompt: ${entry.userPrompt}` : null,
    ].filter(Boolean).join("\n")),
    "Continue from the final frame and final action/audio state of the latest lineage item. Do not restart the scene.",
  ];
  return lines.join("\n");
}
