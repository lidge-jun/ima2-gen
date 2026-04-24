import { describe, it } from "node:test";
import assert from "node:assert";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("star prompt", () => {
  it("state path honors IMA2_CONFIG_DIR", async () => {
    const prev = process.env.IMA2_CONFIG_DIR;
    const dir = await mkdtemp(join(tmpdir(), "ima2-star-home-"));
    process.env.IMA2_CONFIG_DIR = dir;
    try {
      const mod = await import(`../bin/lib/star-prompt.js?case=${Date.now()}`);
      assert.strictEqual(mod.starPromptStatePath(), join(dir, "state", "star-prompt.json"));
    } finally {
      if (prev === undefined) delete process.env.IMA2_CONFIG_DIR;
      else process.env.IMA2_CONFIG_DIR = prev;
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("starRepo calls gh starred API with hidden Windows console", async () => {
    const { starRepo } = await import("../bin/lib/star-prompt.js");
    let seenCommand = "";
    let seenArgs = [];
    let seenOptions;

    const result = starRepo((command, args, options) => {
      seenCommand = command;
      seenArgs = args;
      seenOptions = options;
      return {
        status: 0,
        stdout: "",
        stderr: "",
      };
    });

    assert.deepStrictEqual(result, { ok: true });
    assert.strictEqual(seenCommand, "gh");
    assert.deepStrictEqual(seenArgs, ["api", "-X", "PUT", "/user/starred/lidge-jun/ima2-gen"]);
    assert.strictEqual(seenOptions.windowsHide, true);
  });

  it("maybePromptGithubStar skips non-TTY sessions", async () => {
    const { maybePromptGithubStar } = await import("../bin/lib/star-prompt.js");
    let marked = false;

    await maybePromptGithubStar({
      stdinIsTTY: false,
      stdoutIsTTY: true,
      markPromptedFn: async () => { marked = true; },
    });

    assert.strictEqual(marked, false);
  });

  it("maybePromptGithubStar marks once and thanks on successful star", async () => {
    const { maybePromptGithubStar } = await import("../bin/lib/star-prompt.js");
    const logs = [];
    let marked = false;

    await maybePromptGithubStar({
      stdinIsTTY: true,
      stdoutIsTTY: true,
      hasBeenPromptedFn: async () => false,
      isGhInstalledFn: () => true,
      markPromptedFn: async () => { marked = true; },
      askYesNoFn: async () => true,
      starRepoFn: () => ({ ok: true }),
      logFn: (message) => logs.push(message),
    });

    assert.strictEqual(marked, true);
    assert.deepStrictEqual(logs, ["[ima2] Thanks for the star!"]);
  });
});
