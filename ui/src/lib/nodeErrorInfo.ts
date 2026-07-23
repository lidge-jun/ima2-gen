import { errorCodes, resolveErrorSpec, type ImaErrorCode } from "./errorCodes";

export type NodeRetryAction = "retry" | "auth" | "fix-input";

export type NodeErrorInfo = {
  message: string;
  code: ImaErrorCode;
  retryable: boolean;
  action: NodeRetryAction;
  occurredAt: number;
};

/**
 * Inline node-card action per error code (020, wp2 audit blocker #1).
 * Differs from the global ErrorCard CTA: node-local recovery for
 * reload-class failures is a retry, and account/key/quota failures point
 * to auth remediation instead of dismiss.
 */
const AUTH_CODES: readonly ImaErrorCode[] = [
  "AUTH_CHATGPT_EXPIRED",
  "AUTH_API_KEY_INVALID",
  "APIKEY_DISABLED",
  "AGY_QUOTA_EXHAUSTED",
];
const RETRY_EXTRA_CODES: readonly ImaErrorCode[] = ["EMPTY_RESPONSE", "DB_ERROR", "UNKNOWN"];

export function nodeRetryAction(code: ImaErrorCode): NodeRetryAction {
  if (AUTH_CODES.includes(code)) return "auth";
  const cta = errorCodes[code]?.cta;
  if (cta === "reauth") return "auth";
  if (cta === "retry" || cta === "reload" || RETRY_EXTRA_CODES.includes(code)) return "retry";
  return "fix-input";
}

export function buildNodeErrorInfo(err: unknown): NodeErrorInfo {
  const { code, message } = resolveErrorSpec(err);
  const action = nodeRetryAction(code);
  return {
    message,
    code,
    retryable: action === "retry",
    action,
    occurredAt: Date.now(),
  };
}
