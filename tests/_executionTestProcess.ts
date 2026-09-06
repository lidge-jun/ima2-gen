import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

/** No credentials, home/config roots, or ambient Node loader flags cross this boundary. */
export function executionChildEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const key of ["PATH", "Path", "SystemRoot", "WINDIR", "TEMP", "TMP", "TMPDIR", "LANG", "TZ"]) {
    if (process.env[key] !== undefined) env[key] = process.env[key];
  }
  return env;
}

export function executionTestProcess(url: string): boolean {
  if (process.env.EXECUTION_TEST_FILE === url && process.execArgv.includes("--experimental-test-module-mocks")) {
    if (process.platform === "win32") delete process.env.USERPROFILE;
    return true;
  }
  test(`isolated execution fixture: ${fileURLToPath(url)}`, { timeout: 65_000 }, async (t) => {
    const child = spawn(process.execPath, ["--experimental-test-module-mocks", "--import", "tsx", "--test", fileURLToPath(url)], {
      env: { ...executionChildEnv(), EXECUTION_TEST_FILE: url }, stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    const timer = setTimeout(() => child.kill("SIGKILL"), 60_000);
    try {
      const result = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
        child.once("error", reject);
        child.once("close", (code, signal) => resolve({ code, signal }));
      });
      t.diagnostic(output);
      assert.equal(result.signal, null, `fixture killed/timed out: ${output}`);
      assert.equal(result.code, 0, output);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
  });
  return false;
}
