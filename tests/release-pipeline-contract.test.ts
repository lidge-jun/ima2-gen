import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPreviewVersion,
  classifyPublish,
  parsePackOutput,
  validateProvenance,
  validateRemoteRefs,
  verifyArtifactDigest,
} from "../scripts/release-contract.mjs";
import { validateBundleParity, validateInstallPolicy } from "../scripts/check-install-policy.mjs";
import { npmInvocation } from "../scripts/npm-subprocess.mjs";

const SHA = "a".repeat(40);

describe("release channel contract", () => {
  it("accepts only preview branch pushes and matching stable tag pushes", () => {
    const preview = classifyPublish({
      eventName: "push", ref: "refs/heads/preview", sha: SHA,
      packageVersion: "2.0.13", latestVersion: "2.0.13", latestGitHead: SHA,
      runId: "123", runAttempt: "1", date: new Date("2026-07-10T00:00:00Z"),
    });
    assert.equal(preview.version, "2.0.14-preview.260710.123.1");
    assert.deepEqual(
      classifyPublish({
        eventName: "push", ref: "refs/tags/v2.0.14", sha: SHA,
        packageVersion: "2.0.14", latestVersion: "2.0.13", latestGitHead: SHA,
      }),
      { shouldPublish: true, shouldVerify: false, channel: "latest", npmTag: "latest", version: "2.0.14" },
    );
    assert.deepEqual(
      classifyPublish({
        eventName: "push", ref: "refs/tags/v2.0.14", sha: SHA,
        packageVersion: "2.0.14", latestVersion: "2.0.14", latestGitHead: SHA,
      }),
      { shouldPublish: false, shouldVerify: true, channel: "latest", npmTag: "latest", version: "2.0.14" },
    );
    assert.throws(
      () => classifyPublish({
        eventName: "push", ref: "refs/tags/v2.0.12", sha: SHA,
        packageVersion: "2.0.12", latestVersion: "2.0.13", latestGitHead: SHA,
      }),
      /must be newer/,
    );
    assert.throws(() => classifyPublish({ eventName: "workflow_dispatch", ref: "refs/heads/main" }), /unsupported publish event/);
    assert.throws(() => classifyPublish({ eventName: "push", ref: "refs/heads/main" }), /unsupported publish ref/);
    assert.throws(
      () => classifyPublish({ eventName: "push", ref: "refs/tags/v2.0.15", packageVersion: "2.0.14" }),
      /does not match/,
    );
  });

  it("makes same-day runs and reruns immutable-version safe", () => {
    const base = { packageVersion: "2.0.14", latestVersion: "2.0.13", date: new Date("2026-07-10T12:00:00Z") };
    const first = buildPreviewVersion({ ...base, runId: "900", runAttempt: "1" });
    const rerun = buildPreviewVersion({ ...base, runId: "900", runAttempt: "2" });
    const next = buildPreviewVersion({ ...base, runId: "901", runAttempt: "1" });
    assert.equal(new Set([first, rerun, next]).size, 3);
  });

  it("skips a stable-tagged SHA synced back to preview", () => {
    const plan = classifyPublish({
      eventName: "push", ref: "refs/heads/preview", sha: SHA,
      packageVersion: "2.0.14", latestVersion: "2.0.14", latestGitHead: SHA,
      tagsAtHead: ["v2.0.14"], runId: "1", runAttempt: "1",
    });
    assert.equal(plan.shouldPublish, false);
    assert.equal(plan.shouldVerify, false);
  });

  it("requires every live stable ref to identify the preview-proven SHA", () => {
    const refs = { main: SHA, dev: SHA, preview: SHA, "v2.0.14": SHA };
    assert.doesNotThrow(() => validateRemoteRefs({ ref: "refs/tags/v2.0.14", sha: SHA, refs }));
    assert.throws(
      () => validateRemoteRefs({ ref: "refs/tags/v2.0.14", sha: SHA, refs: { ...refs, preview: "b".repeat(40) } }),
      /remote preview/,
    );
  });
});

describe("release artifact and provenance contract", () => {
  it("rejects artifact bytes that differ from the recorded digest", () => {
    const dir = mkdtempSync(join(tmpdir(), "ima2-release-contract-"));
    try {
      const tarball = join(dir, "package.tgz");
      writeFileSync(tarball, "expected");
      const digest = createHash("sha512").update("expected").digest();
      const manifest = { sha512: digest.toString("hex"), integrity: `sha512-${digest.toString("base64")}` };
      assert.doesNotThrow(() => verifyArtifactDigest(manifest, tarball));
      writeFileSync(tarball, "changed");
      assert.throws(() => verifyArtifactDigest(manifest, tarball), /digest mismatch/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("parses only the trailing npm pack manifest after noisy lifecycle output", () => {
    const output = 'build log\n[{"not":"the manifest"}]\nmore output\n[\n  {"filename":"ima2-gen.tgz","bundled":[]}\n]\n';
    assert.equal(parsePackOutput(output).filename, "ima2-gen.tgz");
    const npm12Output = 'lifecycle log\n{\n  "ima2-gen": {"filename":"ima2-gen-12.tgz","bundled":[]}\n}\n';
    assert.equal(parsePackOutput(npm12Output).filename, "ima2-gen-12.tgz");
  });

  it("requires exact workflow, ref, commit, builder, run, and subject digest", () => {
    const statement: any = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [{ name: "pkg:npm/ima2-gen@2.0.14", digest: { sha512: "digest" } }],
      predicate: {
        buildDefinition: {
          buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
          externalParameters: { workflow: { repository: "https://github.com/lidge-jun/ima2-gen", path: ".github/workflows/publish.yml", ref: "refs/tags/v2.0.14" } },
          internalParameters: { github: { event_name: "push" } },
          resolvedDependencies: [{ digest: { gitCommit: SHA } }],
        },
        runDetails: {
          builder: { id: "https://github.com/actions/runner/github-hosted" },
          metadata: { invocationId: "https://github.com/lidge-jun/ima2-gen/actions/runs/1/attempts/1" },
        },
      },
    };
    const identity = validateProvenance(statement, {
      ref: "refs/tags/v2.0.14", sha: SHA, sha512: "digest", version: "2.0.14", runId: "1", runAttempt: "1",
    });
    assert.deepEqual(identity, {
      runId: "1", runAttempt: "1", runUrl: "https://github.com/lidge-jun/ima2-gen/actions/runs/1",
    });
    assert.throws(() => validateProvenance(statement, {
      ref: "refs/tags/v2.0.14", sha: SHA, sha512: "digest", version: "2.0.14", runId: "1", runAttempt: "2",
    }), /invocation mismatch/);
    statement.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/preview";
    assert.throws(() => validateProvenance(statement, {
      ref: "refs/tags/v2.0.14", sha: SHA, sha512: "digest", version: "2.0.14", runId: "1", runAttempt: "1",
    }), /source ref mismatch/);
    statement.predicate.buildDefinition.externalParameters.workflow.ref = "refs/tags/v2.0.14";
    statement.predicateType = "https://example.invalid/provenance";
    assert.throws(() => validateProvenance(statement, {
      ref: "refs/tags/v2.0.14", sha: SHA, sha512: "digest", version: "2.0.14", runId: "1", runAttempt: "1",
    }), /predicate type mismatch/);
  });
});

describe("package install policy contract", () => {
  it("preserves Windows npm argument boundaries without a command shell", () => {
    const args = ["install", "C:\\path with spaces\\ima2.tgz", "value&literal"];
    const invocation = npmInvocation(args, {
      platform: "win32",
      nodeExecPath: "C:\\Program Files\\nodejs\\node.exe",
      npmExecPath: "C:\\Program Files\\nodejs\\node_modules\\npm\\bin\\npm-cli.js",
    });
    assert.equal(invocation.command, "C:\\Program Files\\nodejs\\node.exe");
    assert.deepEqual(invocation.args.slice(1), args);
    assert.match(invocation.args[0], /npm-cli\.js$/);
  });

  it("detects missing install-script approvals and bundle lock drift", () => {
    const lock = { packages: { "": { bundleDependencies: ["progrok"] }, "node_modules/sharp": { version: "1.2.3", hasInstallScript: true } } };
    assert.deepEqual(validateInstallPolicy({ allowScripts: {} }, lock, "root"), ["root: missing allowScripts approval for sharp@1.2.3"]);
    assert.equal(validateInstallPolicy({ allowScripts: { "sharp@1.2.3": true } }, lock, "root").length, 0);
    assert.equal(validateBundleParity({ bundleDependencies: ["progrok", "openai-oauth"] }, lock).length, 1);
  });

  it("keeps publishing inside the OIDC workflow", () => {
    // The local release scripts are gone: release.yml owns the cut end to end.
    for (const path of ["scripts/release.sh", "scripts/release-preview.sh"]) {
      assert.equal(existsSync(new URL(`../${path}`, import.meta.url)), false, `${path} must not come back`);
    }
    const workflow = readFileSync(new URL("../.github/workflows/publish.yml", import.meta.url), "utf8");
    // workflow_dispatch is how release.yml reaches this workflow, because a GITHUB_TOKEN
    // push emits no event. It cannot widen what may be published: the ref is still
    // classified, and classifyPublish accepts only preview or a matching v* tag.
    assert.match(workflow, /workflow_dispatch:/);
    assert.match(workflow, /publish_ref:/);
    assert.match(workflow, /publish_sha:/);
    assert.doesNotMatch(workflow, /(?:^|\n)on:[\s\S]{0,400}?(?:^|\n)\s{2}release:\s*(?:\n|$)/);
    assert.match(workflow, /branches:\s*\[preview\]/);
    assert.match(workflow, /tags:\s*\['v\*'\]/);
    assert.equal((workflow.match(/id-token:\s*write/g) || []).length, 1, "only publish job may mint OIDC tokens");
    assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d/, "release actions must use immutable commit SHAs");
    assert.match(workflow, /verify-artifact release-artifact\/release-manifest\.json/);
    assert.match(workflow, /TARBALL=.*'\.\/release-artifact\/'[\s\S]*npm publish "\$TARBALL"/);
    assert.match(workflow, /verify-existing:/);
    assert.match(workflow, /windows-consumer:/);
    assert.match(workflow, /needs:\s*\[prepare, package, windows-consumer\]/);
    assert.match(workflow, /test:package-global-update/);
    assert.match(workflow, /assert-remote-ref/);
    assert.match(workflow, /id: registry[\s\S]*guard-publish/);
    assert.match(workflow, /if: steps\.registry\.outputs\.should_publish == 'true'[\s\S]*npm publish/);
    assert.match(workflow, /IMA2_EXPECT_CURRENT_PROVENANCE: \$\{\{ steps\.registry\.outputs\.should_publish \}\}/);
    assert.match(workflow, /create-github-release:/);
    assert.match(workflow, /needs:\s*\[prepare, publish\]/);
    assert.match(workflow, /ensure-github-release/);
    assert.match(workflow, /channel == 'latest'/);
    assert.match(workflow, /permissions:[\s\S]*contents:\s*write[\s\S]*id-token:\s*write/);

    // Every checkout and every contract call must target the ref being released, not the
    // dispatch's default-branch checkout.
    assert.match(workflow, /PUBLISH_REF: \$\{\{ inputs\.publish_ref \|\| github\.ref \}\}/);
    assert.match(workflow, /PUBLISH_SHA: \$\{\{ inputs\.publish_sha \|\| github\.sha \}\}/);
    assert.equal((workflow.match(/ref: \$\{\{ inputs\.publish_sha \|\| github\.sha \}\}/g) || []).length,
      (workflow.match(/actions\/checkout@/g) || []).length,
      "every checkout must pin the published sha");
    assert.doesNotMatch(workflow, /\$GITHUB_SHA|\$GITHUB_REF/, "steps must use the effective PUBLISH_* values");
    assert.match(workflow, /group: publish-\$\{\{ inputs\.publish_ref \|\| github\.ref \}\}/);

    const contract = readFileSync(new URL("../scripts/release-contract.mjs", import.meta.url), "utf8");
    assert.match(contract, /export async function ensureGithubRelease/);
    assert.match(contract, /command === "ensure-github-release"/);
    assert.match(contract, /gh.*release create|release", "create"/);

    const manifest = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    assert.match(manifest.scripts.prepublishOnly, /assert-publish-context/);

    // The ordering invariant survived the move from release.sh into CI: the version
    // commit precedes the preview promotion, and the stable tag follows the npm proof.
    const release = readFileSync(new URL("../.github/workflows/release.yml", import.meta.url), "utf8");
    const preflightIndex = release.indexOf("release-cut.mjs preflight");
    const commitIndex = release.indexOf("release-cut.mjs commit");
    const previewIndex = release.indexOf("refs/heads/preview");
    const proofIndex = release.indexOf("assert-preview-proof");
    const tagIndex = release.indexOf("git tag");
    assert.ok(preflightIndex >= 0 && preflightIndex < commitIndex, "the baseline guard must precede the version commit");
    assert.ok(commitIndex < previewIndex, "the version commit must precede preview promotion");
    assert.ok(previewIndex < proofIndex, "preview must be promoted before its proof is required");
    assert.ok(proofIndex >= 0 && proofIndex < tagIndex, "preview proof must finish before stable tag creation");
    // The cut never publishes and never mints OIDC: publish.yml keeps both.
    assert.doesNotMatch(release, /npm publish/);
    assert.doesNotMatch(release, /^\s+id-token:\s*write/m, "only publish.yml may request an OIDC token");
    assert.doesNotMatch(release, /gh release create/);
    assert.doesNotMatch(release, /uses:\s*[^\s]+@v\d/, "release actions must use immutable commit SHAs");
    assert.match(release, /gh workflow run publish\.yml/);
    assert.match(release, /git push --atomic origin/);

    // The cut guards are pure functions so the policy is testable without a release.
    const cut = readFileSync(new URL("../scripts/release-cut.mjs", import.meta.url), "utf8");
    assert.match(cut, /export function assertBaseline/);
    assert.match(cut, /export function assertCuttable/);
    assert.match(cut, /export function assertPreviewProof/);
    assert.doesNotMatch(cut, /npm publish/);

    // Guards release.sh had before it promoted anything must survive the move to CI.
    assert.match(release, /npm run verify:release/, "the candidate must be verified before it is pushed");
    const verifyIndex = release.indexOf("npm run verify:release");
    assert.ok(verifyIndex < release.indexOf('git push origin "HEAD:refs/heads/main"'), "verification must precede the main push");
    assert.match(release, /release-cut\.mjs assert-clean/);
    assert.match(release, /release-contract\.mjs assert-toolchain/);
    assert.match(release, /release-cut\.mjs assert-remotes-unmoved/);

    for (const path of ["scripts/install-mac.sh", "scripts/install-linux.sh", "scripts/install-windows.ps1"]) {
      const installer = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
      assert.match(installer, /allow-scripts=ima2-gen,better-sqlite3,sharp/);
      assert.match(installer, /ima2 doctor/);
    }
  });

  it("refuses a cut whose baseline, version, or preview proof is not releasable", async () => {
    const { assertBaseline, assertCuttable, assertPreviewProof } = await import("../scripts/release-cut.mjs");
    const yes = () => true;

    assert.deepEqual(assertBaseline({ head: "a", main: "a", dev: "a", preview: "a", contains: yes }), []);
    assert.match(assertBaseline({ head: "a", main: "b", dev: "a", preview: "a", contains: yes }).join(), /origin\/main is b/);
    // A main that does not contain dev would orphan merged work behind the tag.
    assert.match(assertBaseline({ head: "a", main: "a", dev: "z", preview: "a", contains: () => false }).join(), /does not contain origin\/dev/);

    assert.deepEqual(assertCuttable({ version: "3.0.6", publishedVersion: null, remoteTag: "" }), []);
    assert.match(assertCuttable({ version: "3.0.6", publishedVersion: "3.0.6", remoteTag: "" }).join(), /already published/);
    assert.match(assertCuttable({ version: "3.0.6", publishedVersion: null, remoteTag: "abc\trefs/tags/v3.0.6" }).join(), /already exists/);
    assert.match(assertCuttable({ version: "3.0.6-rc.1", publishedVersion: null, remoteTag: "" }).join(), /stable X\.Y\.Z/);

    const proven = { version: "3.0.6", sha: "abc", previewVersion: "3.0.6-preview.260812.1.1", previewGitHead: "abc" };
    assert.deepEqual(assertPreviewProof(proven), []);
    assert.match(assertPreviewProof({ ...proven, previewGitHead: "zzz" }).join(), /does not prove abc/);
    assert.match(assertPreviewProof({ ...proven, previewVersion: "3.0.5-preview.1" }).join(), /not a 3\.0\.6 candidate/);
    // A missing preview build must never read as a proof.
    assert.equal(assertPreviewProof({ ...proven, previewVersion: null, previewGitHead: null }).length, 2);

    const { assertRemotesUnmoved } = await import("../scripts/release-cut.mjs");
    assert.deepEqual(assertRemotesUnmoved({ sha: "abc", main: "abc", preview: "abc" }), []);
    // Someone merging to main while the preview build was being proven must block the tag,
    // because the tag would then certify a SHA that main no longer points at.
    assert.match(assertRemotesUnmoved({ sha: "abc", main: "def", preview: "abc" }).join(), /origin\/main moved to def/);
    assert.match(assertRemotesUnmoved({ sha: "abc", main: "abc", preview: "def" }).join(), /origin\/preview is def/);
  });

  it("waits on the run it dispatched, not on a concurrent one", async () => {
    const { pickRun } = await import("../scripts/wait-publish-run.mjs");
    // The REST run object exposes no `inputs`, so correlation uses the pre-dispatch
    // high-water mark: run ids increase, so the first dispatch above the mark is ours.
    const mark = 100;
    const runs = [
      { databaseId: 99, event: "workflow_dispatch", createdAt: "2026-08-12T11:00:00Z" },  // before the mark
      { databaseId: 101, event: "push", createdAt: "2026-08-12T12:01:00Z" },              // not a dispatch
      { databaseId: 102, event: "workflow_dispatch", createdAt: "2026-08-12T12:02:00Z" }, // ours
      { databaseId: 103, event: "workflow_dispatch", createdAt: "2026-08-12T12:03:00Z" }, // a later release
    ];
    // Oldest above the mark, so a release that starts while we wait is not adopted.
    assert.equal(pickRun(runs, mark)?.databaseId, 102);
    assert.equal(pickRun([runs[0], runs[1]], mark), undefined);
    // Out-of-order listings must not change the answer.
    assert.equal(pickRun([...runs].reverse(), mark)?.databaseId, 102);
  });

  it("keeps build caches out of the index so verification cannot dirty the release", () => {
    // A tracked .tsbuildinfo is rewritten by every UI build, so the release cut's
    // post-verification clean check failed on it (run 31604716464). These files are
    // already gitignored; being tracked as well was an accident.
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" }).split("\n");
    const caches = tracked.filter((path) => /\.tsbuildinfo$/.test(path));
    assert.deepEqual(caches, [], `build caches must not be tracked: ${caches.join(", ")}`);
  });
});
