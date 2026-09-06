import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { test } from "node:test";
import { parse } from "yaml";

test("PR checkout retains history needed by release provenance", () => {
  const workflow = parse(readFileSync(".github/workflows/pr-fast.yml", "utf8"));
  const checkout = workflow.jobs.fast.steps.filter((step) => step.uses?.startsWith("actions/checkout@"));
  assert.equal(checkout.length, 1);
  assert.equal(checkout[0].with["fetch-depth"], 0);
});

test("depth two has a merge parent but cannot prove older ancestry; unshallow restores proof", () => {
  const root = mkdtempSync(join(tmpdir(), "ima2-pr-history-"));
  const source = join(root, "source"), shallow = join(root, "shallow");
  const git = (args, cwd = root) => execFileSync("git", args, {
    cwd, encoding: "utf8", timeout: 10_000, stdio: ["ignore", "pipe", "pipe"],
  }).trim();
  try {
    git(["init", "--initial-branch=main", source]);
    let oldest;
    for (let i = 0; i < 4; i++) {
      git(["-c", "user.name=Owned fixture", "-c", "user.email=fixture@example.invalid",
        "-c", "commit.gpgsign=false", "commit", "--allow-empty", "-m", `owned-${i}`], source);
      if (i === 0) oldest = git(["rev-parse", "HEAD"], source);
    }
    git(["clone", "--depth=2", pathToFileURL(source).href, shallow]);
    assert.match(git(["rev-parse", "HEAD^1"], shallow), /^[a-f0-9]{40}$/);
    const absent = spawnSync("git", ["merge-base", "--is-ancestor", oldest, "HEAD"], {
      cwd: shallow, encoding: "utf8", timeout: 10_000,
    });
    assert.equal(absent.error, undefined);
    assert.equal(absent.status, 128);
    git(["fetch", "--unshallow"], shallow);
    assert.equal(git(["merge-base", "--is-ancestor", oldest, "HEAD"], shallow), "");
  } finally { rmSync(root, { recursive: true, force: true }); }
});
