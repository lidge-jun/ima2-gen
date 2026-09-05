import assert from "node:assert/strict";
import childProcess from "node:child_process";
import dns from "node:dns";
import dnsPromises from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import dgram from "node:dgram";
import { syncBuiltinESMExports } from "node:module";
import { createHash } from "node:crypto";
import { appendFileSync } from "node:fs";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, relative } from "node:path";

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=";
const root = process.env.HOME;
const artifactPath = join(root, ".gemini", "antigravity-cli", "brain", "artifact", "ima2_generated.png");
// Separate receipts keep native stdout/stderr and parser fallback activation truthful.
const receipt = (event, values = {}) => {
  const value = { event, pid: process.pid, ...values };
  appendFileSync(join(root, "agy-observations.jsonl"), `${JSON.stringify(value)}\n`);
  assert.equal(typeof process.send, "function", "Owned fixture requires its private receipt channel");
  process.send({ channel: "agy-fixture", receipt: value }, error => {
    if (error) process.exitCode = 90;
  });
};

function installDenials() {
  const deny = (name) => () => {
    receipt("violation", { channel: name });
    throw new Error(`Fixture child forbids ${name}`);
  };
  globalThis.fetch = deny("fetch");
  for (const name of ["spawn", "spawnSync", "exec", "execSync", "execFile", "execFileSync", "fork"]) {
    childProcess[name] = deny(name);
  }
  for (const target of [dns, dnsPromises]) {
    for (const name of Object.keys(target)) if (/^(lookup|resolve|reverse)/.test(name)) target[name] = deny(name);
    for (const name of Object.getOwnPropertyNames(target.Resolver.prototype)) {
      if (/^(resolve|reverse)/.test(name)) target.Resolver.prototype[name] = deny(name);
    }
  }
  for (const [target, names] of [[http, ["request", "get"]], [https, ["request", "get"]],
    [net, ["connect", "createConnection"]], [net.Socket.prototype, ["connect"]],
    [tls, ["connect"]], [dgram, ["createSocket"]]]) {
    for (const name of names) target[name] = deny(name);
  }
  syncBuiltinESMExports();
}

function assertOwned(path) {
  const rel = relative(root, path);
  assert.ok(isAbsolute(path) && rel && !rel.startsWith("..") && !isAbsolute(rel), "Fixture path outside owned root");
}

async function input() {
  try {
    let prompt = "";
    for await (const chunk of process.stdin) prompt += chunk.toString();
    const pathsLine = prompt.split("\n").find((line) => line.startsWith("  ImagePaths: "));
    const promptLine = prompt.split("\n").find((line) => line.startsWith("  Prompt: "));
    assert.ok(pathsLine && promptLine, "Missing literal prompt fields");
    const paths = JSON.parse(pathsLine.slice("  ImagePaths: ".length));
    assert.ok(Array.isArray(paths));
    const hashes = [];
    for (const path of paths) {
      assertOwned(path); assertOwned(await realpath(path));
      hashes.push(createHash("sha256").update(await readFile(path)).digest("hex"));
    }
    receipt("input", { paths, hashes, prompt: JSON.parse(promptLine.slice("  Prompt: ".length)),
      fullPrompt: prompt, artifactPath });
  } catch (error) { throw error; }
}

async function emitResult(scenario) {
  try {
    if (["success", "stderr-result", "saved-path", "malformed-result", "error", "quota",
      "unparseable-with-recent-artifact"].includes(scenario)) {
      await mkdir(dirname(artifactPath), { recursive: true });
      await writeFile(artifactPath, Buffer.from(PNG, "base64"));
    }
    const output = {
      success: `RESULT|${artifactPath}|png`, "stderr-result": `RESULT|${artifactPath}|png`,
      "saved-path": `SAVED_PATH=${artifactPath}`, "malformed-result": "RESULT|",
      "no-artifact": `RESULT|${artifactPath}|png`, unparseable: "no parseable output",
      "unparseable-with-recent-artifact": "no parseable output",
      error: "ERROR|fixture generation rejected", quota: "ERROR|Resource exhausted: fixture quota",
      "raw-quota": "resource exhausted: raw fixture quota",
      "outside-path": `RESULT|${join(root, "..", "outside-agy-fixture.png")}|png`,
    };
    if (scenario === "nonzero") { process.stderr.write("fixture stderr diagnostic\n"); process.exitCode = 7; return; }
    assert.ok(Object.hasOwn(output, scenario), "Unsupported result scenario");
    if (scenario === "stderr-result") process.stderr.write(`${output[scenario]}\n`);
    else process.stdout.write(`${output[scenario]}\n`);
  } catch (error) { throw error; }
}

async function main() {
  try {
    installDenials();
    assert.deepEqual(process.argv.slice(2), ["-p", "-"]);
    for (const key of ["HOME", "USERPROFILE", "TMPDIR", "TEMP"]) assert.equal(process.env[key], root);
    assert.equal(process.cwd(), root);
    assert.equal(Object.keys(process.env).some((key) => /KEY|TOKEN|CREDENTIAL|NODE_OPTIONS/i.test(key)), false);
    const controlPath = join(root, "agy-control.json");
    assertOwned(controlPath); assertOwned(await realpath(controlPath));
    const { scenario } = JSON.parse(await readFile(controlPath, "utf8"));
    await input();
    if (scenario === "cooperative-wait" || scenario === "term-ignored-wait") {
      const heartbeat = setInterval(() => {}, 1000);
      process.on("SIGTERM", () => {
        receipt("term");
        if (scenario === "cooperative-wait") clearInterval(heartbeat);
      });
      receipt("ready", { scenario });
      return;
    }
    receipt("ready", { scenario });
    await emitResult(scenario);
  } catch (error) { receipt("fixture-error", { message: String(error) }); process.exitCode = 90; }
}

await main();
