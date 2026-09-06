#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnNpmSync } from "./npm-subprocess.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const record = (value) => value !== null && typeof value === "object"
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
const requireThat = (condition) => { if (!condition) throw new Error("Pages publication contract mismatch"); };

export function parsePagesInputs({ releaseVersion, releaseSha }) {
  if (typeof releaseVersion !== "string" || !/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/.test(releaseVersion)) {
    throw new Error("release_version must be a stable semantic version");
  }
  if (typeof releaseSha !== "string" || !/^[0-9a-f]{40}$/.test(releaseSha)) {
    throw new Error("release_sha must be a full lowercase SHA");
  }
  return { version: releaseVersion, sha: releaseSha };
}

export function assertPagesPublication({ version, sha, sourceVersion, headSha, tagSha, registry, installationReport }) {
  parsePagesInputs({ releaseVersion: version, releaseSha: sha });
  requireThat(sourceVersion === version && headSha === sha && tagSha === sha && record(registry));
  for (const metadata of [registry.exact, registry.latest]) {
    requireThat(record(metadata) && metadata.version === version && metadata.gitHead === sha);
  }
  const dist = registry.exact.dist;
  requireThat(record(dist) && typeof dist.integrity === "string" && dist.integrity.length > 0
    && typeof dist.tarball === "string" && dist.tarball.length > 0);
  const report = installationReport;
  requireThat(record(report) && report.schemaVersion === 1 && report.mode === "installation" && report.version === version);
  requireThat(Array.isArray(report.checks) && report.checks.length > 0 && record(report.summary));
  requireThat(report.checks.every((check) => record(check) && ["pass", "fail", "warn", "info"].includes(check.kind)
    && typeof check.code === "string" && typeof check.message === "string"));
  const passed = report.checks.filter((check) => check.kind === "pass").length;
  const warned = report.checks.filter((check) => check.kind === "warn").length;
  requireThat(passed > 0 && !report.checks.some((check) => check.kind === "fail")
    && report.checks.some((check) => check.kind === "pass" && check.code === "NODE_RUNTIME_OK"));
  requireThat(report.summary.exitCode === 0 && report.summary.failed === 0
    && report.summary.passed === passed && report.summary.warned === warned);
  return { version, sourceSha: sha, installationMode: "installation", installationPassed: true, integrity: dist.integrity };
}

function registryMetadata(spec) {
  const result = spawnNpmSync(["view", spec, "--json"], { cwd: ROOT, encoding: "utf8", timeout: 60_000, maxBuffer: 4 * 1024 * 1024 });
  requireThat(!result.error && result.status === 0);
  return JSON.parse(result.stdout);
}

function main(args) {
  const inputs = parsePagesInputs({ releaseVersion: process.env.RELEASE_VERSION, releaseSha: process.env.RELEASE_SHA });
  const sourceVersion = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8")).version;
  requireThat(sourceVersion === inputs.version);
  if (args.length === 1 && args[0] === "validate-inputs") return inputs;
  requireThat(args.length === 3 && args[0] === "verify" && args[1] === "--report" && args[2]);
  const git = (parameters) => execFileSync("git", parameters, { cwd: ROOT, encoding: "utf8", timeout: 60_000 }).trim();
  return assertPagesPublication({ ...inputs, sourceVersion, headSha: git(["rev-parse", "HEAD"]),
    tagSha: git(["rev-list", "-n1", `v${inputs.version}`]),
    registry: { exact: registryMetadata(`ima2-gen@${inputs.version}`), latest: registryMetadata("ima2-gen@latest") },
    installationReport: JSON.parse(readFileSync(resolve(args[2]), "utf8")) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { console.log(JSON.stringify(main(process.argv.slice(2)))); }
  catch { console.error("Pages publication verification failed; check the exact release, registry and installation report."); process.exitCode = 1; }
}
