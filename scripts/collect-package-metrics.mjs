#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const baselinePath = join(repoRoot, "metrics", "package-health-baseline.json");
const WARN_RATIO = 1.05;
const FAIL_RATIO = 1.10;

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  let outputPath = null;
  const outputIndex = args.indexOf("--output");
  if (outputIndex >= 0) {
    outputPath = resolve(args[outputIndex + 1]);
    args.splice(outputIndex, 2);
  }
  return { command, args, outputPath };
}

function emptyMetrics() {
  return {
    schemaVersion: 1,
    measuredAt: new Date().toISOString(),
    package: null,
    coldInstallMs: null,
    globalUpdateMs: null,
    shallowCloneBytes: null,
    maxNewBlobBytes: null,
    releaseAssetBytes: null,
  };
}

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function readMetrics(outputPath) {
  return outputPath && existsSync(outputPath) ? readJson(outputPath) : emptyMetrics();
}

function writeMetrics(outputPath, metrics) {
  metrics.measuredAt = new Date().toISOString();
  if (outputPath) {
    mkdirSync(dirname(outputPath), { recursive: true });
    writeFileSync(outputPath, `${JSON.stringify(metrics, null, 2)}\n`);
  }
  console.log(JSON.stringify(metrics));
}

function gha(level, message) {
  const escaped = String(message).replaceAll("%", "%25").replaceAll("\r", "%0D").replaceAll("\n", "%0A");
  console.log(`::${level}::${escaped}`);
}

function appendSummary(label, value) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, `- ${label}: ${value}\n`);
}

function checkPackageRegression(current, baseline) {
  let failed = false;
  for (const [label, key] of [
    ["tarball compressed bytes", "compressedBytes"],
    ["package unpacked bytes", "unpackedBytes"],
  ]) {
    const ratio = current[key] / baseline.package[key];
    const percent = ((ratio - 1) * 100).toFixed(2);
    if (ratio >= FAIL_RATIO) {
      gha("error", `${label} increased ${percent}% (10% budget exceeded)`);
      failed = true;
    } else if (ratio >= WARN_RATIO) {
      gha("warning", `${label} increased ${percent}% (5% warning threshold)`);
    }
  }
  if (failed) process.exitCode = 1;
}

function collectPackage(metrics) {
  const stdout = execFileSync(
    "npm",
    ["pack", "--dry-run", "--ignore-scripts", "--json"],
    { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const packed = JSON.parse(stdout)[0];
  metrics.package = {
    compressedBytes: packed.size,
    unpackedBytes: packed.unpackedSize,
    entryCount: packed.entryCount,
  };
  checkPackageRegression(metrics.package, readJson(baselinePath));
  appendSummary("npm package", JSON.stringify(metrics.package));
}

function collectInstall(metrics, key) {
  if (key !== "coldInstallMs" && key !== "globalUpdateMs") throw new Error(`unsupported install metric: ${key}`);
  const root = mkdtempSync(join(tmpdir(), "ima2-install-metric-"));
  try {
    const pack = JSON.parse(execFileSync(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", root],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
    ))[0];
    const tarball = join(root, pack.filename);
    const cache = join(root, "npm-cache");
    const target = join(root, key === "coldInstallMs" ? "project" : "prefix");
    let args;
    if (key === "coldInstallMs") {
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, "package.json"), "{\"private\":true}\n");
      args = ["install", tarball, "--cache", cache, "--no-audit", "--no-fund"];
    } else {
      execFileSync("npm", ["install", "--global", "--prefix", target, "ima2-gen@latest", "--cache", cache], { stdio: "inherit" });
      args = ["install", "--global", "--prefix", target, tarball, "--cache", cache];
    }
    const started = process.hrtime.bigint();
    execFileSync("npm", args, { cwd: target, stdio: "inherit", env: process.env });
    metrics[key] = Number((process.hrtime.bigint() - started) / 1_000_000n);
    appendSummary(key, `${metrics[key]} ms`);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function directoryBytes(path) {
  let total = 0;
  for (const entry of readdirSync(path, { withFileTypes: true })) {
    const child = join(path, entry.name);
    total += entry.isDirectory() ? directoryBytes(child) : statSync(child).size;
  }
  return total;
}

function collectShallowClone(metrics, repository) {
  if (!repository) throw new Error("shallow-clone requires a repository URL");
  const root = mkdtempSync(join(tmpdir(), "ima2-shallow-clone-"));
  const clonePath = join(root, "repo");
  try {
    execFileSync("git", ["clone", "--depth=1", "--no-checkout", repository, clonePath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    metrics.shallowCloneBytes = directoryBytes(join(clonePath, ".git", "objects"));
    appendSummary("shallowCloneBytes", metrics.shallowCloneBytes);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

async function collectReleaseAssets(metrics, repository, tag) {
  if (!repository || !repository.includes("/")) {
    throw new Error("release-assets requires owner/repository [tag|latest]");
  }
  const suffix = !tag || tag === "latest"
    ? "releases/latest"
    : `releases/tags/${encodeURIComponent(tag)}`;
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "ima2-package-health",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/${suffix}`, {
    headers,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`GitHub release API failed: HTTP ${response.status}`);
  const release = await response.json();
  if (!Array.isArray(release.assets)) throw new Error("GitHub release response has no assets array");
  metrics.releaseAssetBytes = release.assets.reduce((sum, asset) => sum + Number(asset.size || 0), 0);
  appendSummary("releaseAssetBytes", metrics.releaseAssetBytes);
}

async function main() {
  const { command, args, outputPath } = parseArgs(process.argv.slice(2));
  const metrics = readMetrics(outputPath);
  if (command === "package") collectPackage(metrics);
  else if (command === "install") collectInstall(metrics, args[0]);
  else if (command === "shallow-clone") collectShallowClone(metrics, args[0]);
  else if (command === "release-assets") await collectReleaseAssets(metrics, args[0], args[1]);
  else {
    throw new Error(
      "usage: collect-package-metrics.mjs package|install <coldInstallMs|globalUpdateMs>|shallow-clone <url>|release-assets <owner/repo> [tag] [--output path]",
    );
  }
  writeMetrics(outputPath, metrics);
}

main().catch((error) => {
  console.error(`[package-metrics] ${error.message}`);
  process.exit(1);
});
