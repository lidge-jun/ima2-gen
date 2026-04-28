import { mkdir, readdir, copyFile, stat, constants } from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { homedir } from "node:os";

const PACKAGE_NAME = "ima2-gen";
const RECOVERY_DOCS_PATH = "docs/RECOVER_OLD_IMAGES.md";

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
    try {
      await copyFile(src, dst, constants.COPYFILE_EXCL);
      stats.copied += 1;
    } catch (err: any) {
      if (err?.code !== "EEXIST") throw err;
      stats.skippedExisting += 1;
    }
  }
  return stats;
}

function isSameOrInside(child, parent) {
  const a = resolve(child);
  const b = resolve(parent);
  return a === b || a.startsWith(b + sep);
}

export async function migrateGeneratedStorage(ctx, options: any = {}) {
  const targetDir = ctx.config.storage.generatedDir;
  const candidates = options.legacyDirs || await getLegacyGeneratedCandidates(ctx, options.env);
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
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          console.warn("[storage] generated asset migration source skipped:", legacyDir, err.message);
        }
      }
    }
    if (result.copied > 0) console.log(`[storage] migrated ${result.copied} generated assets to ${targetDir}`);
  } catch (err: any) {
    console.warn("[storage] generated asset migration skipped:", err.message);
  }
  return result;
}

export async function getLegacyGeneratedCandidates(ctx, env = process.env) {
  const home = env.IMA2_TEST_HOME || homedir();
  const execPath = env.IMA2_TEST_EXEC_PATH || process.execPath;
  const argv1 = env.IMA2_TEST_ARGV1 || process.argv[1] || "";
  const nodePrefix = dirname(dirname(execPath));
  const prefixes = getGlobalPrefixCandidates({ env, execPath, argv1 });
  const appData = env.APPDATA || join(home, "AppData", "Roaming");
  const localAppData = env.LOCALAPPDATA || join(home, "AppData", "Local");
  const npmCache = env.npm_config_cache || join(home, ".npm");
  const xdgDataHome = env.XDG_DATA_HOME || join(home, ".local", "share");
  const pnpmHome = env.PNPM_HOME || "";
  const nvmHome = env.NVM_HOME || join(appData, "nvm");

  const candidates = [
    join(ctx.rootDir, "generated"),
    join(appData, "npm", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".npm-global", "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".nvm", "versions", "node", process.version, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".volta", "tools", "image", "packages", PACKAGE_NAME, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".fnm", "node-versions", process.version, "installation", "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".bun", "install", "global", "node_modules", PACKAGE_NAME, "generated"),
    join(home, ".config", "yarn", "global", "node_modules", PACKAGE_NAME, "generated"),
    join(localAppData, "Yarn", "Data", "global", "node_modules", PACKAGE_NAME, "generated"),
    join(localAppData, "Volta", "tools", "image", "packages", PACKAGE_NAME, "lib", "node_modules", PACKAGE_NAME, "generated"),
    join(nvmHome, process.version, "node_modules", PACKAGE_NAME, "generated"),
    join(dirname(execPath), "node_modules", PACKAGE_NAME, "generated"),
  ];

  for (const prefix of prefixes) {
    candidates.push(join(prefix, "lib", "node_modules", PACKAGE_NAME, "generated"));
    candidates.push(join(prefix, "node_modules", PACKAGE_NAME, "generated"));
  }

  candidates.push(join(nodePrefix, "lib", "node_modules", PACKAGE_NAME, "generated"));
  candidates.push(
    ...await expandOneLevelCandidates([
      [join(home, ".nvm", "versions", "node"), ["*", "lib", "node_modules", PACKAGE_NAME, "generated"]],
      [join(home, ".fnm", "node-versions"), ["*", "installation", "lib", "node_modules", PACKAGE_NAME, "generated"]],
      [join(home, ".asdf", "installs", "nodejs"), ["*", "lib", "node_modules", PACKAGE_NAME, "generated"]],
      [join(home, ".local", "share", "mise", "installs", "node"), ["*", "lib", "node_modules", PACKAGE_NAME, "generated"]],
      [join(home, "Library", "pnpm", "global"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [join(xdgDataHome, "pnpm", "global"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [join(localAppData, "pnpm", "global"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [pnpmHome ? join(pnpmHome, "global") : "", ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [join(npmCache, "_npx"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [join(localAppData, "npm-cache", "_npx"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [join(appData, "npm-cache", "_npx"), ["*", "node_modules", PACKAGE_NAME, "generated"]],
      [nvmHome, ["*", "node_modules", PACKAGE_NAME, "generated"]],
    ]),
  );
  return uniqueResolvedCandidates(candidates);
}

export async function inspectGeneratedStorage(ctx, options: any = {}) {
  const env = options.env || process.env;
  const targetDir = ctx.config.storage.generatedDir;
  try {
    const candidates = options.legacyDirs || await getLegacyGeneratedCandidates(ctx, env);
    const targetFileCount = await countFiles(targetDir);
    const legacySources = [];

    for (const candidate of candidates) {
      if (isSameOrInside(candidate, targetDir) || isSameOrInside(targetDir, candidate)) continue;
      try {
        const candidateStat = await stat(candidate);
        if (!candidateStat.isDirectory()) continue;
        const fileCount = await countFiles(candidate);
        if (fileCount > 0) legacySources.push({ path: candidate, fileCount });
      } catch (err: any) {
        if (err?.code !== "ENOENT") {
          console.warn("[storage] legacy candidate inspect skipped:", candidate, err.message);
        }
      }
    }

    const legacyFilesFound = legacySources.reduce((sum, source) => sum + source.fileCount, 0);
    const state =
      targetFileCount > 0 ? "ok"
      : legacyFilesFound > 0 ? "recoverable"
      : "not_found";

    return {
      ok: true,
      targetDir,
      generatedDirLabel: labelPath(targetDir, env),
      targetExists: await isDirectory(targetDir),
      targetFileCount,
      legacyCandidatesScanned: candidates.length,
      legacySourcesFound: legacySources.length,
      legacyFilesFound,
      legacySources,
      overrides: {
        generatedDir: Boolean(env.IMA2_GENERATED_DIR),
        configDir: Boolean(env.IMA2_CONFIG_DIR),
      },
      state,
      messageKind: state === "not_found" ? "apology" : state,
      recoveryDocsPath: RECOVERY_DOCS_PATH,
      doctorCommand: "ima2 doctor",
    };
  } catch (err: any) {
    return {
      ok: false,
      targetDir,
      generatedDirLabel: labelPath(targetDir, env),
      targetExists: false,
      targetFileCount: 0,
      legacyCandidatesScanned: 0,
      legacySourcesFound: 0,
      legacyFilesFound: 0,
      legacySources: [],
      overrides: {
        generatedDir: Boolean(env.IMA2_GENERATED_DIR),
        configDir: Boolean(env.IMA2_CONFIG_DIR),
      },
      state: "unknown",
      messageKind: "unknown",
      recoveryDocsPath: RECOVERY_DOCS_PATH,
      doctorCommand: "ima2 doctor",
      error: err?.message || String(err),
    };
  }
}

async function expandOneLevelCandidates(patterns) {
  const candidates = [];
  for (const [baseDir, segments] of patterns) {
    if (!baseDir) continue;
    candidates.push(...await expandOneLevelPattern(baseDir, segments));
  }
  return candidates;
}

async function expandOneLevelPattern(baseDir, segments) {
  const wildcardIndex = segments.indexOf("*");
  if (wildcardIndex < 0) return [join(baseDir, ...segments)];

  const before = segments.slice(0, wildcardIndex);
  const after = segments.slice(wildcardIndex + 1);
  const wildcardBase = join(baseDir, ...before);
  try {
    const entries = await readdir(wildcardBase, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(wildcardBase, entry.name, ...after));
  } catch (err: any) {
    if (err?.code === "ENOENT") return [];
    console.warn("[storage] legacy candidate scan skipped:", wildcardBase, err.message);
    return [];
  }
}

async function countFiles(dir) {
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    let count = 0;
    for (const entry of entries) {
      if (entry.name === ".trash") continue;
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) count += await countFiles(fullPath);
      else if (entry.isFile()) count += 1;
    }
    return count;
  } catch (err: any) {
    if (err?.code === "ENOENT") return 0;
    throw err;
  }
}

async function isDirectory(dir) {
  try {
    return (await stat(dir)).isDirectory();
  } catch {
    return false;
  }
}

function uniqueResolvedCandidates(candidates) {
  return Array.from(new Set(candidates.filter(Boolean).map((p) => resolve(p))));
}

function labelPath(targetPath, env = process.env) {
  const home = env.IMA2_TEST_HOME || homedir();
  const resolved = resolve(targetPath);
  const resolvedHome = resolve(home);
  if (resolved === resolvedHome) return "~";
  if (resolved.startsWith(resolvedHome + sep)) return `~${sep}${resolved.slice(resolvedHome.length + 1)}`;
  return resolved;
}

function getGlobalPrefixCandidates({ env, execPath, argv1 }) {
  const prefixes: Set<string> = new Set();
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
