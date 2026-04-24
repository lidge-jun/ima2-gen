import test from "node:test";
import { strict as assert } from "node:assert";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import {
  getLegacyGeneratedCandidates,
  migrateGeneratedStorage,
} from "../lib/storageMigration.js";

async function withTempDirs(fn) {
  const rootDir = await mkdtemp(join(tmpdir(), "ima2-migrate-root-"));
  const targetDir = await mkdtemp(join(tmpdir(), "ima2-migrate-target-"));
  try {
    return await fn({ rootDir, targetDir });
  } finally {
    await rm(rootDir, { recursive: true, force: true });
    await rm(targetDir, { recursive: true, force: true });
  }
}

function makeCtx(rootDir, targetDir) {
  return {
    rootDir,
    config: {
      storage: {
        generatedDir: targetDir,
      },
    },
  };
}

test("legacy package generated assets are copied into the user data dir", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const legacyDir = join(rootDir, "generated");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, "old.png"), "old");
    await writeFile(join(legacyDir, "old.png.json"), "{}");

    const ctx = makeCtx(rootDir, targetDir);
    const candidates = getLegacyGeneratedCandidates(ctx);
    assert.ok(candidates.includes(resolve(legacyDir)));

    const result = await migrateGeneratedStorage(ctx, { legacyDirs: [legacyDir] });
    assert.equal(result.copied, 2);
    assert.equal(await readFile(join(targetDir, "old.png"), "utf8"), "old");
    assert.equal(await readFile(join(targetDir, "old.png.json"), "utf8"), "{}");
  });
});

test("migration is idempotent and never overwrites existing gallery files", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const legacyDir = join(rootDir, "generated");
    await mkdir(legacyDir, { recursive: true });
    await writeFile(join(legacyDir, "old.png"), "old");

    const ctx = makeCtx(rootDir, targetDir);
    const first = await migrateGeneratedStorage(ctx, { legacyDirs: [legacyDir] });
    assert.equal(first.copied, 1);

    await writeFile(join(targetDir, "old.png"), "kept");
    const second = await migrateGeneratedStorage(ctx, { legacyDirs: [legacyDir] });
    assert.equal(second.copied, 0);
    assert.equal(second.skippedExisting, 1);
    assert.equal(await readFile(join(targetDir, "old.png"), "utf8"), "kept");
  });
});

test("multiple legacy sources with the same filename copy only once", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const legacyA = join(rootDir, "generated-a");
    const legacyB = join(rootDir, "generated-b");
    await mkdir(legacyA, { recursive: true });
    await mkdir(legacyB, { recursive: true });
    await writeFile(join(legacyA, "same.png"), "from-a");
    await writeFile(join(legacyB, "same.png"), "from-b");
    await writeFile(join(legacyB, "other.png"), "other");

    const result = await migrateGeneratedStorage(makeCtx(rootDir, targetDir), {
      legacyDirs: [legacyA, legacyB],
    });

    assert.equal(result.copied, 2);
    assert.equal(result.skippedExisting, 1);
    assert.equal(await readFile(join(targetDir, "same.png"), "utf8"), "from-a");
    assert.equal(await readFile(join(targetDir, "other.png"), "utf8"), "other");
  });
});

test("nested legacy folders are copied once and skipped on repeat", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const nestedDir = join(rootDir, "generated", "session-1");
    await mkdir(nestedDir, { recursive: true });
    await writeFile(join(nestedDir, "image.png"), "nested");

    const ctx = makeCtx(rootDir, targetDir);
    const first = await migrateGeneratedStorage(ctx, {
      legacyDirs: [join(rootDir, "generated")],
    });
    const second = await migrateGeneratedStorage(ctx, {
      legacyDirs: [join(rootDir, "generated")],
    });

    assert.equal(first.copied, 1);
    assert.equal(second.copied, 0);
    assert.equal(second.skippedExisting, 1);
    assert.equal(await readFile(join(targetDir, "session-1", "image.png"), "utf8"), "nested");
  });
});

test("target and target-parent candidates are skipped to prevent recursive moves", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const sourceDir = join(rootDir, "generated");
    await mkdir(sourceDir, { recursive: true });
    await writeFile(join(sourceDir, "old.png"), "old");
    await writeFile(join(targetDir, "already.png"), "already");

    const result = await migrateGeneratedStorage(makeCtx(rootDir, targetDir), {
      legacyDirs: [targetDir, join(targetDir, "nested"), sourceDir],
    });

    assert.equal(result.sourcesSkipped, 2);
    assert.equal(result.copied, 1);
    assert.equal(await readFile(join(targetDir, "already.png"), "utf8"), "already");
    assert.equal(await readFile(join(targetDir, "old.png"), "utf8"), "old");
  });
});

test("candidate discovery includes npm prefix, appdata, npm-global, and version manager paths", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const ctx = makeCtx(rootDir, targetDir);
    const npmPrefix = join(rootDir, "prefix");
    const appData = join(rootDir, "AppData", "Roaming");
    const home = join(rootDir, "home");
    const candidates = getLegacyGeneratedCandidates(ctx, {
      npm_config_prefix: npmPrefix,
      APPDATA: appData,
      IMA2_TEST_HOME: home,
    });

    assert.ok(candidates.includes(resolve(join(rootDir, "generated"))));
    assert.ok(candidates.includes(resolve(join(npmPrefix, "lib", "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(npmPrefix, "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(appData, "npm", "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(home, ".npm-global", "lib", "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(home, ".nvm", "versions", "node", process.version, "lib", "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(home, ".volta", "tools", "image", "packages", "ima2-gen", "lib", "node_modules", "ima2-gen", "generated"))));
    assert.ok(candidates.includes(resolve(join(home, ".fnm", "node-versions", process.version, "installation", "lib", "node_modules", "ima2-gen", "generated"))));
  });
});

test("candidate discovery covers Homebrew global installs when node resolves to Cellar", async () => {
  await withTempDirs(async ({ rootDir, targetDir }) => {
    const ctx = makeCtx(rootDir, targetDir);
    const candidates = getLegacyGeneratedCandidates(ctx, {
      IMA2_TEST_EXEC_PATH: "/opt/homebrew/Cellar/node/25.2.1/bin/node",
      IMA2_TEST_ARGV1: "/opt/homebrew/bin/ima2",
    });

    assert.ok(candidates.includes(resolve("/opt/homebrew/lib/node_modules/ima2-gen/generated")));
    assert.ok(candidates.includes(resolve("/opt/homebrew/node_modules/ima2-gen/generated")));
  });
});
