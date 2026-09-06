#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function assertCiSha(expected, actual) {
  if (typeof expected !== "string" || !/^[0-9a-f]{40}$/.test(expected)) throw new Error("EXPECTED_SHA must be a full lowercase 40-hex SHA");
  if (typeof actual !== "string" || !/^[0-9a-f]{40}$/.test(actual)) throw new Error("HEAD must be a full lowercase 40-hex SHA");
  if (expected !== actual) throw new Error("checked-out HEAD differs from EXPECTED_SHA");
  return { expectedSha: expected, actualSha: actual };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const actual = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", timeout: 10_000 }).trim();
    console.log(JSON.stringify(assertCiSha(process.env.EXPECTED_SHA, actual)));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Candidate checkout verification failed");
    process.exitCode = 1;
  }
}
