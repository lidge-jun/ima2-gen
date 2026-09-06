import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { beginUiBuild, finishUiBuild, abortUiBuild } from "./lib/uiBuildReceipt.mjs";
import { fixtureCompilerEnvironment } from "./lib/uiBuildReceiptFiles.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const uiRoot = resolve(repoRoot, "ui");
const uiRequire = createRequire(resolve(uiRoot, "package.json"));
const run = promisify(execFile);
let transaction;
try {
  if (process.argv.length !== 2) throw Object.assign(new Error("UI_RECEIPT_ARGS"), { code: "UI_RECEIPT_ARGS" });
  const env = fixtureCompilerEnvironment();
  transaction = await beginUiBuild(repoRoot);
  const tsc = uiRequire.resolve("typescript/bin/tsc");
  const vite = resolve(dirname(uiRequire.resolve("vite/package.json")), "bin/vite.js");
  for (const args of [[tsc, "-b"], [tsc, "-p", "tsconfig.e2e.json", "--noEmit"], [vite, "build"]]) {
    await run(process.execPath, args, { cwd: uiRoot, env, maxBuffer: 8 * 1024 * 1024,
      timeout: 120_000, killSignal: "SIGKILL" });
  }
  const receipt = await finishUiBuild(repoRoot, transaction);
  console.log(JSON.stringify({ path: "ui/dist/.ima2-ui-build-receipt.json", outputs: receipt.outputs.length,
    binding: receipt.headSha ? "git-and-source" : "source-digest" }));
} catch (error) {
  console.error(typeof error?.code === "string" && /^UI_RECEIPT_[A-Z_]+$/.test(error.code) ? error.code : "UI_RECEIPT_IO");
  process.exitCode = 1;
} finally {
  if (transaction) {
    try { await abortUiBuild(repoRoot, transaction); }
    catch { console.error("UI_RECEIPT_CLEANUP"); process.exitCode = 1; }
  }
}
