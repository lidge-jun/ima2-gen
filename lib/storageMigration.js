import { mkdir, readdir, copyFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
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
  const home = env.IMA2_TEST_HOME || homedir();
  const execPath = env.IMA2_TEST_EXEC_PATH || process.execPath;
  const argv1 = env.IMA2_TEST_ARGV1 || process.argv[1] || "";
  const nodePrefix = dirname(dirname(execPath));
  const prefixes = getGlobalPrefixCandidates({ env, execPath, argv1 });
  const appData = env.APPDATA || join(home, "AppData", "Roaming");

  const candidates = [
    join(ctx.rootDir, "generated"),
    join(appData, "npm", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".npm-global", "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".nvm", "versions", "node", process.version, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".volta", "tools", "image", "packages", PACKAGE_NAME, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".fnm", "node-versions", process.version, "installation", "lib", "node_modules", PACKAGE_NAME, "generated"),
  ];

  for (const prefix of prefixes) {
    candidates.push(join(prefix, "lib", "node_modules", PACKAGE_NAME, "generated"));
    candidates.push(join(prefix, "node_modules", PACKAGE_NAME, "generated"));
  }

  candidates.push(join(nodePrefix, "lib", "node_modules", PACKAGE_NAME, "generated"));
  return Array.from(new Set(candidates.map((p) => resolve(p))));
}

function getGlobalPrefixCandidates({ env, execPath, argv1 }) {
  const prefixes = new Set();
  if (env.npm_config_prefix) prefixes.add(env.npm_config_prefix);
  if (isAbsolute(argv1)) prefixes.add(dirname(dirname(argv1)));
  prefixes.add(dirname(dirname(execPath)));
  addHomebrewPrefix(prefixes, execPath);
  prefixes.add("/opt/homebrew");
  prefixes.add("/usr/local");
  return Array.from(prefixes);
}

function addHomebrewPrefix(prefixes, execPath) {
  const marker = `${sep}Cellar${sep}node`;
  const idx = execPath.indexOf(marker);
  if (idx > 0) prefixes.add(execPath.slice(0, idx));
}
