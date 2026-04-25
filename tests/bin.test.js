import { describe, it, before, after } from "node:test";
import assert from "node:assert";
import { spawn } from "child_process";
import { writeFileSync, mkdirSync, rmSync, existsSync, mkdtempSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const TEST_DIR = join(process.cwd(), "tests", "tmp");
const TEST_CONFIG = join(TEST_DIR, "config.json");
const FAKE_HOME = mkdtempSync(join(tmpdir(), "ima2-bin-home-"));

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runCLI(args = []) {
  return new Promise((resolve) => {
    const child = spawn("node", ["bin/ima2.js", ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: FAKE_HOME,
        USERPROFILE: FAKE_HOME,
        IMA2_CONFIG_DIR: TEST_DIR,
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

describe("ima2 CLI", () => {
  before(() => {
    if (!existsSync(TEST_DIR)) mkdirSync(TEST_DIR, { recursive: true });
  });

  after(() => {
    if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true, force: true });
    if (existsSync(FAKE_HOME)) rmSync(FAKE_HOME, { recursive: true, force: true });
  });

  it("should show help when no command given", async () => {
    const { stdout } = await runCLI([]);
    assert.ok(stdout.includes("Usage:"), "help should include Usage");
    assert.ok(stdout.includes("serve"), "help should mention serve");
    assert.ok(stdout.includes("status"), "help should mention status");
    assert.ok(stdout.includes("doctor"), "help should mention doctor");
  });

  it("should show help with --help", async () => {
    const { stdout, code } = await runCLI(["--help"]);
    assert.strictEqual(code, 0, "--help should exit 0");
    assert.ok(stdout.includes("commands:"), "help should list commands");
    assert.ok(stdout.includes("version"), "help should mention version");
  });

  it("should show version with --version", async () => {
    const { stdout, code } = await runCLI(["--version"]);
    assert.strictEqual(code, 0, "--version should exit 0");
    assert.ok(/^\d+\.\d+\.\d+/.test(stdout.trim()), "version should be semver");
  });

  it("should show version with -v", async () => {
    const { stdout, code } = await runCLI(["-v"]);
    assert.strictEqual(code, 0, "-v should exit 0");
    assert.ok(/^\d+\.\d+\.\d+/.test(stdout.trim()), "-v should show semver");
  });

  it("should show status", async () => {
    const { stdout } = await runCLI(["status"]);
    assert.ok(stdout.includes("ima2-gen"), "status should show name");
    assert.ok(stdout.includes("Config file"), "status should mention config");
  });

  it("should run doctor", async () => {
    const { stdout, code } = await runCLI(["doctor"]);
    assert.ok(stdout.includes("Doctor"), "doctor should show header");
    assert.ok(stdout.includes(">= 20"), "doctor should report package Node requirement");
    assert.ok(stdout.includes("Storage"), "doctor should show storage section");
    assert.ok(stdout.includes("passed") || stdout.includes("failed"), "doctor should show results");
    // doctor exits 0 if all ok, 1 if failures
    assert.ok(code === 0 || code === 1, "doctor should exit 0 or 1");
  });

  it("should handle unknown command", async () => {
    const { stdout, code } = await runCLI(["foobar"]);
    assert.strictEqual(code, 1, "unknown command should exit 1");
    assert.ok(stdout.includes("Unknown command"), "should report unknown");
  });

  it("should reset config file", async () => {
    writeFileSync(TEST_CONFIG, JSON.stringify({ provider: "api", apiKey: "test" }));
    assert.ok(existsSync(TEST_CONFIG));

    const child = spawn("node", ["bin/ima2.js", "reset"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        HOME: FAKE_HOME,
        USERPROFILE: FAKE_HOME,
        IMA2_CONFIG_DIR: TEST_DIR,
      },
    });
    await new Promise((resolve) => child.on("close", resolve));

    // reset now honors IMA2_CONFIG_DIR → file content is `{}`
    const { readFileSync } = await import("fs");
    const content = readFileSync(TEST_CONFIG, "utf-8");
    assert.strictEqual(content.trim(), "{}", "reset should empty config file");
  });

  it("should reject invalid command", async () => {
    const { stdout } = await runCLI(["invalid"]);
    assert.ok(stdout.includes("Unknown command"), "invalid cmd shows error");
  });
});
