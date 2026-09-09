#!/usr/bin/env node
// Strict QA gate for Grok video (T2V/I2V) shipping.
//
// Stages (run all by default, or a subset via --stage):
//   static : typecheck, typecheck:tests, build:server, build:cli, git diff --check
//   tests  : targeted video test files (node:test + tsx)
//   smoke  : live T2V + I2V generations x N against a running server, each
//            validated with ffprobe; I2V additionally asserts the output's
//            first frame preserves the source image (dHash hamming distance).
//
// The smoke stage targets an ALREADY-RUNNING server (ima2 serve, signed in to
// xAI via `ima2 grok login`).
// Base URL is auto-detected from the advertise file, or pass --base-url.
//
// Usage:
//   node scripts/qa-grok-video.mjs                 # all stages, 3 runs each
//   node scripts/qa-grok-video.mjs --stage=smoke --runs=3
//   node scripts/qa-grok-video.mjs --stage=static
//   node scripts/qa-grok-video.mjs --source=<file.png> --max-hamming=20

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "../config.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..");

function parseArgs(argv) {
  const a = { stage: "all", runs: 3, duration: 1, resolution: "480p", maxHamming: 20, baseUrl: "", source: "" };
  for (const raw of argv.slice(2)) {
    const m = /^--([^=]+)=(.*)$/.exec(raw);
    if (!m) continue;
    const [, k, v] = m;
    if (k === "stage") a.stage = v;
    else if (k === "runs") a.runs = Math.max(1, parseInt(v, 10) || 1);
    else if (k === "duration") a.duration = parseInt(v, 10) || 1;
    else if (k === "resolution") a.resolution = v;
    else if (k === "max-hamming") a.maxHamming = parseInt(v, 10);
    else if (k === "base-url") a.baseUrl = v;
    else if (k === "source") a.source = v;
  }
  return a;
}

const C = { reset: "\x1b[0m", red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m", dim: "\x1b[2m" };
const ok = (s) => `${C.green}PASS${C.reset} ${s}`;
const bad = (s) => `${C.red}FAIL${C.reset} ${s}`;
const info = (s) => `${C.dim}${s}${C.reset}`;

function sh(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { cwd: REPO, encoding: "utf8", ...opts });
  return { code: r.status ?? 1, out: (r.stdout || "") + (r.stderr || "") };
}

function resolveBaseUrl(arg) {
  if (arg) return arg.replace(/\/+$/, "");
  if (process.env.IMA2_QA_BASE_URL) return process.env.IMA2_QA_BASE_URL.replace(/\/+$/, "");
  const advertise = config.storage.advertiseFile;
  if (existsSync(advertise)) {
    try {
      const j = JSON.parse(readFileSync(advertise, "utf8"));
      const url = j.url || (j.port ? `http://127.0.0.1:${j.port}` : "");
      if (url) return url.replace(/\/+$/, "");
    } catch { /* ignore */ }
  }
  return `http://127.0.0.1:${config.server.port}`;
}

function pickSourceImage(explicit) {
  const dir = config.storage.generatedDir;
  if (explicit) {
    const safe = explicit.replace(/^\/+/, "");
    if (!existsSync(join(dir, safe))) throw new Error(`source image not found: ${safe}`);
    return safe;
  }
  const imgs = readdirSync(dir)
    .filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith("."))
    .map((f) => ({ f, t: statSync(join(dir, f)).mtimeMs }))
    .sort((x, y) => y.t - x.t);
  if (!imgs.length) throw new Error(`no source image available in ${dir}`);
  return imgs[0].f;
}

// 9x8 grayscale frame -> 64-bit dHash (row-wise horizontal gradient).
function dHash(file) {
  const r = spawnSync("ffmpeg", [
    "-y", "-hide_banner", "-loglevel", "error", "-i", file,
    "-frames:v", "1", "-vf", "scale=9:8:flags=area,format=gray",
    "-f", "rawvideo", "-pix_fmt", "gray", "-",
  ], { maxBuffer: 1 << 20 });
  if (r.status !== 0 || !r.stdout || r.stdout.length < 72) {
    throw new Error(`ffmpeg frame extract failed for ${file}: ${r.stderr?.toString() || "no data"}`);
  }
  const px = r.stdout; // 72 bytes, 9 cols x 8 rows
  let bits = 0n;
  for (let row = 0; row < 8; row++) {
    for (let col = 0; col < 8; col++) {
      const left = px[row * 9 + col];
      const right = px[row * 9 + col + 1];
      bits = (bits << 1n) | (left < right ? 1n : 0n);
    }
  }
  return bits;
}

function hamming(a, b) {
  let x = a ^ b;
  let d = 0;
  while (x) { d += Number(x & 1n); x >>= 1n; }
  return d;
}

function ffprobe(file) {
  const r = spawnSync("ffprobe", [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,width,height",
    "-of", "json", file,
  ], { encoding: "utf8" });
  if (r.status !== 0) throw new Error(`ffprobe failed: ${r.stderr}`);
  const j = JSON.parse(r.stdout);
  const streams = j.streams || [];
  return {
    duration: parseFloat(j.format?.duration || "0"),
    hasVideo: streams.some((s) => s.codec_type === "video"),
    hasAudio: streams.some((s) => s.codec_type === "audio"),
    width: streams.find((s) => s.codec_type === "video")?.width || 0,
    height: streams.find((s) => s.codec_type === "video")?.height || 0,
  };
}

// POST /api/video/generate and read SSE until done/error.
async function generateVideo(baseUrl, body) {
  const res = await fetch(`${baseUrl}/api/video/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(body),
  });
  if (!res.ok && res.status >= 500 && !res.body) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let event = "message";
  let result = null;
  let error = null;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop() || "";
    for (const block of parts) {
      for (const line of block.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) {
          const data = JSON.parse(line.slice(5).trim());
          if (event === "done") result = data;
          else if (event === "error") error = data;
        }
      }
    }
  }
  if (error) throw new Error(`${error.code}: ${error.error}`);
  if (!result) throw new Error("stream ended without done event");
  return result;
}

async function runSmokeStage(args, evidence) {
  const baseUrl = resolveBaseUrl(args.baseUrl);
  const dir = config.storage.generatedDir;
  console.log(info(`  base-url: ${baseUrl}`));

  // Preflight: server reachable + Grok credentials usable.
  try {
    const grok = await fetch(`${baseUrl}/api/grok/status`).then((r) => r.json());
    if (!grok || grok.status !== "ready") {
      throw new Error(`grok lane not ready: ${JSON.stringify(grok)}`);
    }
    console.log(ok(`grok lane reachable (status=${grok.status})`));
  } catch (e) {
    console.log(bad(`preflight: ${e.message}`));
    console.log(info("  Start the server first: `ima2 serve`, and sign in with `ima2 grok login`. Then re-run --stage=smoke."));
    return false;
  }

  let allPass = true;

  // T2V x N
  for (let i = 1; i <= args.runs; i++) {
    const label = `T2V run ${i}/${args.runs}`;
    try {
      const r = await generateVideo(baseUrl, {
        provider: "grok", prompt: "a calm ocean wave rolling at sunset, cinematic",
        mode: "text-to-video", duration: args.duration, resolution: args.resolution,
      });
      const probe = ffprobe(join(dir, r.filename));
      const valid = probe.hasVideo && probe.duration > 0;
      evidence.t2v.push({ run: i, filename: r.filename, ...probe, elapsed: r.elapsed });
      if (valid) console.log(ok(`${label}: ${r.filename} ${probe.width}x${probe.height} ${probe.duration}s (${r.elapsed}s)`));
      else { allPass = false; console.log(bad(`${label}: invalid mp4 ${JSON.stringify(probe)}`)); }
    } catch (e) {
      allPass = false;
      evidence.t2v.push({ run: i, error: e.message });
      console.log(bad(`${label}: ${e.message}`));
    }
  }

  // I2V x N with reference-preservation assertion
  const source = pickSourceImage(args.source);
  const sourceHash = dHash(join(dir, source));
  console.log(info(`  I2V source: ${source}`));
  for (let i = 1; i <= args.runs; i++) {
    const label = `I2V run ${i}/${args.runs}`;
    try {
      const r = await generateVideo(baseUrl, {
        provider: "grok", prompt: "animate this scene with gentle natural motion, keep the subject",
        mode: "image-to-video", sourceFilename: source,
        duration: args.duration, resolution: args.resolution,
      });
      const out = join(dir, r.filename);
      const probe = ffprobe(out);
      const outHash = dHash(out);
      const dist = hamming(sourceHash, outHash);
      const preserved = dist <= args.maxHamming;
      const valid = probe.hasVideo && probe.duration > 0;
      evidence.i2v.push({ run: i, filename: r.filename, source, hammingDistance: dist, maxHamming: args.maxHamming, preserved, ...probe, elapsed: r.elapsed });
      if (valid && preserved) {
        console.log(ok(`${label}: ${r.filename} ref-preserved (dHash dist ${dist} ≤ ${args.maxHamming}) ${probe.width}x${probe.height} (${r.elapsed}s)`));
      } else {
        allPass = false;
        console.log(bad(`${label}: ${r.filename} valid=${valid} preserved=${preserved} (dHash dist ${dist} > ${args.maxHamming})`));
      }
    } catch (e) {
      allPass = false;
      evidence.i2v.push({ run: i, error: e.message });
      console.log(bad(`${label}: ${e.message}`));
    }
  }
  return allPass;
}

function runStaticStage() {
  const steps = [
    ["typecheck", "npm", ["run", "-s", "typecheck"]],
    ["typecheck:tests", "npm", ["run", "-s", "typecheck:tests"]],
    ["build:server", "npm", ["run", "-s", "build:server"]],
    ["build:cli", "npm", ["run", "-s", "build:cli"]],
    ["git diff --check", "git", ["diff", "--check"]],
  ];
  let allPass = true;
  for (const [name, cmd, cargs] of steps) {
    const r = sh(cmd, cargs);
    if (r.code === 0) console.log(ok(name));
    else { allPass = false; console.log(bad(`${name}\n${r.out.split("\n").slice(-12).join("\n")}`)); }
  }
  return allPass;
}

function runTestsStage() {
  const files = [
    "tests/grokVideoAdapter.test.ts",
    "tests/videoRoute.test.ts",
    "tests/history-video-row.test.ts",
    "tests/grok-planner-adapter.test.ts",
  ].filter((f) => existsSync(join(REPO, f)));
  const r = sh(process.execPath, ["--import", "tsx", "--test", ...files], { stdio: "pipe" });
  const tail = r.out.split("\n").filter((l) => /^# (tests|pass|fail)|not ok|✖/.test(l)).join("\n");
  if (r.code === 0) { console.log(ok(`targeted video tests\n${info(tail)}`)); return true; }
  console.log(bad(`targeted video tests\n${r.out.split("\n").slice(-25).join("\n")}`));
  return false;
}

async function main() {
  const args = parseArgs(process.argv);
  const stages = args.stage === "all" ? ["static", "tests", "smoke"] : [args.stage];
  const evidence = { startedAt: new Date().toISOString(), args, stages: {}, t2v: [], i2v: [] };
  const results = {};

  console.log(`\n${C.yellow}=== Grok Video Strict QA Gate ===${C.reset}`);
  console.log(info(`stages: ${stages.join(", ")} | runs: ${args.runs} | duration: ${args.duration}s | res: ${args.resolution} | maxHamming: ${args.maxHamming}\n`));

  for (const stage of stages) {
    console.log(`${C.yellow}[${stage}]${C.reset}`);
    try {
      if (stage === "static") results.static = runStaticStage();
      else if (stage === "tests") results.tests = runTestsStage();
      else if (stage === "smoke") results.smoke = await runSmokeStage(args, evidence);
      else { console.log(bad(`unknown stage: ${stage}`)); results[stage] = false; }
    } catch (e) {
      results[stage] = false;
      console.log(bad(`stage ${stage} crashed: ${e.message}`));
    }
    evidence.stages[stage] = results[stage];
    console.log("");
  }

  evidence.finishedAt = new Date().toISOString();
  evidence.pass = Object.values(results).every(Boolean);

  // Persist evidence next to the QA gate doc.
  try {
    const outDir = join(REPO, "devlog/_plan/260531_grok-video-i2v-ship/evidence");
    mkdirSync(outDir, { recursive: true });
    const stamp = evidence.startedAt.replace(/[:.]/g, "-");
    const outFile = join(outDir, `qa-run-${stamp}.json`);
    writeFileSync(outFile, JSON.stringify(evidence, null, 2));
    console.log(info(`evidence: ${outFile}`));
  } catch (e) {
    console.log(info(`(could not persist evidence: ${e.message})`));
  }

  const summary = Object.entries(results).map(([k, v]) => `${k}=${v ? "PASS" : "FAIL"}`).join(" ");
  console.log(`\n${evidence.pass ? C.green : C.red}GATE ${evidence.pass ? "GREEN" : "RED"}${C.reset} (${summary})\n`);
  process.exit(evidence.pass ? 0 : 1);
}

main().catch((e) => { console.error(`${C.red}gate crashed:${C.reset} ${e.stack || e.message}`); process.exit(1); });
