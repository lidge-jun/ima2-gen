import { existsSync, readFileSync } from "node:fs";
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

export function installScriptEntries(lock, extraNames = []) {
  const entries = [];
  for (const [lockPath, metadata] of Object.entries(lock.packages || {})) {
    if (!lockPath || !metadata?.hasInstallScript) continue;
    const name = packageNameFromLockPath(lockPath);
    if (!name || !metadata.version) continue;
    entries.push({ name, version: metadata.version, key: `${name}@${metadata.version}` });
  }
  // npm sees install scripts the lockfile does not record. A package shipping a
  // binding.gyp without an install hook - better-sqlite3 13, which moved to
  // prebuilt binaries - gets no hasInstallScript entry, yet npm still lists it
  // as pending because node-gyp could run. Approving it would then read as
  // stale here while omitting it reads as unapproved to npm, so no manifest
  // could satisfy both. Callers pass npm's own pending names to close that gap;
  // nothing is inferred from the manifest, so an approval still has to be
  // backed by one of the two oracles.
  const known = new Set(entries.map((entry) => entry.name));
  for (const name of extraNames) {
    if (known.has(name)) continue;
    const metadata = lock.packages?.[`node_modules/${name}`];
    if (!metadata?.version) continue;
    entries.push({ name, version: metadata.version, key: `${name}@${metadata.version}` });
  }
  return entries.sort((a, b) => a.key.localeCompare(b.key));
}

export function validateInstallPolicy(manifest, lock, label, npmPendingNames = []) {
  const errors = [];
  const entries = installScriptEntries(lock, npmPendingNames);
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

// Packages npm may run node-gyp for even though the lockfile records no install
// script. A binding.gyp in the installed tree is what npm keys off, and asking
// npm directly is circular: `approve-scripts --allow-scripts-pending` reports
// only what is *not* yet approved, so the answer changes with the manifest we
// are trying to validate.
export function gypfileNames(root, lock) {
  // The probe reads the installed tree, so an uninstalled checkout would report
  // no gypfile packages at all and turn every legitimate approval into a stale
  // one. Fail loudly instead: this check runs after npm ci in CI, and a missing
  // node_modules means the caller ran it too early, not that the manifest is
  // wrong.
  if (!existsSync(resolve(root, "node_modules"))) {
    throw new Error(`install-policy needs an installed tree: ${resolve(root, "node_modules")} is missing (run npm ci first)`);
  }
  const names = [];
  for (const lockPath of Object.keys(lock.packages || {})) {
    if (!lockPath) continue;
    const name = packageNameFromLockPath(lockPath);
    if (!name) continue;
    if (existsSync(resolve(root, lockPath, "binding.gyp"))) names.push(name);
  }
  return [...new Set(names)];
}

export function checkRepositoryInstallPolicy(root = process.cwd()) {
  const manifest = readJson(resolve(root, "package.json"));
  const lock = readJson(resolve(root, "package-lock.json"));
  const uiManifest = readJson(resolve(root, "ui/package.json"));
  const uiLock = readJson(resolve(root, "ui/package-lock.json"));
  return [
    ...validateInstallPolicy(manifest, lock, "root", gypfileNames(root, lock)),
    ...validateInstallPolicy(uiManifest, uiLock, "ui", gypfileNames(resolve(root, "ui"), uiLock)),
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
    // lockfile disagreeing about the same package, not a missing approval.
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
