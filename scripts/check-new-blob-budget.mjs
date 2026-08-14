#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_LIMIT = 5 * 1024 * 1024;

function git(args, options = {}) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, ...options }).trim();
}

function parseArgs(argv) {
  const args = [...argv];
  let base = null;
  let head = "HEAD";
  let outputPath = null;
  let limit = DEFAULT_LIMIT;
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--base") base = args[++index];
    else if (args[index] === "--head") head = args[++index];
    else if (args[index] === "--output") outputPath = resolve(args[++index]);
    else if (args[index] === "--limit-bytes") limit = Number(args[++index]);
    else throw new Error(`unknown argument: ${args[index]}`);
  }
  return { base, head, outputPath, limit };
}

function defaultBase() {
  const eventBefore = process.env.GITHUB_EVENT_BEFORE;
  if (eventBefore && !/^0+$/.test(eventBefore)) return eventBefore;
  if (process.env.GITHUB_BASE_REF) return `origin/${process.env.GITHUB_BASE_REF}`;
  return `${process.env.GITHUB_SHA || "HEAD"}^`;
}

function objectPathMap(lines) {
  const paths = new Map();
  for (const line of lines) {
    const space = line.indexOf(" ");
    const oid = space < 0 ? line : line.slice(0, space);
    const path = space < 0 ? "(no path)" : line.slice(space + 1);
    if (!paths.has(oid)) paths.set(oid, path);
  }
  return paths;
}

function updateOutput(path, maxNewBlobBytes) {
  if (!path) return;
  const metrics = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : { schemaVersion: 1 };
  metrics.maxNewBlobBytes = maxNewBlobBytes;
  metrics.measuredAt = new Date().toISOString();
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(metrics, null, 2)}\n`);
}

function appendSummary(base, head, blobs) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  const largest = blobs[0];
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    `- new blobs: ${blobs.length}; max: ${largest ? `${largest.size} bytes (${largest.path})` : "0 bytes"}; range: ${base}..${head}\n`,
  );
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (!Number.isFinite(options.limit) || options.limit <= 0) throw new Error("limit must be a positive byte count");
  const baseRef = options.base || defaultBase();
  const mergeBase = git(["merge-base", baseRef, options.head]);
  const listed = git(["rev-list", "--objects", options.head, "--not", mergeBase]);
  const lines = listed ? listed.split("\n").filter(Boolean) : [];
  const paths = objectPathMap(lines);
  const oids = [...paths.keys()];
  const checked = oids.length === 0
    ? ""
    : git(
      ["cat-file", "--batch-check=%(objectname) %(objecttype) %(objectsize)"],
      { input: `${oids.join("\n")}\n` },
    );
  const blobs = checked
    ? checked.split("\n").map((line) => {
      const [oid, type, rawSize] = line.split(" ");
      return { oid, type, size: Number(rawSize), path: paths.get(oid) || "(no path)" };
    }).filter((object) => object.type === "blob").sort((a, b) => b.size - a.size)
    : [];
  const oversized = blobs.filter((blob) => blob.size >= options.limit);
  const maxNewBlobBytes = blobs[0]?.size || 0;
  updateOutput(options.outputPath, maxNewBlobBytes);
  appendSummary(mergeBase, options.head, blobs);
  console.log(JSON.stringify({ base: mergeBase, head: options.head, blobCount: blobs.length, maxNewBlobBytes }));
  if (oversized.length > 0) {
    for (const blob of oversized) {
      console.error(`::error file=${blob.path}::new blob ${blob.oid} is ${blob.size} bytes; limit is ${options.limit - 1}`);
    }
    process.exit(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[blob-budget] ${error.message}`);
  process.exit(1);
}
