import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNpmSync } from "./npm-subprocess.mjs";

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function packageNameFromLockPath(lockPath) {
  const marker = "node_modules/";
  const index = lockPath.lastIndexOf(marker);
  if (index < 0) return null;
  const parts = lockPath.slice(index + marker.length).split("/");
  return parts[0]?.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0] || null;
}

export function installScriptEntries(lock, manifest) {
  const entries = [];
  for (const [lockPath, metadata] of Object.entries(lock.packages || {})) {
    if (!lockPath || !metadata?.hasInstallScript) continue;
    const name = packageNameFromLockPath(lockPath);
    if (!name || !metadata.version) continue;
    entries.push({ name, version: metadata.version, key: `${name}@${metadata.version}` });
  }
  // Packages that carry a binding.gyp but no install hook are invisible here:
  // the lockfile records no hasInstallScript, yet npm still treats them as
  // pending because node-gyp could run. better-sqlite3 13 is the live case -
  // it moved to prebuilt binaries. Keeping such an approval readable means
  // honouring it instead of calling it stale, otherwise no manifest satisfies
  // both this check and npm's own pending oracle.
  const known = new Set(entries.map((entry) => entry.name));
  for (const name of Object.keys(manifest?.allowScripts || {})) {
    if (known.has(name) || name.includes("@")) continue;
    const metadata = lock.packages?.[`node_modules/${name}`];
    if (!metadata?.version) continue;
    entries.push({ name, version: metadata.version, key: `${name}@${metadata.version}` });
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function validateInstallPolicy(manifest, lock, label) {
  const errors = [];
  const entries = installScriptEntries(lock, manifest);
  const approvals = manifest.allowScripts || {};
  const required = new Set(entries.map((entry) => entry.key));

  for (const entry of entries) {
    if (approvals[entry.key] !== true && approvals[entry.name] !== true) {
      errors.push(`${label}: missing allowScripts approval for ${entry.key}`);
    }
  }

  for (const [key, value] of Object.entries(approvals)) {
    if (value !== true) continue;
    const matchesExact = required.has(key);
    const matchesName = entries.some((entry) => entry.name === key);
    if (!matchesExact && !matchesName) errors.push(`${label}: stale allowScripts approval ${key}`);
  }

  return errors;
}

export function validateBundleParity(manifest, lock) {
  const manifestBundles = [...(manifest.bundleDependencies || [])].sort();
  const lockBundles = [...(lock.packages?.[""]?.bundleDependencies || [])].sort();
  if (JSON.stringify(manifestBundles) === JSON.stringify(lockBundles)) return [];
  return [
    `bundleDependencies mismatch: package.json=${manifestBundles.join(",")} package-lock.json=${lockBundles.join(",")}`,
  ];
}

export function checkRepositoryInstallPolicy(root = process.cwd()) {
  const manifest = readJson(resolve(root, "package.json"));
  const lock = readJson(resolve(root, "package-lock.json"));
  const uiManifest = readJson(resolve(root, "ui/package.json"));
  const uiLock = readJson(resolve(root, "ui/package-lock.json"));
  return [
    ...validateInstallPolicy(manifest, lock, "root"),
    ...validateInstallPolicy(uiManifest, uiLock, "ui"),
    ...validateBundleParity(manifest, lock),
  ];
}

export function checkNpmPendingApprovals(root = process.cwd()) {
  const errors = [];
  for (const [label, cwd] of [["root", root], ["ui", resolve(root, "ui")]]) {
    const result = spawnNpmSync(["approve-scripts", "--allow-scripts-pending", "--json"], {
      cwd,
      encoding: "utf8",
    });
    if (result.status !== 0) {
      errors.push(`${label}: npm approve-scripts failed: ${result.error?.message || result.stderr || result.stdout}`);
      continue;
    }
    const pending = JSON.parse(result.stdout || "{}").allowScripts || [];
    if (!pending.length) continue;
    // A pending entry the manifest already approves by name is npm and the
    // lockfile disagreeing, not a missing approval. See mergeNpmPendingEntries.
    const manifest = readJson(resolve(cwd, "package.json"));
    const approvals = manifest.allowScripts || {};
    const unapproved = pending.filter((item) => approvals[item.name] !== true);
    if (unapproved.length) errors.push(`${label}: npm reports pending install scripts: ${unapproved.map((item) => item.name).join(",")}`);
  }
  return errors;
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const errors = [
    ...checkRepositoryInstallPolicy(),
    ...(process.argv.includes("--npm-pending") ? checkNpmPendingApprovals() : []),
  ];
  if (errors.length) {
    for (const error of errors) console.error(`[install-policy] ${error}`);
    process.exit(1);
  }
  console.log("[install-policy] root/ui approvals and bundled dependencies are in sync");
}
