import { mkdir, readdir, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, sep } from "node:path";

async function copyMissingTree(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      await copyMissingTree(src, dst);
      continue;
    }
    if (!entry.isFile()) continue;
    if (existsSync(dst)) continue;
    await copyFile(src, dst);
  }
}

function isSameOrInside(child, parent) {
  const a = resolve(child);
  const b = resolve(parent);
  return a === b || a.startsWith(b + sep);
}

export async function migrateGeneratedStorage(ctx) {
  const legacyDir = join(ctx.rootDir, "generated");
  const targetDir = ctx.config.storage.generatedDir;
  if (isSameOrInside(legacyDir, targetDir) || isSameOrInside(targetDir, legacyDir)) return;
  try {
    const legacyStat = await stat(legacyDir);
    if (!legacyStat.isDirectory()) return;
    await copyMissingTree(legacyDir, targetDir);
    console.log(`[storage] migrated generated assets to ${targetDir}`);
  } catch (err) {
    if (err?.code !== "ENOENT") {
      console.warn("[storage] generated asset migration skipped:", err.message);
    }
  }
}
