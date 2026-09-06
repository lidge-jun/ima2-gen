import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const scripts = ["install-mac.sh", "install-linux.sh"].map((name) =>
  readFileSync(join(process.cwd(), "scripts", name), "utf8"),
);
const minimumNodeMajor = Number(JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")).engines.node.match(/\d+/)[0]);

test("POSIX installers encode the generated runtime and safe execution order", () => {
  for (const script of scripts) {
    assert.match(script, new RegExp(`# runtime-contract:generated:start[\\s\\S]*MIN_NODE=${minimumNodeMajor}[\\s\\S]*# runtime-contract:generated:end`));
    assert.doesNotMatch(script, /pkill|pgrep|sudo|npm cache clean/);
    assert.match(script, /npm \"\$\{INSTALL_ARGS\[@\]\}\"/);
    assert.doesNotMatch(script, /npm \"\$\{INSTALL_ARGS\[@\]\}\"[\s\S]*npm \"\$\{INSTALL_ARGS\[@\]\}\"/);
    assert.match(script, /ima2 doctor --installation --json/);
    assert.match(script, /doctor --installation --json[\s\S]*ok "Runtime dependencies verified"[\s\S]*exec ima2 serve/);
  }
});

function scenarioValues(name: string) {
  return { name, node: `v${name === "node20" ? 20 : name === "floor24" ? 22 : minimumNodeMajor}.0.0`,
    floor: name === "floor24" ? 24 : minimumNodeMajor, npm: name === "success-npm12" ? "12.0.0" : "11.18.0",
    npmExit: name.startsWith("npm-") ? 7 : 0, doctorExit: name === "doctor-failure" ? 8 : 0 };
}

function posixFixture(root: string, source: string, value: ReturnType<typeof scenarioValues>) {
  const bin = join(root, "bin"); mkdirSync(bin);
  const commands: Record<string, string> = {
    node: `printf 'node %s\\n' "$*" >> "$IMA2_FIXTURE_LOG"\nprintf '%s\\n' '${value.node}'\nexit 0`,
    npm: `printf 'npm %s\\n' "$*" >> "$IMA2_FIXTURE_LOG"\ncase "$1" in\n--version) printf '%s\\n' '${value.npm}'; exit 0;;\ninstall) printf '%s\\n' '${value.name}' >&2; exit ${value.npmExit};;\n*) exit 97;;\nesac`,
    ima2: `printf 'ima2 %s\\n' "$*" >> "$IMA2_FIXTURE_LOG"\ncase "$*" in\n'--version') printf '0.0.0\\n'; exit 0;;\n'doctor --installation --json') printf '{}\\n'; exit ${value.doctorExit};;\n'serve') exit 0;;\n*) exit 97;;\nesac`,
  };
  for (const name of ["pgrep", "pkill", "sudo", "curl", "brew", "nvm", "fnm"]) {
    commands[name] = `printf 'forbidden %s\\n' '${name}' >> "$IMA2_FIXTURE_LOG"\nexit 97`;
  }
  for (const [name, body] of Object.entries(commands)) { const path = join(bin, name); writeFileSync(path, `#!/bin/sh\n${body}\n`); chmodSync(path, 0o755); }
  const script = join(root, "installer.sh");
  writeFileSync(script, source.replace(/MIN_NODE=\d+/, `MIN_NODE=${value.floor}`));
  return { command: "bash", args: [script], path: `${bin}:/usr/bin:/bin` };
}

function windowsFixture(root: string, source: string, value: ReturnType<typeof scenarioValues>) {
  const installer = join(root, "installer.ps1"), fixture = join(root, "fixture.ps1");
  writeFileSync(installer, source.replace(/\$MIN_NODE = \d+/, `$MIN_NODE = ${value.floor}`));
  const forbidden = ["Get-Process", "Stop-Process", "Remove-Item", "Start-Process", "Invoke-WebRequest", "Invoke-RestMethod"]
    .map((name) => `function ${name} { Add-Content $env:IMA2_FIXTURE_LOG 'forbidden ${name}'; throw 'Forbidden fixture operation' }`).join("\n");
  writeFileSync(fixture, `
function node { Add-Content $env:IMA2_FIXTURE_LOG ("node " + ($args -join ' ')); $global:LASTEXITCODE = 0; '${value.node}' }
function npm {
  Add-Content $env:IMA2_FIXTURE_LOG ("npm " + ($args -join ' '))
  if ($args[0] -eq '--version') { $global:LASTEXITCODE = 0; '${value.npm}'; return }
  if ($args[0] -eq 'install') { $global:LASTEXITCODE = ${value.npmExit}; '${value.name}'; return }
  $global:LASTEXITCODE = 97
}
function ima2 {
  Add-Content $env:IMA2_FIXTURE_LOG ("ima2 " + ($args -join ' '))
  $global:LASTEXITCODE = 0
  if ($args[0] -eq 'doctor') { $global:LASTEXITCODE = ${value.doctorExit}; '{}'; return }
  if ($args[0] -eq '--version') { '0.0.0' }
}
${forbidden}
& '${installer.replaceAll("'", "''")}'
exit $LASTEXITCODE
`);
  return { command: "powershell.exe", args: ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", fixture], path: process.env.PATH };
}

async function verifyScenario(source: string, name: string, installer: string) {
  const root = mkdtempSync(join(tmpdir(), "ima2-install-fixture-")), log = join(root, "calls.log");
  const sentinel = spawn(process.execPath, ["-e", "setInterval(() => {}, 1000)"], { stdio: "ignore" });
  try {
    await once(sentinel, "spawn"); assert.ok(sentinel.pid); process.kill(sentinel.pid, 0);
    const value = scenarioValues(name), fixture = process.platform === "win32" ? windowsFixture(root, source, value) : posixFixture(root, source, value);
    const result = spawnSync(fixture.command, fixture.args, { encoding: "utf8", timeout: 10_000, maxBuffer: 1024 * 1024,
      env: { ...process.env, PATH: fixture.path, IMA2_FIXTURE_LOG: log } });
    assert.equal(result.error, undefined, `${name}: bounded child execution`);
    const calls = readFileSync(log, "utf8").replace(/\r/g, "").trim().split("\n");
    assert.ok(calls.every((call) => !call.startsWith("forbidden "))); process.kill(sentinel.pid, 0);
    const unsupported = name === "node20" || name === "floor24", installed = !unsupported && !value.npmExit;
    assert.equal(calls.filter((call) => call.startsWith("npm install ")).length, unsupported ? 0 : 1);
    if (unsupported) assert.ok(calls.every((call) => !call.startsWith("npm ")));
    assert.equal(calls.includes("ima2 doctor --installation --json"), installed);
    assert.equal(calls.includes("ima2 serve"), installed && !value.doctorExit);
    assert.equal(result.status, installed && !value.doctorExit ? 0 : 1, `${name}: ${result.stdout}\n${result.stderr}`);
    if (name === "success-npm12") assert.ok(calls.includes("npm install -g ima2-gen --allow-scripts=ima2-gen,better-sqlite3,sharp"));
    console.log(JSON.stringify({ installer, installerPlatform: process.platform, scenario: name, node: value.node, floor: value.floor, calls, sentinelAlive: true, exitCode: result.status }));
  } finally {
    if (sentinel.pid && sentinel.exitCode === null) { const stopped = once(sentinel, "exit"); sentinel.kill("SIGKILL"); await stopped; }
    rmSync(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
  }
}

test("hosted installers execute bounded scenarios without collateral operations", {
  skip: process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_ENVIRONMENT !== "github-hosted" ? "Actual installer fixtures require a GitHub-hosted runner" : false,
  timeout: 120_000,
}, async () => {
  const sources = process.platform === "win32" ? [readFileSync("scripts/install-windows.ps1", "utf8")] : scripts;
  for (const [index, source] of sources.entries()) for (const name of ["node20", "floor24", "npm-EBUSY", "npm-EPERM", "npm-failure", "doctor-failure", "success", "success-npm12"]) {
    const installer = process.platform === "win32" ? "install-windows.ps1" : index === 0 ? "install-mac.sh" : "install-linux.sh";
    await verifyScenario(source, name, installer);
  }
});
