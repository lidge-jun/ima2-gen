import type {
  BillingResponse,
  GenerateRequest,
  GenerateResponse,
  OAuthStatus,
} from "../types";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    const message =
      (data as { error?: string }).error ?? `Request failed: ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export function getOAuthStatus(): Promise<OAuthStatus> {
  return jsonFetch<OAuthStatus>("/api/oauth/status");
}

export function getBilling(): Promise<BillingResponse> {
  return jsonFetch<BillingResponse>("/api/billing");
}

export function postGenerate(payload: GenerateRequest): Promise<GenerateResponse> {
  return jsonFetch<GenerateResponse>("/api/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export function postEdit(payload: GenerateRequest): Promise<GenerateResponse> {
  return jsonFetch<GenerateResponse>("/api/edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
