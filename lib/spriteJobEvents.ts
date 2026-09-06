import type { Response } from "express";
import { publish } from "./eventBus.js";
import { writeSse } from "./routeHelpers.js";
import { publishJobEvent } from "./ssePublish.js";
export type SpriteJobEventName = "phase" | "row" | "partial" | "image" | "error" | "done";
export interface SpriteJobEmitter { emit(event: SpriteJobEventName, data: Record<string, unknown>): boolean; end(): void }
export function createSpriteJobEmitter(res: Response, requestId: string): SpriteJobEmitter {
  return {
    emit(event, data) {
      const wrote = !res.writableEnded ? writeSse(res, event, data) : false;
      if (event !== "done" && event !== "error") {
        publish(requestId, event, data);
        return true;
      }
      // Direct legacy SSE keeps its nested error. The shared envelope reads flat fields.
      const nested = data.error;
      const error = nested && typeof nested === "object" && !Array.isArray(nested)
        ? nested as Record<string, unknown> : null;
      const payload = event === "error" && error ? { ...data,
        code: error.code, error: error.message } : data;
      return publishJobEvent(requestId, event, payload) || wrote;
    },
    end() { if (!res.writableEnded) res.end(); },
  };
}
