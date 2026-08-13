export type KeyProviderId = "openai" | "xai" | "gemini" | "atlascloud" | "minimax";

export type ProviderVendor = "openai" | "xai" | "google" | "atlascloud" | "minimax";
export type ProviderModelKind = "image" | "video";
export type ProviderReferenceMode = "image" | "edit" | "video";
export type ElementTaxonomy = "gpt" | "gemini" | "grok";

export type ProviderCredential =
  | {
      kind: "api-key";
      keyVocabulary: KeyProviderId;
      envVars: readonly string[];
      keyPrefix?: string;
      validateUrl?: string;
      /**
       * Set when the runtime picks the validation endpoint per request instead
       * of using `validateUrl` verbatim (MiniMax resolves a region-aware host in
       * routes/keys.ts). `validateUrl` is then a documented fallback, not the
       * value actually called.
       */
      validateUrlIsFallback?: boolean;
      configKey?: string;
    }
  | { kind: "oauth-proxy"; envVars: readonly string[]; configKey?: string }
  | { kind: "service-account"; envVars: readonly string[]; configKey?: string }
  | { kind: "local-cli"; envVars: readonly string[]; optionalApiKeyEnv?: string };

export interface CoreProviderModel {
  id: string;
  aliases?: readonly string[];
  kind: ProviderModelKind;
  /**
   * Capabilities as the ACTIVE request path behaves, traced to the route that
   * serves the lane — not to dormant helpers. `mask` is true only when
   * routes/edit.ts lets the lane through to an adapter that accepts a mask.
   */
  supports: { edit: boolean; mask: boolean; streaming: boolean };
}

export interface CoreProviderManifestBase {
  id: string;
  vendor: ProviderVendor;
  credentials: readonly ProviderCredential[];
  models: readonly CoreProviderModel[];
  referenceLimits: Partial<Record<ProviderReferenceMode, number>>;
  elementTaxonomy: ElementTaxonomy | null;
  limits: { timeoutMs: number; maxInputBytes?: number };
  errorPrefix: string | null;
}

export type CoreProviderManifest<Id extends string = string> =
  Omit<CoreProviderManifestBase, "id"> & { id: Id };
