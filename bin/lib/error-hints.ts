const HINTS = {
  SERVER_UNREACHABLE: "Start `ima2 serve`, or pass `--server <url>`.",
  APIKEY_DISABLED: "API-key generation is supported in current builds; switch providers or update the configured API key.",
  IMAGE_MODEL_UNSUPPORTED:
    "This model is visible but cannot generate images here. Use gpt-5.4 or gpt-5.4-mini.",
  INVALID_IMAGE_MODEL: "Use one of: gpt-5.5, gpt-5.4, gpt-5.4-mini.",
  OAUTH_UNAVAILABLE: "OAuth proxy is unavailable. Check `ima2 doctor` and restart `ima2 serve`.",
  NETWORK_FAILED: "Network/proxy failed. This is not a moderation refusal.",
  SAFETY_REFUSAL: "The image backend refused this generation.",
  MODERATION_REFUSED: "The prompt or image was rejected by moderation.",
  AUTH_CHATGPT_EXPIRED: "Run `npx @openai/codex login`, then restart `ima2 serve`.",
  REF_TOO_LARGE: "Reference image is too large. Resize/compress it and retry.",
  REF_NOT_BASE64: "Reference payload is invalid. Use a normal PNG/JPEG/WebP file.",
};

export function hintForErrorCode(code) {
  return code ? HINTS[code] || null : null;
}

export function formatErrorWithHint(message, code) {
  const hint = hintForErrorCode(code);
  return hint ? `${message}\nHint: ${hint}` : message;
}
