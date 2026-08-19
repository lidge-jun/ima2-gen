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
import { gypfileNames, validateBundleParity, validateInstallPolicy } from "../scripts/check-install-policy.mjs";
import { npmInvocation } from "../scripts/npm-subprocess.mjs";

const SHA = "a".repeat(40);

function repoRoot() {
  return dirname(dirname(fileURLToPath(import.meta.url)));
}

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

  it("accepts the dispatch host ref only for a dispatched publish", () => {
    // release.yml reaches publish.yml by workflow_dispatch, and a dispatched run
    // always executes on the default branch. npm therefore records
    // refs/heads/main even when the published target is preview or a tag.
    const dispatched: any = {
      _type: "https://in-toto.io/Statement/v1",
      predicateType: "https://slsa.dev/provenance/v1",
      subject: [{ name: "pkg:npm/ima2-gen@2.0.14", digest: { sha512: "digest" } }],
      predicate: {
        buildDefinition: {
          buildType: "https://slsa-framework.github.io/github-actions-buildtypes/workflow/v1",
          externalParameters: { workflow: { repository: "https://github.com/lidge-jun/ima2-gen", path: ".github/workflows/publish.yml", ref: "refs/heads/main" } },
          internalParameters: { github: { event_name: "workflow_dispatch" } },
          resolvedDependencies: [{ digest: { gitCommit: SHA } }],
        },
        runDetails: {
          builder: { id: "https://github.com/actions/runner/github-hosted" },
          metadata: { invocationId: "https://github.com/lidge-jun/ima2-gen/actions/runs/1/attempts/1" },
        },
      },
    };
    const expected = { ref: "refs/heads/preview", sha: SHA, sha512: "digest", version: "2.0.14", runId: "1", runAttempt: "1" };
    assert.deepEqual(validateProvenance(dispatched, expected).runId, "1");

    // The relaxation is scoped to the default branch. Any other ref still fails,
    // so a dispatched run cannot claim an arbitrary source.
    dispatched.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/attacker";
    assert.throws(() => validateProvenance(dispatched, expected), /source ref mismatch/);

    // A push must still match the publish target exactly: no host-ref fallback.
    dispatched.predicate.buildDefinition.externalParameters.workflow.ref = "refs/heads/main";
    dispatched.predicate.buildDefinition.internalParameters.github.event_name = "push";
    assert.throws(() => validateProvenance(dispatched, expected), /source ref mismatch/);

    // The commit is the real binding and stays exact under dispatch.
    dispatched.predicate.buildDefinition.internalParameters.github.event_name = "workflow_dispatch";
    dispatched.predicate.buildDefinition.resolvedDependencies = [{ digest: { gitCommit: "b".repeat(40) } }];
    assert.throws(() => validateProvenance(dispatched, expected), /source commit mismatch/);

    // An unexpected trigger is refused outright.
    dispatched.predicate.buildDefinition.resolvedDependencies = [{ digest: { gitCommit: SHA } }];
    dispatched.predicate.buildDefinition.internalParameters.github.event_name = "pull_request";
    assert.throws(() => validateProvenance(dispatched, expected), /event mismatch/);
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

  it("accepts a name-only approval across a version bump", () => {
    // Version-pinned approvals go stale on every dependency bump, which is how
    // #135 and #137 both went red. Name-only entries absorb the drift; npm
    // itself writes them when approving without --allow-scripts-pin.
    const before = { packages: { "": {}, "node_modules/sharp": { version: "1.2.3", hasInstallScript: true } } };
    const after = { packages: { "": {}, "node_modules/sharp": { version: "2.0.0", hasInstallScript: true } } };
    const nameOnly = { allowScripts: { sharp: true } };

    assert.deepEqual(validateInstallPolicy(nameOnly, before, "root"), []);
    assert.deepEqual(validateInstallPolicy(nameOnly, after, "root"), []);

    // Control: the pinned form must still break on the same bump. If this stops
    // failing, the stale check itself died and the name-only switch above would
    // be proving nothing.
    assert.deepEqual(validateInstallPolicy({ allowScripts: { "sharp@1.2.3": true } }, after, "root"), [
      "root: missing allowScripts approval for sharp@2.0.0",
      "root: stale allowScripts approval sharp@1.2.3",
    ]);
  });

  it("still rejects an approval for a package that is not installed", () => {
    // Name-only approvals must not turn the stale check into a no-op: an entry
    // for a package the lockfile never mentions is still dead weight.
    const lock = { packages: { "": {}, "node_modules/sharp": { version: "1.2.3", hasInstallScript: true } } };
    assert.deepEqual(validateInstallPolicy({ allowScripts: { sharp: true, ghost: true } }, lock, "root"), [
      "root: stale allowScripts approval ghost",
    ]);
  });

  it("covers every copy of a hoisted dependency with one name-only entry", () => {
    // ui/package-lock.json really does carry two fsevents copies (2.3.2 under a
    // nested tree, 2.3.3 at the top). Pinning meant listing both and updating
    // both; one name-only entry covers whatever the tree ends up holding.
    const lock = {
      packages: {
        "": {},
        "node_modules/fsevents": { version: "2.3.3", hasInstallScript: true },
        "node_modules/vite/node_modules/fsevents": { version: "2.3.2", hasInstallScript: true },
        "node_modules/esbuild": { version: "0.28.1", hasInstallScript: true },
      },
    };
    assert.deepEqual(validateInstallPolicy({ allowScripts: { fsevents: true, esbuild: true } }, lock, "ui"), []);
  });

  it("treats a gypfile package as needing approval even without hasInstallScript", () => {
    // better-sqlite3 13 moved to prebuilt binaries and dropped its install hook,
    // so the lockfile records no hasInstallScript - but binding.gyp is still in
    // the tarball and npm will still consider running node-gyp. Asking npm
    // directly is circular: approve-scripts reports only what is not yet
    // approved, so its answer depends on the manifest under validation.
    const lock = { packages: { "": {}, "node_modules/better-sqlite3": { version: "13.0.3" } } };
    assert.deepEqual(validateInstallPolicy({ allowScripts: { "better-sqlite3": true } }, lock, "root", ["better-sqlite3"]), []);
    assert.deepEqual(validateInstallPolicy({ allowScripts: {} }, lock, "root", ["better-sqlite3"]), [
      "root: missing allowScripts approval for better-sqlite3@13.0.3",
    ]);
  });

  it("does not let the gypfile allowance excuse an unrelated approval", () => {
    // The allowance keys off a real binding.gyp on disk, so approving a package
    // that ships no install script and no gypfile is still dead weight - even
    // when the lockfile carries it.
    const lock = { packages: { "": {}, "node_modules/express": { version: "5.1.0" }, "node_modules/better-sqlite3": { version: "13.0.3" } } };
    assert.deepEqual(validateInstallPolicy({ allowScripts: { express: true } }, lock, "root", ["better-sqlite3"]), [
      "root: missing allowScripts approval for better-sqlite3@13.0.3",
      "root: stale allowScripts approval express",
    ]);
    assert.deepEqual(validateInstallPolicy({ allowScripts: { ghost: true } }, lock, "root", []), [
      "root: stale allowScripts approval ghost",
    ]);
  });

  it("refuses to probe for gypfiles without an installed tree", () => {
    // gypfileNames reads node_modules. On an uninstalled checkout it would find
    // nothing and quietly turn every real approval into a stale one, so the
    // absence has to be an error rather than an empty answer.
    assert.throws(
      () => gypfileNames(join(tmpdir(), "ima2-install-policy-absent"), { packages: { "": {} } }),
      /needs an installed tree/,
    );
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
    // Three, not two: the old single publish job is now publish-preview and
    // publish-stable so each channel can carry its own approval environment.
    // The count still matters — it is what stops a fourth job from quietly
    // gaining the ability to publish.
    assert.equal(
      (workflow.match(/id-token:\s*write/g) || []).length,
      3,
      "only publish-preview, publish-stable, and create-github-release may mint OIDC tokens",
    );
    // Each publish lane must be pinned to its own environment, or the split
    // buys nothing: an unpinned stable job would publish without approval.
    assert.match(workflow, /publish-preview:[\s\S]{0,600}?name: npm-preview/);
    assert.match(workflow, /publish-stable:[\s\S]{0,900}?name: npm-stable/);
    assert.match(workflow, /publish-stable:[\s\S]{0,700}?channel == 'latest'/);
    assert.match(workflow, /publish-preview:[\s\S]{0,300}?channel == 'preview'/);
    assert.match(workflow, /create-github-release:[\s\S]*id-token:\s*write[\s\S]*attestations:\s*write/);
    assert.match(workflow, /actions\/attest-build-provenance@4d101475d8b20a2381f78447822ac1eab6504dd8/);
    assert.doesNotMatch(workflow, /package:[\s\S]{0,400}id-token:\s*write/, "package job stays OIDC-free");
    assert.doesNotMatch(workflow, /uses:\s*[^\s]+@v\d/, "release actions must use immutable commit SHAs");
    assert.match(workflow, /verify-artifact release-artifact\/release-manifest\.json/);
    assert.match(workflow, /TARBALL=.*'\.\/release-artifact\/'[\s\S]*npm publish "\$TARBALL"/);
    assert.match(workflow, /verify-existing:/);
    assert.match(workflow, /windows-consumer:/);
    // 260819 release-speed unit: windows-consumer runs on the preview lane
    // only. The stable lane's evidence is the preview proof — prepare verifies
    // the npm preview's gitHead equals the publish sha, and that preview could
    // only publish after this matrix passed. That inference lives in the four
    // job-scoped pins below; a global needs regex would stay green while the
    // stable lane silently lost its dependency.
    // (a) The load-bearing pin: preview CANNOT publish without the matrix.
    assert.match(
      workflow,
      /publish-preview:\s*\n\s*needs:\s*\[prepare, package, windows-consumer\]/,
      "publish-preview must depend on windows-consumer — the stable lane's skip is only safe while this holds",
    );
    // (b) The matrix is scoped to the preview channel.
    assert.match(
      workflow,
      /windows-consumer:[\s\S]{0,600}?channel == 'preview'/,
      "windows-consumer must be preview-only",
    );
    // (c) Stable keeps the dependency edge and tolerates the skipped need
    //     without accepting a failed one.
    assert.match(
      workflow,
      /publish-stable:\s*\n\s*needs:\s*\[prepare, package, windows-consumer\]/,
      "publish-stable must keep its needs edge",
    );
    const stableBlock = workflow.slice(
      workflow.indexOf("publish-stable:"),
      workflow.indexOf("create-github-release:"),
    );
    assert.match(stableBlock, /!failure\(\) && !cancelled\(\)/, "publish-stable must accept a skipped windows-consumer");
    // (d) Never always(): a failed package job must still block the publish.
    assert.doesNotMatch(stableBlock, /always\(\)/, "publish-stable must not run over failures");
    // (e) success() is transitive over the needs chain, so every job downstream
    //     of the skipped windows-consumer needs the same override, gated on its
    //     direct publish need actually succeeding. Measured failure mode on the
    //     v3.7.1 cut: tag published, GitHub Release job silently skipped.
    const ghReleaseBlock = workflow.slice(workflow.indexOf("create-github-release:"));
    assert.match(
      ghReleaseBlock,
      /!failure\(\) && !cancelled\(\)[\s\S]{0,200}?needs\.publish-stable\.result == 'success'/,
      "create-github-release must tolerate the skipped matrix but require a successful stable publish",
    );
    assert.match(workflow, /test:package-global-update/);
    assert.match(workflow, /assert-remote-ref/);
    assert.match(workflow, /id: registry[\s\S]*guard-publish/);
    assert.match(workflow, /if: steps\.registry\.outputs\.should_publish == 'true'[\s\S]*npm publish/);
    assert.match(workflow, /IMA2_EXPECT_CURRENT_PROVENANCE: \$\{\{ steps\.registry\.outputs\.should_publish \}\}/);
    assert.match(workflow, /create-github-release:/);
    // The GitHub Release must follow the stable publish specifically. Pointing
    // it at publish-preview, or at nothing, would let a Release appear for a
    // version npm never accepted.
    assert.match(workflow, /needs:\s*\[prepare, publish-stable\]/);
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

  it("keeps generated .js out of the index when its .ts source is tracked", () => {
    // Tracked build output drifts from its tracked source and dirties the release
    // verification worktree (run 31604716464 class of failure). ui/ and vendor/
    // keep their own checked-in artifacts and are out of scope here.
    const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
    const tracked = execFileSync("git", ["ls-files"], { cwd: repoRoot, encoding: "utf8" })
      .split("\n")
      .filter(Boolean);
    const trackedSet = new Set(tracked);
    const paired = tracked.filter(
      (path) =>
        path.endsWith(".js") &&
        !/^(ui\/|vendor\/|node_modules)/.test(path) &&
        trackedSet.has(path.replace(/\.js$/, ".ts")),
    );
    assert.deepEqual(paired, [], `generated files must not be tracked: ${paired.join(", ")}`);
  });

  it("maps every release script to an explicit bump/dry_run pair", () => {
    // c1b: a missing or wrong dry_run flag turns a release command into a silent
    // no-op (or a dry dispatch into a real release). Assert exact strings.
    const pkg = JSON.parse(readFileSync(join(repoRoot(), "package.json"), "utf8"));
    assert.equal(pkg.scripts["release:dry"], "gh workflow run release.yml -f bump=patch -f dry_run=true");
    assert.equal(pkg.scripts["release:canary"], "gh workflow run release.yml -f bump=patch -f dry_run=canary");
    assert.equal(pkg.scripts["release:patch"], "gh workflow run release.yml -f bump=patch -f dry_run=false");
    assert.equal(pkg.scripts["release:minor"], "gh workflow run release.yml -f bump=minor -f dry_run=false");
    assert.equal(pkg.scripts["release:major"], "gh workflow run release.yml -f bump=major -f dry_run=false");
  });

  it("gates the tag job on a real release and keeps the candidate ref leased", () => {
    const workflow = readFileSync(join(repoRoot(), ".github/workflows/release.yml"), "utf8");
    // The most dangerous dry-run failure mode: tag has only `needs: cut`, so a
    // missing or permissive job-level if performs a real release. It must be
    // == 'false' (not != 'true') so canary cannot slip through.
    assert.match(workflow, /if: needs\.cut\.outputs\.dry_run == 'false'/);
    assert.doesNotMatch(workflow, /if: needs\.cut\.outputs\.dry_run != 'true'/);
    // The workflow default must be the harmless mode.
    assert.match(workflow, /dry_run:[\s\S]*?default: 'true'/);
    // Candidate ref: leased replacement and owned cleanup.
    assert.match(workflow, /--force-with-lease="refs\/heads\/release-candidate:/);
    assert.match(workflow, /\[ "\$CURRENT" = "\$CANDIDATE_SHA" \]/);
    // The CI gate must run before main moves.
    const gateIndex = workflow.indexOf("Dispatch CI for the exact candidate SHA");
    const mainPushIndex = workflow.indexOf("Push the version commit to main");
    assert.ok(gateIndex > -1 && mainPushIndex > -1 && gateIndex < mainPushIndex);
  });

  it("ci.yml checks out the dispatched SHA and asserts it", () => {
    const ci = readFileSync(join(repoRoot(), ".github/workflows/ci.yml"), "utf8");
    assert.match(ci, /workflow_dispatch:[\s\S]*?sha:/);
    assert.match(ci, /ref: \$\{\{ github\.event\.inputs\.sha \|\| github\.sha \}\}/);
    assert.match(ci, /git rev-parse HEAD/);
  });

  it("ci gate correlates runs by full candidate SHA only", async () => {
    const { pickRun, assertFullSha } = await import("../scripts/wait-ci-gate.mjs");
    const sha = "b".repeat(40);
    assert.throws(() => assertFullSha(sha.slice(0, 7)), /full 40-char SHA/);
    const runs = [
      { databaseId: 10, event: "workflow_dispatch", headSha: sha },           // before mark
      { databaseId: 11, event: "push", headSha: sha },                        // not a dispatch
      { databaseId: 12, event: "workflow_dispatch", headSha: "c".repeat(40) }, // different SHA
      { databaseId: 13, event: "workflow_dispatch", headSha: sha },           // ours
    ];
    assert.equal(pickRun(runs, 10, sha)?.databaseId, 13);
    assert.equal(pickRun(runs, 10, "d".repeat(40)), undefined);
  });
});
