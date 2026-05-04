// Shared loose types for the oauthProxy module split.
//
// Behavior parity with the pre-split lib/oauthProxy.ts is the priority during
// Phase 3; strict cleanup is deferred to later phases. The aliases below are
// intentionally `any` so callers do not see signature changes.

export type ImageOptions = any;
export type OAuthCtx = any;
export type Reference = any;
