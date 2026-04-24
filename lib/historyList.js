import { mkdir, readFile, readdir, stat } from "fs/promises";
import { join } from "path";
import { config } from "../config.js";

async function listImageFiles(baseDir) {
  const out = [];

  async function walk(dir, depth) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name === config.storage.trashDirName) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory() && depth > 0) {
        await walk(full, depth - 1);
      } else if (entry.isFile() && /\.(png|jpe?g|webp)$/i.test(entry.name)) {
        out.push({ full, rel: full.slice(baseDir.length + 1), name: entry.name });
      }
    }
  }

  await walk(baseDir, 2);
  return out;
}

export async function listHistoryRows(baseDir = config.storage.generatedDir) {
  await mkdir(baseDir, { recursive: true });
  const imgs = await listImageFiles(baseDir);
  const rows = await Promise.all(imgs.map(async ({ full, rel, name }) => {
    const st = await stat(full).catch(() => null);
    let meta = null;
    try {
      const raw = await readFile(full + ".json", "utf-8");
      meta = JSON.parse(raw);
    } catch (e) {
      if (e.code !== "ENOENT") console.warn("[history] sidecar parse fail:", rel, e.message);
    }
    return {
      filename: rel,
      url: `/generated/${rel.split("/").map(encodeURIComponent).join("/")}`,
      createdAt: meta?.createdAt || st?.mtimeMs || 0,
      prompt: meta?.prompt || null,
      userPrompt: meta?.userPrompt || meta?.prompt || null,
      revisedPrompt: meta?.revisedPrompt || null,
      promptMode: meta?.promptMode || null,
      quality: meta?.quality || null,
      size: meta?.size || null,
      format: meta?.format || name.split(".").pop(),
      provider: meta?.provider || "oauth",
      usage: meta?.usage || null,
      webSearchCalls: meta?.webSearchCalls || 0,
      sessionId: meta?.sessionId || null,
      nodeId: meta?.nodeId || null,
      parentNodeId: meta?.parentNodeId || null,
      clientNodeId: meta?.clientNodeId || null,
      kind: meta?.kind || null,
    };
  }));

  rows.sort((a, b) => {
    if (b.createdAt !== a.createdAt) return b.createdAt - a.createdAt;
    return b.filename < a.filename ? -1 : b.filename > a.filename ? 1 : 0;
  });

  return rows;
}

