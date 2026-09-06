import { createHash } from "node:crypto";

export const RECEIPT_FILE = ".ima2-ui-build-receipt.json";
const OPTION_KEYS = ["mode", "sourcemap", "devUi", "nodeMode", "cardNews", "agentMode"];
const HEX_64 = /^[a-f0-9]{64}$/;

export function receiptError(code) {
  return Object.assign(new Error(code), { code });
}

function record(value, keys) {
  if (!value || typeof value !== "object" || Array.isArray(value)
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw receiptError("UI_RECEIPT_SCHEMA");
  }
  return value;
}

export function isReceiptPath(value) {
  return typeof value === "string" && value.length > 0 && !/[\\\x00-\x1f:]/.test(value)
    && !value.startsWith("/") && value.split("/").every((part) => part && part !== "." && part !== "..");
}

function parseOptions(value) {
  const input = record(value, OPTION_KEYS);
  if (input.mode !== "production" || OPTION_KEYS.slice(1).some((key) => typeof input[key] !== "boolean")) {
    throw receiptError("UI_RECEIPT_SCHEMA");
  }
  return Object.fromEntries(OPTION_KEYS.map((key) => [key, input[key]]));
}

function parseOutputs(value) {
  if (!Array.isArray(value) || value.length === 0) throw receiptError("UI_RECEIPT_SCHEMA");
  const seen = new Set();
  let previous = "";
  return value.map((entry) => {
    const file = record(entry, ["path", "bytes", "sha256"]);
    const folded = typeof file.path === "string" ? file.path.toLowerCase() : "";
    if (!isReceiptPath(file.path) || file.path === RECEIPT_FILE || file.path <= previous
      || seen.has(folded) || !Number.isSafeInteger(file.bytes) || file.bytes < 0
      || typeof file.sha256 !== "string" || !HEX_64.test(file.sha256)) throw receiptError("UI_RECEIPT_SCHEMA");
    previous = file.path; seen.add(folded);
    return { path: file.path, bytes: file.bytes, sha256: file.sha256 };
  });
}

export function parseUiBuildReceipt(value) {
  const input = record(value, ["schemaVersion", "headSha", "sourceInputDigest", "buildOptions", "outputs"]);
  if (input.schemaVersion !== 1 || (input.headSha !== null
      && (typeof input.headSha !== "string" || !/^[a-f0-9]{40}$/.test(input.headSha)))
    || typeof input.sourceInputDigest !== "string" || !HEX_64.test(input.sourceInputDigest)) {
    throw receiptError("UI_RECEIPT_SCHEMA");
  }
  return { schemaVersion: 1, headSha: input.headSha, sourceInputDigest: input.sourceInputDigest,
    buildOptions: parseOptions(input.buildOptions), outputs: parseOutputs(input.outputs) };
}

export function sourceInputDigest(files, options) {
  const entries = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
    .map(({ path, bytes, sha256 }) => [path, bytes, sha256]);
  const flags = OPTION_KEYS.map((key) => options[key]);
  return createHash("sha256").update(JSON.stringify([1, flags, entries])).digest("hex");
}

export function assertUiReceiptBinding(receipt, current, outputs, requireGitHead) {
  if ((requireGitHead && (!current.headSha || !receipt.headSha))
    || (current.headSha && receipt.headSha !== current.headSha)) throw receiptError("UI_RECEIPT_HEAD");
  if (receipt.sourceInputDigest !== current.sourceInputDigest
    || OPTION_KEYS.some((key) => receipt.buildOptions[key] !== current.buildOptions[key])) {
    throw receiptError("UI_RECEIPT_SOURCE");
  }
  if (receipt.outputs.length !== outputs.length || receipt.outputs.some((file, i) => {
    const actual = outputs[i];
    return !actual || file.path !== actual.path || file.bytes !== actual.bytes || file.sha256 !== actual.sha256;
  })) throw receiptError("UI_RECEIPT_OUTPUT");
  return current.headSha ? "git-and-source" : "source-digest";
}
