import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import type { PinnedHttpTarget } from "./pinnedHttpGet.js";

export interface GrokImageDownloadPolicy {
  trustedProxyOrigin?: string | undefined;
}

export type PinnedImageTarget = PinnedHttpTarget;

// Dated conservative WP05 policy (050/051), not an exhaustive IANA mirror.
const deniedIPv4 = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8], ["10.0.0.0", 8], ["100.64.0.0", 10],
  ["127.0.0.0", 8], ["169.254.0.0", 16], ["172.16.0.0", 12],
  ["192.0.0.0", 24], ["192.0.2.0", 24], ["192.88.99.0", 24],
  ["192.168.0.0", 16], ["198.18.0.0", 15], ["198.51.100.0", 24],
  ["203.0.113.0", 24], ["224.0.0.0", 4], ["240.0.0.0", 4],
] as const) deniedIPv4.addSubnet(network, prefix, "ipv4");

const mappedIPv6 = new BlockList();
mappedIPv6.addSubnet("::ffff:0:0", 96, "ipv6");
const globalIPv6 = new BlockList();
globalIPv6.addSubnet("2000::", 3, "ipv6");
const deniedIPv6 = new BlockList();
for (const [network, prefix] of [
  ["2001::", 23], ["2001:db8::", 32], ["2002::", 16], ["3fff::", 20],
] as const) deniedIPv6.addSubnet(network, prefix, "ipv6");

function policyError(): Error & { status: number; code: string } {
  return Object.assign(new Error("Image download destination is unavailable or disallowed"), {
    status: 502, code: "GROK_IMAGE_DOWNLOAD_FAILED",
  });
}

function isAllowedAddress(address: string, family: 4 | 6): boolean {
  if (family === 4) return !deniedIPv4.check(address, "ipv4");
  // BlockList applies IPv4 CIDRs to mapped IPv6 numerically, in dotted or hex form.
  // Do this BEFORE the native IPv6 global-prefix check; public mapped IPv4 is valid.
  if (mappedIPv6.check(address, "ipv6")) return !deniedIPv4.check(address, "ipv6");
  return globalIPv6.check(address, "ipv6") && !deniedIPv6.check(address, "ipv6");
}

function isTrustedOrigin(url: URL, policy: GrokImageDownloadPolicy): boolean {
  if (!policy.trustedProxyOrigin) return false;
  const trusted = new URL(policy.trustedProxyOrigin);
  return url.origin === trusted.origin;
}

function validateAddresses(
  answers: readonly import("node:dns").LookupAddress[], trusted: boolean,
): PinnedImageTarget["addresses"] {
  if (answers.length === 0) throw policyError();
  const addresses: { address: string; family: 4 | 6 }[] = [];
  for (const { address, family } of answers) {
    if ((family !== 4 && family !== 6) || address.includes("%") || isIP(address) !== family) {
      throw policyError();
    }
    if (!trusted && !isAllowedAddress(address, family)) throw policyError();
    addresses.push({ address, family });
  }
  return addresses;
}

async function lookupWithSignal(
  hostname: string, signal: AbortSignal, order?: "ipv4first",
): Promise<import("node:dns").LookupAddress[]> {
  signal.throwIfAborted();
  let onAbort: () => void = () => {};
  try {
    return await new Promise<import("node:dns").LookupAddress[]>((resolve, reject) => {
      onAbort = () => reject(signal.reason);
      signal.addEventListener("abort", onAbort, { once: true });
      if (signal.aborted) { onAbort(); return; }
      Promise.resolve().then(() => {
        signal.throwIfAborted();
        return lookup(hostname, { all: true, ...(order ? { order } : {}) });
      }).then(resolve, reject); // Consume late fulfillment AND rejection after abort.
    });
  } catch (error) {
    throw error;
  } finally {
    signal.removeEventListener("abort", onAbort);
  }
}

export async function resolveImageDownloadTarget(
  url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal,
): Promise<PinnedImageTarget> {
  try { return await resolveDownloadTarget(url, policy, signal); }
  catch {
    // The wrapper owns public 499/504 mapping; preserve any caller abort reason.
    signal.throwIfAborted();
    throw policyError();
  }
}

/** Same public-address policy, with no trusted-proxy argument. DNS errors remain retryable. */
export async function resolvePublicDownloadTarget(url: URL, signal: AbortSignal, order?: "ipv4first"): Promise<PinnedImageTarget> {
  try { return await resolveDownloadTarget(url, {}, signal, order); }
  catch (error) { signal.throwIfAborted(); throw error; }
}

async function resolveDownloadTarget(
  url: URL, policy: GrokImageDownloadPolicy, signal: AbortSignal, order?: "ipv4first",
): Promise<PinnedImageTarget> {
  try {
    signal.throwIfAborted();
    // Snapshot the destination so caller mutation cannot change it during DNS wait.
    const targetUrl = new URL(url.href);
    const hostname = targetUrl.hostname.replace(/^\[|\]$/g, "");
    if (!hostname || hostname.includes("%") || targetUrl.username || targetUrl.password
      || (targetUrl.protocol !== "https:" && targetUrl.protocol !== "http:")) throw policyError();
    const trusted = isTrustedOrigin(targetUrl, policy);
    if (!trusted && targetUrl.protocol !== "https:") throw policyError();
    const family = isIP(hostname);
    const answers = family === 0
      ? await lookupWithSignal(hostname, signal, order) : [{ address: hostname, family }];
    signal.throwIfAborted();
    const addresses = validateAddresses(answers, trusted);
    signal.throwIfAborted();
    return { url: targetUrl, addresses };
  } catch (error) {
    signal.throwIfAborted();
    throw error;
  }
}
