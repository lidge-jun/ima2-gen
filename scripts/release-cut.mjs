#!/usr/bin/env node
/**
 * The release-cut steps that scripts/release.sh used to own: baseline guard, version
 * commit, preview proof, and the stable-tag decision.
 *
 * Nothing here publishes. publish.yml keeps that job and stays the only holder of
 * `id-token: write`; this module only decides whether a cut may proceed, so the guards
 * that protected the local flow now protect the CI flow.
 *
 * Ordering is load-bearing and mirrors the old script exactly:
 *   baseline -> version commit -> preview push -> npm preview proof -> stable tag.
 * The tag is a certificate that the preview build proved this SHA, never a trigger
 * issued ahead of that proof.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync } from "node:fs";

const PACKAGE_NAME = "ima2-gen";

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

/**
 * Reads npm metadata. Returns null ONLY for a genuine absence; every other failure
 * throws, because an indeterminate registry must never read as "not published".
 */
export function npmView(spec, field, run = execFileSync) {
  try {
    return JSON.parse(run("npm", ["view", spec, field, "--json"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }));
  } catch (error) {
    const stderr = String(error.stderr || "");
    if (/E404|is not in this registry|No match found/.test(stderr)) return null;
    throw new Error(`npm view ${spec} ${field} failed: ${stderr.trim() || error.message}`);
  }
}

function emit(values) {
  const path = process.env.GITHUB_OUTPUT;
  const body = Object.entries(values).map(([key, value]) => `${key}=${value}`).join("\n");
  if (path) appendFileSync(path, `${body}\n`);
  console.log(body);
}

/**
 * Mirrors the ancestry guards of the old scripts/release.sh: a release may only be cut
 * from a main that already contains dev and preview, so a tag can never orphan merged
 * work that lives only on another release branch.
 */
export function assertBaseline({ head, main, dev, preview, contains }) {
  const problems = [];
  if (main !== head) problems.push(`origin/main is ${main}, expected the checked-out ${head}`);
  if (!contains(dev, head)) problems.push(`main does not contain origin/dev (${dev})`);
  if (!contains(preview, head)) problems.push(`main does not contain origin/preview (${preview})`);
  return problems;
}

/**
 * npm versions and git tags are both immutable, so a cut onto an already-published or
 * already-tagged version is refused before anything is pushed.
 */
export function assertCuttable({ version, publishedVersion, remoteTag }) {
  const problems = [];
  if (!/^\d+\.\d+\.\d+$/.test(version)) problems.push(`release version must be stable X.Y.Z (got ${version})`);
  if (publishedVersion) problems.push(`${PACKAGE_NAME}@${version} is already published`);
  if (remoteTag) problems.push(`remote tag v${version} already exists`);
  return problems;
}

/** A stable tag may only follow a preview build whose gitHead proves this exact SHA. */
export function assertPreviewProof({ version, sha, previewVersion, previewGitHead }) {
  const problems = [];
  if (previewGitHead !== sha) problems.push(`npm preview gitHead ${previewGitHead ?? "(none)"} does not prove ${sha}`);
  if (!String(previewVersion).startsWith(`${version}-preview.`)) {
    problems.push(`npm preview ${previewVersion ?? "(none)"} is not a ${version} candidate`);
  }
  return problems;
}

function contains(ancestor, descendant) {
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function fail(problems) {
  throw new Error(problems.join("; "));
}

function preflight() {
  const problems = assertBaseline({
    head: git(["rev-parse", "HEAD"]),
    main: git(["rev-parse", "origin/main"]),
    dev: git(["rev-parse", "origin/dev"]),
    preview: git(["rev-parse", "origin/preview"]),
    contains,
  });
  if (problems.length) fail(problems);
  console.log("[release] baseline verified");
}

function commit(bump) {
  const dirty = git(["status", "--porcelain", "--untracked-files=normal"]);
  if (dirty) fail([`worktree is dirty before the version commit:\n${dirty}`]);
  execFileSync("npm", ["version", bump, "--no-git-tag-version"], { stdio: "inherit" });
  const version = JSON.parse(readFileSync("package.json", "utf8")).version;
  const problems = assertCuttable({
    version,
    publishedVersion: npmView(`${PACKAGE_NAME}@${version}`, "version"),
    remoteTag: git(["ls-remote", "--tags", "origin", `refs/tags/v${version}`]),
  });
  if (problems.length) fail(problems);
  git(["config", "user.name", "github-actions[bot]"]);
  git(["config", "user.email", "41898282+github-actions[bot]@users.noreply.github.com"]);
  git(["add", "package.json", "package-lock.json"]);
  git(["commit", "-m", `[agent] chore: release v${version}`]);
  emit({ version, sha: git(["rev-parse", "HEAD"]) });
}

function previewProof(version, sha) {
  const problems = assertPreviewProof({
    version,
    sha,
    previewVersion: npmView(`${PACKAGE_NAME}@preview`, "version"),
    previewGitHead: npmView(`${PACKAGE_NAME}@preview`, "gitHead"),
  });
  if (problems.length) fail(problems);
  console.log(`[release] preview proof verified for v${version}@${sha}`);
}

const COMMANDS = {
  preflight: () => preflight(),
  commit: (args) => commit(args[0] || "patch"),
  "assert-preview-proof": (args) => previewProof(args[0], args[1]),
};

const isMain = process.argv[1] && process.argv[1].endsWith("release-cut.mjs");
if (isMain) {
  const [command, ...args] = process.argv.slice(2);
  try {
    const run = COMMANDS[command];
    if (!run) throw new Error("usage: release-cut.mjs preflight | commit <bump> | assert-preview-proof <version> <sha>");
    run(args);
  } catch (error) {
    console.error(`[release-cut] ${error.message}`);
    process.exit(1);
  }
}
