import { existsSync } from "node:fs";
import { listProviders } from "../../lib/providers/registry.js";
import type { CoreProviderManifest, ProviderCredential } from "../../lib/providers/types.js";
import { homedir } from "node:os";
import { join } from "node:path";
import { detectCodexAuth } from "../../lib/codexDetect.js";
import { config as runtimeConfig } from "../../config.js";
import type { DoctorCheckLine } from "./doctor-checks.js";

export type ProviderDoctorLine = DoctorCheckLine & { lane: string };

function firstEnv(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function configString(fileConfig: Record<string, unknown>, key?: string): string | undefined {
  if (!key) return undefined;
  const value = fileConfig[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function inspectApiKey(lane: string, credential: Extract<ProviderCredential, { kind: "api-key" }>, fileConfig: Record<string, unknown>): ProviderDoctorLine {
  const value = firstEnv(credential.envVars) || configString(fileConfig, credential.configKey);
  if (!value) {
    return { lane, kind: "warn", text: `${lane}: api-key unset` };
  }
  if (credential.keyPrefix && !value.startsWith(credential.keyPrefix)) {
    return { lane, kind: "fail", text: `${lane}: api-key prefix mismatch (expected ${credential.keyPrefix})` };
  }
  if (!credential.keyPrefix) {
    return { lane, kind: "pass", text: `${lane}: api-key present (no prefix check; MiniMax format is region-specific)` };
  }
  return { lane, kind: "pass", text: `${lane}: api-key present` };
}

function inspectOauth(lane: string): ProviderDoctorLine {
  if (lane === "oauth") {
    const auth = detectCodexAuth();
    if (auth.proxyReady) return { lane, kind: "pass", text: `${lane}: file-backed Codex session ready` };
    return { lane, kind: "fail", text: `${lane}: no file-backed Codex session; run ima2 login` };
  }
  if (lane === "grok") {
    const home = homedir();
    const files = [join(home, ".progrok", "auth.json"), join(home, ".grok", "auth.json")];
    if (files.some((path) => existsSync(path))) {
      return { lane, kind: "pass", text: `${lane}: local Grok auth file present` };
    }
    return { lane, kind: "warn", text: `${lane}: no ~/.progrok or ~/.grok auth file` };
  }
  return { lane, kind: "warn", text: `${lane}: oauth-proxy has no lane-specific checker` };
}

function inspectServiceAccount(lane: string, credential: Extract<ProviderCredential, { kind: "service-account" }>, fileConfig: Record<string, unknown>): ProviderDoctorLine {
  const raw = firstEnv(credential.envVars) || configString(fileConfig, credential.configKey);
  if (!raw) return { lane, kind: "warn", text: `${lane}: service-account unset` };
  try {
    const parsed = JSON.parse(raw) as { type?: unknown; project_id?: unknown };
    if (parsed.type !== "service_account" || typeof parsed.project_id !== "string" || !parsed.project_id) {
      return { lane, kind: "fail", text: `${lane}: service-account JSON missing type/project_id` };
    }
    return { lane, kind: "pass", text: `${lane}: service-account JSON present` };
  } catch {
    return { lane, kind: "fail", text: `${lane}: service-account is not JSON` };
  }
}

function inspectLocalCli(lane: string, credential: Extract<ProviderCredential, { kind: "local-cli" }>): ProviderDoctorLine {
  const override = firstEnv(credential.envVars);
  if (override) {
    return existsSync(override)
      ? { lane, kind: "pass", text: `${lane}: local CLI override found` }
      : { lane, kind: "fail", text: `${lane}: local CLI override missing` };
  }
  return { lane, kind: "warn", text: `${lane}: local CLI env unset` };
}

export function inspectProviderLane(provider: CoreProviderManifest, fileConfig: Record<string, unknown>): ProviderDoctorLine[] {
  return provider.credentials.map((credential) => {
    if (credential.kind === "api-key") return inspectApiKey(provider.id, credential, fileConfig);
    if (credential.kind === "oauth-proxy") return inspectOauth(provider.id);
    if (credential.kind === "service-account") return inspectServiceAccount(provider.id, credential, fileConfig);
    return inspectLocalCli(provider.id, credential);
  });
}

export function buildProviderDoctorLines(fileConfig: Record<string, unknown>): ProviderDoctorLine[] {
  return listProviders().flatMap((provider) => inspectProviderLane(provider, fileConfig));
}

export function resolveValidateUrl(credential: Extract<ProviderCredential, { kind: "api-key" }>): string | undefined {
  if (credential.keyVocabulary === "minimax") {
    const cfg = runtimeConfig.minimaxProvider;
    const base = cfg.region === "cn_zh" ? cfg.cnBaseUrl : cfg.globalBaseUrl;
    return `${String(base).replace(/\/$/, "")}/models`;
  }
  return credential.validateUrl;
}

export function listedValidateUrls(): string[] {
  return listProviders().flatMap((provider) => provider.credentials.flatMap((credential) => {
    if (credential.kind !== "api-key") return [];
    const url = resolveValidateUrl(credential);
    return url ? [url] : [];
  }));
}

export async function verifyConfiguredKeys(
  fileConfig: Record<string, unknown>,
  fetchImpl: typeof fetch = fetch,
): Promise<ProviderDoctorLine[]> {
  const lines: ProviderDoctorLine[] = [];
  for (const provider of listProviders()) {
    for (const credential of provider.credentials) {
      if (credential.kind !== "api-key") continue;
      const url = resolveValidateUrl(credential);
      if (!url) continue;
      const value = firstEnv(credential.envVars) || configString(fileConfig, credential.configKey);
      if (!value) continue;
      try {
        const response = await fetchImpl(url, {
          headers: { Authorization: `Bearer ${value}` },
        });
        if (response.ok) {
          lines.push({ lane: provider.id, kind: "pass", text: `${provider.id}: validateUrl ok` });
        } else {
          lines.push({ lane: provider.id, kind: "fail", text: `${provider.id}: AUTH_INVALID (${response.status})` });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        lines.push({ lane: provider.id, kind: "fail", text: `${provider.id}: AUTH_INVALID (${message})` });
      }
    }
  }
  return lines;
}
