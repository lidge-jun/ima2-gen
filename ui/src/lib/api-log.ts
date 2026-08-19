import { jsonFetch } from "./api-core";

export type GenerationRequestLogEntry = {
  id: string;
  requestId: string;
  createdAt: number;
  prompt: string;
  requested: number;
  succeeded: number;
  error: string | null;
  errorMessage?: string | null;
};

export async function getGenerationRequestLog(): Promise<{ items: GenerationRequestLogEntry[] }> {
  return jsonFetch("/api/generation-requests");
}
