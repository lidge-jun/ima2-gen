import fs from "node:fs";
import { basename, isAbsolute, relative, resolve, sep } from "node:path";
export const REPORTED = Symbol("fixture denial reported");

export function safeDenial(code = "E2E_FILESYSTEM_DENIED", message = "fixture filesystem access denied") {
  return Object.assign(new Error(message), { code });
}
export function isDescendant(target, parent) {
  const path = relative(parent, target);
  return path === "" || (path !== ".." && !path.startsWith(".." + sep) && !isAbsolute(path));
}
export function canonicalRoot(value) {
  if (typeof value !== "string" || !isAbsolute(value) || resolve(value) === dirnameRoot(value)) throw safeDenial("E2E_POLICY_INVALID", "invalid fixture root");
  const metadata = fs.lstatSync(value);
  if (!metadata.isDirectory() || metadata.isSymbolicLink() || fs.realpathSync(value) !== value) throw safeDenial("E2E_POLICY_INVALID", "invalid fixture root");
  return value;
}
function dirnameRoot(path) { return resolve(path, ".."); }
export function parsePolicy(value) {
  const keys = ["version", "root", "home", "dependencyRoots"];
  if (!value || typeof value !== "object" || Array.isArray(value) || value.version !== 1
    || Object.keys(value).length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))
    || typeof value.root !== "string" || value.root !== process.cwd()
    || typeof value.home !== "string" || (process.env.IMA2_E2E_HOME && process.env.IMA2_E2E_HOME !== value.home)
    || !Array.isArray(value.dependencyRoots) || value.dependencyRoots.length !== 1) {
    throw safeDenial("E2E_POLICY_INVALID", "invalid fixture policy");
  }
  const root = canonicalRoot(value.root), home = canonicalRoot(value.home);
  const dependency = fs.realpathSync(resolve(root, "node_modules"));
  if (value.dependencyRoots[0] !== dependency || basename(dependency) !== "node_modules"
    || isDescendant(home, root) || isDescendant(root, home)) throw safeDenial("E2E_POLICY_INVALID", "invalid fixture policy roots");
  canonicalRoot(dependency);
  return Object.freeze({ version: 1, root, home, dependencyRoots: Object.freeze([dependency]) });
}
export function isDiscovery(value) { return value === null || ["agy-version", "grok-version", "codex-login-status"].includes(value); }
