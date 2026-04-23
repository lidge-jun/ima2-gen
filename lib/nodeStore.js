import { writeFile, readFile, access } from "fs/promises";
import { join, resolve, sep } from "path";
import { randomBytes } from "crypto";
import { config } from "../config.js";

const DIR = config.storage.generatedDirName;

export function newNodeId() {
  return "n_" + randomBytes(config.ids.nodeHexBytes).toString("hex");
}

export async function saveNode(rootDir, { nodeId, b64, meta, ext = "png" }) {
  const filename = `${nodeId}.${ext}`;
  await writeFile(join(rootDir, DIR, filename), Buffer.from(b64, "base64"));
  await writeFile(join(rootDir, DIR, filename + ".json"), JSON.stringify(meta, null, 2));
  return { filename };
}

export async function loadNodeB64(rootDir, filename) {
  const p = resolveGeneratedPath(rootDir, filename);
  try { await access(p); } catch {
    const err = new Error(`Node file not found: ${filename}`);
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

export async function loadNodeMeta(rootDir, nodeId, ext = "png") {
  try {
    return JSON.parse(await readFile(join(rootDir, DIR, `${nodeId}.${ext}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export async function loadAssetB64(rootDir, externalSrc) {
  const p = resolveGeneratedPath(rootDir, externalSrc);
  try { await access(p); } catch {
    const err = new Error(`Asset file not found: ${externalSrc}`);
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

function resolveGeneratedPath(rootDir, relPath) {
  if (typeof relPath !== "string" || relPath.length === 0) {
    const err = new Error("Asset path is required");
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  const baseDir = resolve(rootDir, DIR);
  const target = resolve(baseDir, relPath);
  if (target !== baseDir && !target.startsWith(baseDir + sep)) {
    const err = new Error(`Asset path escapes generated/: ${relPath}`);
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  return target;
}
