import type { RouteRuntimeContext } from "./runtimeContext.js";

export interface NaiSubscriptionSnapshot {
  active: boolean;
  tier: number | null;
  battery: { percent: number; isNegative: boolean; timeUntilNextPercentSec: number | null } | null;
  anlas: { fixed: number; purchased: number };
}

const subscriptionTimeoutMs = 5_000;

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function finiteNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function findBattery(root: Record<string, unknown>): NaiSubscriptionSnapshot["battery"] {
  const pending = [root];
  const seen = new Set<object>(pending);
  for (const current of pending) {
    const percent = current === root ? null : finiteNumber(current.percent);
    if (percent !== null) return {
      percent,
      isNegative: current.isNegative === true,
      timeUntilNextPercentSec: finiteNumber(current.timeUntilNextPercent),
    };
    for (const key of Object.keys(current)) {
      // Do not even read identity/credential values while locating a moved meter.
      if (/email|token|^(?:id|user_?id|raw_?body)$/i.test(key)) continue;
      const child = record(current[key]);
      if (child && !seen.has(child)) {
        seen.add(child);
        pending.push(child);
      }
    }
  }
  return null;
}

export function parseNaiSubscription(value: unknown): NaiSubscriptionSnapshot | null {
  const subscription = record(value);
  if (!subscription || typeof subscription.active !== "boolean") return null;
  const anlas = record(subscription.trainingStepsLeft);
  return {
    active: subscription.active,
    tier: finiteNumber(subscription.tier),
    battery: findBattery(subscription),
    anlas: {
      fixed: finiteNumber(anlas?.fixedTrainingStepsLeft) ?? 0,
      purchased: finiteNumber(anlas?.purchasedTrainingSteps) ?? 0,
    },
  };
}

type SubscriptionResult =
  | { ok: true; snapshot: NaiSubscriptionSnapshot }
  | { ok: false; status: 401 | "error" };

export async function fetchNaiSubscription(
  ctx: RouteRuntimeContext,
  opts: { signal?: AbortSignal | undefined; timeoutMs?: number } = {},
): Promise<SubscriptionResult> {
  if (!ctx.naiApiKey) return { ok: false, status: 401 };
  try {
    const timeoutMs = Math.min(subscriptionTimeoutMs, Math.max(0, finiteNumber(opts.timeoutMs) ?? subscriptionTimeoutMs));
    const timeout = AbortSignal.timeout(timeoutMs);
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    signal.throwIfAborted();
    const accountBaseUrl = ctx.config?.naiProvider?.accountBaseUrl;
    if (!accountBaseUrl) return { ok: false, status: "error" };
    const baseUrl = accountBaseUrl.replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/user/subscription`, {
      headers: { Authorization: `Bearer ${ctx.naiApiKey}`, "Content-Type": "application/json" },
      signal,
    });
    if (!response.ok) return { ok: false, status: response.status === 401 ? 401 : "error" };
    const snapshot = parseNaiSubscription(await response.json());
    signal.throwIfAborted();
    return snapshot ? { ok: true, snapshot } : { ok: false, status: "error" };
  } catch {
    // Subscription bodies and errors can contain account identifiers; never log them.
    return { ok: false, status: "error" };
  }
}

export function isNaiBatteryModel(model: string): boolean {
  return model.startsWith("nai-diffusion-5-");
}

export function naiBatteryExhausted(snapshot: NaiSubscriptionSnapshot): boolean {
  return snapshot.battery !== null && (snapshot.battery.isNegative || snapshot.battery.percent <= 0);
}

export function naiAnlasAvailable(snapshot: NaiSubscriptionSnapshot): boolean {
  return snapshot.anlas.fixed + snapshot.anlas.purchased > 0;
}

export function naiError(message: string, status: number, code: string): Error {
  return Object.assign(new Error(message), { status, code, isOperational: true });
}

export async function classifyNai402(
  ctx: RouteRuntimeContext, model: string, detail: string, signal?: AbortSignal,
): Promise<Error> {
  if (isNaiBatteryModel(model)) {
    const result = await fetchNaiSubscription(ctx, { signal, timeoutMs: subscriptionTimeoutMs });
    if (result.ok && result.snapshot.active && naiBatteryExhausted(result.snapshot) && !naiAnlasAvailable(result.snapshot)) {
      return naiError("NovelAI V5 battery exhausted and no Anlas available", 402, "NAI_USAGE_EXHAUSTED");
    }
  }
  return naiError(`NovelAI requires an active subscription: ${detail}`, 402, "NAI_SUBSCRIPTION_REQUIRED");
}
