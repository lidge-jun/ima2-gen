import { writeFile, readFile, access, mkdir } from "fs/promises";
import { join, resolve, sep } from "path";
import { randomBytes } from "crypto";
import { config } from "../config.js";
import { embedImageMetadataBestEffort } from "./imageMetadataStore.js";

export function newNodeId() {
  return "n_" + randomBytes(config.ids.nodeHexBytes).toString("hex");
}

export async function saveNode(rootDir, { nodeId, b64, meta, ext = "png", generatedDir = config.storage.generatedDir }) {
  void rootDir;
  const filename = `${nodeId}.${ext}`;
  await mkdir(generatedDir, { recursive: true });
  const imageMeta = {
    ...meta,
    kind: meta?.kind || "node",
    nodeId: meta?.nodeId || nodeId,
    format: meta?.format || ext,
  };
  const rawBuffer = Buffer.from(b64, "base64");
  const embedded: any = await embedImageMetadataBestEffort(rawBuffer, ext, imageMeta);
  if (!embedded.embedded) {
    console.warn("[nodeStore] metadata embed skipped:", embedded.warning);
  }
  await writeFile(join(generatedDir, filename), embedded.buffer);
  await writeFile(join(generatedDir, filename + ".json"), JSON.stringify(meta, null, 2));
  return { filename };
}

export async function loadNodeB64(rootDir, filename, generatedDir = config.storage.generatedDir) {
  const p = resolveGeneratedPath(rootDir, filename, generatedDir);
  try { await access(p); } catch {
    const err: any = new Error(`Node file not found: ${filename}`);
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

export async function loadNodeMeta(rootDir, nodeId, ext = "png", generatedDir = config.storage.generatedDir) {
  void rootDir;
  try {
    return JSON.parse(await readFile(join(generatedDir, `${nodeId}.${ext}.json`), "utf-8"));
  } catch {
    return null;
  }
}

export async function loadAssetB64(rootDir, externalSrc, generatedDir = config.storage.generatedDir) {
  const p = resolveGeneratedPath(rootDir, externalSrc, generatedDir);
  try { await access(p); } catch {
    const err: any = new Error(`Asset file not found: ${externalSrc}`);
    err.code = "NODE_NOT_FOUND";
    err.status = 404;
    throw err;
  }
  const buf = await readFile(p);
  return buf.toString("base64");
}

function resolveGeneratedPath(rootDir, relPath, generatedDir = config.storage.generatedDir) {
  void rootDir;
  if (typeof relPath !== "string" || relPath.length === 0) {
    const err: any = new Error("Asset path is required");
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  const baseDir = resolve(generatedDir);
  const target = resolve(baseDir, relPath);
  if (target !== baseDir && !target.startsWith(baseDir + sep)) {
    const err: any = new Error(`Asset path escapes generated/: ${relPath}`);
    err.code = "NODE_SOURCE_INVALID";
    err.status = 400;
    throw err;
  }
  return target;
}
