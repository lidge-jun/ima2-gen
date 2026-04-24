import { mkdir, readdir, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

const PACKAGE_NAME = "ima2-gen";

function addStats(a, b) {
  return {
    copied: a.copied + b.copied,
    skippedExisting: a.skippedExisting + b.skippedExisting,
  };
}

async function copyMissingTree(srcDir, dstDir) {
  await mkdir(dstDir, { recursive: true });
  const entries = await readdir(srcDir, { withFileTypes: true });
  let stats = { copied: 0, skippedExisting: 0 };
  for (const entry of entries) {
    const src = join(srcDir, entry.name);
    const dst = join(dstDir, entry.name);
    if (entry.isDirectory()) {
      stats = addStats(stats, await copyMissingTree(src, dst));
      continue;
    }
    if (!entry.isFile()) continue;
    if (existsSync(dst)) {
      stats.skippedExisting += 1;
      continue;
    }
    await copyFile(src, dst);
    stats.copied += 1;
  }
  return stats;
}

function isSameOrInside(child, parent) {
  const a = resolve(child);
  const b = resolve(parent);
  return a === b || a.startsWith(b + sep);
}

export async function migrateGeneratedStorage(ctx, options = {}) {
  const targetDir = ctx.config.storage.generatedDir;
  const candidates = options.legacyDirs || getLegacyGeneratedCandidates(ctx, options.env);
  const result = {
    copied: 0,
    skippedExisting: 0,
    sourcesScanned: 0,
    sourcesSkipped: 0,
  };
  try {
    for (const legacyDir of candidates) {
      if (isSameOrInside(legacyDir, targetDir) || isSameOrInside(targetDir, legacyDir)) {
        result.sourcesSkipped += 1;
        continue;
      }
      try {
        const legacyStat = await stat(legacyDir);
        if (!legacyStat.isDirectory()) continue;
        result.sourcesScanned += 1;
        const copyStats = await copyMissingTree(legacyDir, targetDir);
        result.copied += copyStats.copied;
        result.skippedExisting += copyStats.skippedExisting;
      } catch (err) {
        if (err?.code !== "ENOENT") {
          console.warn("[storage] generated asset migration source skipped:", legacyDir, err.message);
        }
      }
    }
    if (result.copied > 0) console.log(`[storage] migrated ${result.copied} generated assets to ${targetDir}`);
  } catch (err) {
    console.warn("[storage] generated asset migration skipped:", err.message);
  }
  return result;
}

export function getLegacyGeneratedCandidates(ctx, env = process.env) {
  const home = homedir();
  const nodePrefix = dirname(dirname(process.execPath));
  const npmPrefix = env.npm_config_prefix || nodePrefix;
  const appData = env.APPDATA || join(home, "AppData", "Roaming");
  return Array.from(new Set([
    join(ctx.rootDir, "generated"),
    join(npmPrefix, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(npmPrefix, "node_modules", PACKAGE_NAME, "generated"),
    join(appData, "npm", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".npm-global", "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".nvm", "versions", "node", process.version, "lib", "node_modules", PACKAGE_NAME, "generated"),
  ].map((p) => resolve(p))));
}
