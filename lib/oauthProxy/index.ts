// Public API barrel for the oauthProxy module split.
// External callers must continue to import from `lib/oauthProxy.js`; the
// thin facade at `lib/oauthProxy.ts` re-exports everything below.

export * from "./types.js";
export {
  REAL_PERSON_RESEARCH_DIRECTIVE,
  AUTO_PROMPT_FIDELITY_SUFFIX,
  DIRECT_PROMPT_FIDELITY_SUFFIX,
  PROMPT_FIDELITY_SUFFIX,
  GENERATE_DEVELOPER_PROMPT,
  GENERATE_NO_SEARCH_DEVELOPER_PROMPT,
  EDIT_DEVELOPER_PROMPT,
  EDIT_NO_SEARCH_DEVELOPER_PROMPT,
  MULTIMODE_DEVELOPER_PROMPT,
  MULTIMODE_NO_SEARCH_DEVELOPER_PROMPT,
  buildUserTextPrompt,
  buildMultimodeSequencePrompt,
  buildEditTextPrompt,
  buildEditResearchTextPrompt,
} from "./prompts.js";
export { parseOpenAIErrorBody } from "./errors.js";
export { waitForOAuthReady } from "./runtime.js";
export {
  generateViaOAuth,
  generateMultimodeViaOAuth,
  editViaOAuth,
} from "./generators.js";
