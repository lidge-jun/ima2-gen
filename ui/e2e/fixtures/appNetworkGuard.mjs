import fs from "node:fs";
import net from "node:net";
import tls from "node:tls";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http2 from "node:http2";
import dgram from "node:dgram";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { syncBuiltinESMExports } from "node:module";
import { parsePolicy, isDescendant, safeDenial } from "./appPolicy.mjs";
import { installFilesystemGuard } from "./appFilesystemGuard.mjs";
import { installProcessGuard, createProcessClassifier } from "./appProcessGuard.mjs";

function destination(args) {
  const values = Array.isArray(args[0]) ? args[0] : args;
  const value = values[0];
  if (value && typeof value === "object") {
    if (["path", "socketPath", "fd", "lookup"].some((key) => value[key] != null)) return null;
    if (value.host !== undefined && value.hostname !== undefined && value.host !== value.hostname) return null;
    return { host: value.host ?? value.hostname, port: Number(value.port) };
  }
  if ((typeof value === "number" || (typeof value === "string" && /^\d+$/.test(value))) && typeof values[1] === "string") {
    return { host: values[1], port: Number(value) };
  }
  return null;
}
function literalLoopbackLookup(args, promise) {
  const lanBind = args[0] === "0.0.0.0" && process.env.IMA2_E2E_LAN_BIND === "1"
    && process.env.IMA2_HOST === "0.0.0.0";
  if ((args[0] !== "127.0.0.1" && !lanBind) || args.length > (promise ? 2 : 3)) return null;
  const callback = promise ? null : args.at(-1);
  if (!promise && typeof callback !== "function") return null;
  const options = typeof args[1] === "function" ? undefined : args[1];
  if (options !== undefined && options !== 0 && options !== 4) {
    if (!options || typeof options !== "object" || Array.isArray(options)
      || Object.keys(options).some((key) => !["all", "family"].includes(key))
      || (options.family !== undefined && options.family !== 0 && options.family !== 4)
      || (options.all !== undefined && typeof options.all !== "boolean")) return null;
  }
  return { callback, all: options?.all === true };
}
export function installNetworkGuard(_policy, report, origin = process.env.IMA2_E2E_ALLOWED_ORIGIN) {
  const url = new URL(origin ?? "");
  if (url.origin !== origin || url.protocol !== "http:" || url.hostname !== "127.0.0.1"
    || !url.port || url.port === "3333" || url.username || url.password) throw safeDenial("E2E_POLICY_INVALID");
  const restores = [], patched = new WeakMap();
  const patch = (target, key, transport, tcp = false, lookup = false) => {
    if (patched.get(target)?.has(key)) return;
    const descriptor = Object.getOwnPropertyDescriptor(target, key);
    const original = Reflect.get(target, key);
    if (typeof original !== "function") return;
    const keys = patched.get(target) ?? new Set(); keys.add(key); patched.set(target, keys);
    Object.defineProperty(target, key, { configurable: descriptor?.configurable ?? true,
      enumerable: descriptor?.enumerable ?? false, writable: true, value: function (...args) {
      const literal = lookup ? literalLoopbackLookup(args, target === dnsPromises) : null;
      if (literal) {
        // Node's listen(host) calls lookup even for a numeric address. Return
        // only the fixed IPv4 literal: never call the captured native resolver.
        // Explicit LAN fixtures retain LAN config but cannot bind a public socket.
        const value = { address: "127.0.0.1", family: 4 };
        if (target === dnsPromises) return Promise.resolve(literal.all ? [value] : value);
        process.nextTick(literal.callback, null, ...(literal.all ? [[value]] : [value.address, value.family]));
        return;
      }
      const next = tcp ? destination(args) : null;
      if (next && next.host === "127.0.0.1" && next.port === Number(url.port)) return Reflect.apply(original, this, args);
      report({ type: "ima2-e2e-denied", transport, host: "unowned", port: 0 });
      throw safeDenial("E2E_EGRESS_DENIED", "fixture egress denied");
    } });
    restores.push(() => descriptor ? Object.defineProperty(target, key, descriptor) : Reflect.deleteProperty(target, key));
  };
  try {
    for (const [target, key] of [[net, "connect"], [net, "createConnection"], [net.Socket.prototype, "connect"]]) patch(target, key, "tcp", true);
    patch(tls, "connect", "tls"); patch(tls.TLSSocket.prototype, "connect", "tls");
    patch(http2, "connect", "http2"); patch(dgram, "createSocket", "udp");
    patch(dgram.Socket.prototype, "send", "udp"); patch(dgram.Socket.prototype, "connect", "udp");
    for (const target of [dns, dnsPromises]) {
      for (const key of Object.keys(target)) if (/^(?:lookup|resolve|reverse)/.test(key)) patch(target, key, "dns", false, key === "lookup");
      for (let prototype = target.Resolver.prototype; prototype && prototype !== Object.prototype; prototype = Object.getPrototypeOf(prototype)) {
        for (const key of Object.getOwnPropertyNames(prototype)) if (/^(?:resolve|reverse|lookup)/.test(key)) patch(target.Resolver.prototype, key, "dns");
      }
    }
    patch(globalThis, "WebSocket", "websocket");
    syncBuiltinESMExports();
  } catch (error) { for (const undo of restores.reverse()) undo(); syncBuiltinESMExports(); throw error; }
  let restored = false;
  return () => { if (!restored) { restored = true; for (const undo of restores.reverse()) undo(); syncBuiltinESMExports(); } };
}
function bundledCodexPaths(policy) {
  const manifest = join(policy.root, "node_modules/@openai/codex/package.json");
  try {
    const actual = fs.realpathSync(manifest);
    if (!policy.dependencyRoots.some((root) => isDescendant(actual, root))) return [];
    const value = JSON.parse(fs.readFileSync(actual, "utf8"));
    const bin = typeof value.bin === "string" ? value.bin : value.bin?.codex;
    if (typeof bin !== "string") return [];
    const path = resolve(dirname(actual), bin);
    if (!policy.dependencyRoots.some((root) => isDescendant(path, root))) return [];
    return [...new Set([path, resolve(dirname(manifest), bin)])];
  } catch { return []; }
}
export function installRuntimeGuards(policyValue, report, origin) {
  const policy = parsePolicy(policyValue);
  const classify = createProcessClassifier(policy, bundledCodexPaths(policy));
  const undo = [];
  try {
    undo.push(installFilesystemGuard(policy, report));
    undo.push(installProcessGuard(report, classify));
    undo.push(installNetworkGuard(policy, report, origin));
    report({ type: "ima2-e2e-guard-ready", version: 1 });
  } catch (error) { for (const restore of undo.reverse()) restore(); throw error; }
  let restored = false;
  return () => { if (!restored) { restored = true; for (const restore of undo.reverse()) restore(); } };
}
const self = fileURLToPath(import.meta.url);
const requestedPreload = process.execArgv.some((arg, index, args) =>
  (arg === "--import" && args[index + 1] === self) || arg === "--import=" + self);
if (requestedPreload || process.env.IMA2_E2E_POLICY) {
  const path = process.env.IMA2_E2E_POLICY;
  if (path !== join(process.cwd(), "fixture-policy.json") || typeof process.send !== "function") throw safeDenial("E2E_POLICY_INVALID");
  const metadata = fs.lstatSync(path);
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 65536) throw safeDenial("E2E_POLICY_INVALID");
  const value = JSON.parse(fs.readFileSync(path, "utf8"));
  installRuntimeGuards(value, (record) => {
    if (!process.connected) throw safeDenial("E2E_GUARD_IPC_CLOSED");
    process.send(record, (error) => { if (error) process.exitCode = 1; });
  }, process.env.IMA2_E2E_ALLOWED_ORIGIN);
}
