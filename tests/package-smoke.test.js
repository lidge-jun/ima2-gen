import { describe, it } from "node:test";
import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const REQUIRED_SOURCE_PACK_FILES = [
  "README.md",
  "docs/RECOVER_OLD_IMAGES.md",
  "server.js",
  "config.js",
  "routes/cardNews.js",
  "routes/metadata.js",
  "routes/storage.js",
  "integrations/comfyui/ima2_gen_bridge/__init__.py",
  "integrations/comfyui/ima2_gen_bridge/nodes.py",
  "integrations/comfyui/ima2_gen_bridge/README.md",
  "lib/cardNewsTemplateStore.js",
  "lib/imageMetadata.js",
  "lib/imageMetadataStore.js",
  "lib/openDirectory.js",
  "lib/storageMigration.js",
  "bin/ima2.js",
  "bin/lib/storage-doctor.js",
  "assets/card-news/templates/academy-lesson-square/template.json",
  "assets/card-news/templates/academy-lesson-square/base.png",
  "assets/card-news/templates/academy-lesson-square/preview.png",
  "assets/card-news/templates/clean-report-square/template.json",
  "assets/card-news/templates/clean-report-square/base.png",
  "assets/card-news/templates/clean-report-square/preview.png",
];

const REQUIRED_BUILD_PACK_FILES = [
  "ui/dist/index.html",
];

function npmCommand() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function npmPackCommandArgs(packDestination) {
  const args = ["pack", "--dry-run", "--json", "--pack-destination", packDestination];
  if (process.env.npm_execpath) {
    return { command: process.execPath, args: [process.env.npm_execpath, ...args] };
  }
  return { command: npmCommand(), args };
}

function readPackManifest() {
  const packDestination = mkdtempSync(join(tmpdir(), "ima2-pack-smoke-"));
  try {
    const { command, args } = npmPackCommandArgs(packDestination);
    const result = spawnSync(command, args, {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        npm_config_loglevel: "silent",
      },
    });

    assert.strictEqual(
      result.status,
      0,
      `npm pack --dry-run failed\nerror:\n${result.error?.message || ""}\nstdout:\n${result.stdout || ""}\nstderr:\n${result.stderr || ""}`,
    );

    try {
      const parsed = JSON.parse(result.stdout);
      assert.ok(Array.isArray(parsed), "npm pack output should be a JSON array");
      assert.ok(parsed[0], "npm pack output should include one package manifest");
      return parsed[0];
    } catch (error) {
      assert.fail(`Could not parse npm pack --dry-run --json output: ${error.message}`);
    }
  } finally {
    rmSync(packDestination, { recursive: true, force: true });
  }
}

describe("package smoke", () => {
  it("includes release-critical source files in npm pack output", () => {
    const manifest = readPackManifest();
    const packedFiles = new Set(manifest.files.map((file) => file.path));

    for (const requiredFile of REQUIRED_SOURCE_PACK_FILES) {
      assert.ok(
        packedFiles.has(requiredFile),
        `npm package should include ${requiredFile}`,
      );
    }
  });

  it("includes built UI files when build output exists", () => {
    const missingBuildOutputs = REQUIRED_BUILD_PACK_FILES.filter((file) => !existsSync(join(process.cwd(), file)));
    if (missingBuildOutputs.length > 0) {
      assert.ok(true, `build output not present; skipped: ${missingBuildOutputs.join(", ")}`);
      return;
    }

    const manifest = readPackManifest();
    const packedFiles = new Set(manifest.files.map((file) => file.path));

    for (const requiredFile of REQUIRED_BUILD_PACK_FILES) {
      assert.ok(
        packedFiles.has(requiredFile),
        `npm package should include ${requiredFile}`,
      );
    }
  });
});
