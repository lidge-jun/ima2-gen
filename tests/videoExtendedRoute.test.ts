import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { createServer } from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { config } from "../config.js";
import { registerVideoExtendedRoutes } from "../routes/videoExtended.ts";

const execFileAsync = promisify(execFile);
let ffmpegAvailable: Promise<boolean> | null = null;

function listen(server): Promise<string> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`)));
}

function closeServer(server): void {
  server.closeAllConnections?.();
  server.close();
}

function fakeMp4Bytes(): Buffer {
  return Buffer.from([0, 0, 0, 24, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d, 0, 0, 0, 0]);
}

async function makeTinyMp4(path: string): Promise<void> {
  await execFileAsync("ffmpeg", [
    "-y",
    "-f", "lavfi",
    "-i", "color=c=blue:s=64x64:d=1",
    "-pix_fmt", "yuv420p",
    path,
  ]);
}

function hasFfmpeg(): Promise<boolean> {
  ffmpegAvailable ??= execFileAsync("ffmpeg", ["-version"], { timeout: 5000 })
    .then(() => true)
    .catch(() => false);
  return ffmpegAvailable;
}

function jsonRes(res, body, status = 200): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function makeProxy(opts: { operation?: "edit" | "extend"; blocked?: boolean; blockedWithoutUrl?: boolean; responseText?: string; capture?: (url: string, body: any) => void } = {}) {
  let polls = 0;
  const server = createServer((req, res) => {
    const url = req.url || "";
    if (url.includes("/v1/videos/edits") || url.includes("/v1/videos/extensions")) {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        opts.capture?.(url, JSON.parse(body || "{}"));
        jsonRes(res, { request_id: opts.operation === "extend" ? "extend-1" : "edit-1" });
      });
      return;
    }
    if (url.includes("/v1/videos/edit-1") || url.includes("/v1/videos/extend-1")) {
      polls += 1;
      const port = (server.address() as any).port;
      if (polls < 2) return jsonRes(res, { status: "pending", progress: 50 });
      return jsonRes(res, {
        status: "done",
        progress: 100,
        video: {
          ...(opts.blockedWithoutUrl ? {} : { url: `http://127.0.0.1:${port}/dl/out.mp4` }),
          duration: opts.operation === "extend" ? 9 : 4,
          respect_moderation: opts.blocked ? false : true,
        },
        usage: { cost_in_usd_ticks: 500000000 },
      });
    }
    if (url.includes("/v1/responses")) {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        opts.capture?.(url, JSON.parse(body || "{}"));
        jsonRes(res, { output: [{ type: "message", content: [{ type: "output_text", text: opts.responseText ?? "structured video prompt" }] }] });
      });
      return;
    }
    if (url.includes("/dl/")) {
      res.writeHead(200, { "Content-Type": "video/mp4" });
      res.end(fakeMp4Bytes());
      return;
    }
    res.writeHead(404);
    res.end("nope");
  });
  return server;
}

async function videoApp(generatedDir: string, proxyPort: number, plannerModel?: string) {
  const app = express();
  app.use(express.json({ limit: "20mb" }));
  registerVideoExtendedRoutes(app, {
    rootDir: process.cwd(),
    packageVersion: "test",
    config: {
      ...config,
      ids: { ...config.ids, generatedHexBytes: 2 },
      storage: { ...config.storage, generatedDir },
      grokProvider: {
        ...config.grokProvider,
        proxyHost: "127.0.0.1",
        proxyPort,
        ...(plannerModel ? { plannerModel } : {}),
        videoPollIntervalMs: 1,
        videoStartTimeoutMs: 5000,
        videoTimeoutMs: 30000,
        videoDownloadTimeoutMs: 5000,
      },
    },
  });
  const server = createServer(app);
  const url = await listen(server);
  return { server, url };
}

test("/api/video/edit forwards xAI payload and saves local video artifact", async () => {
  let startBody: any = null;
  const proxy = makeProxy({ operation: "edit", capture: (_url, body) => (startBody = body) });
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-edit-"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const res = await fetch(`${url}/api/video/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "make it sunset", videoUrl: "https://vidgen.example/input.mp4" }),
    });
    const data: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(startBody.model, "grok-imagine-video");
    assert.equal(startBody.prompt, "make it sunset");
    assert.deepEqual(startBody.video, { url: "https://vidgen.example/input.mp4" });
    assert.equal(data.requestId, "edit-1");
    assert.match(data.url, /^\/generated\/.+\.mp4$/);
    assert.match(data.filename, /\.mp4$/);
    assert.equal(data.sourceUrl, `http://127.0.0.1:${new URL(proxyUrl).port}/dl/out.mp4`);
    const files = await readdir(generatedDir);
    assert.ok(files.some((f) => f.endsWith(".mp4")), "mp4 written");
    const sidecar = files.find((f) => f.endsWith(".mp4.json"));
    assert.ok(sidecar, "sidecar written");
    const meta = JSON.parse(await readFile(join(generatedDir, sidecar!), "utf8"));
    assert.deepEqual(meta.video.source, { kind: "url", origin: "https://vidgen.example", pathname: "input.mp4" });
    assert.deepEqual(meta.video.sourceUrl, { kind: "url", origin: "http://127.0.0.1:" + new URL(proxyUrl).port, pathname: "out.mp4" });
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/edit rejects whitespace prompt and unsafe generated-file inputs", async () => {
  const proxy = makeProxy({ operation: "edit" });
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-inputs-"));
  await writeFile(join(generatedDir, "clip.mp4.json"), JSON.stringify({ secret: true }));
  await writeFile(join(tmpdir(), "ima2-outside-secret.mp4"), "not really a video");
  await symlink(join(tmpdir(), "ima2-outside-secret.mp4"), join(generatedDir, "linked.mp4"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const blank = await fetch(`${url}/api/video/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "   ", videoUrl: "https://vidgen.example/input.mp4" }),
    });
    assert.equal(blank.status, 400);
    const blankJson = await blank.json();
    assert.equal(blankJson.code, "PROMPT_REQUIRED");
    assert.match(blankJson.guidance, /Active video prompt required/);

    const sidecar = await fetch(`${url}/api/video/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "edit", videoUrl: "clip.mp4.json" }),
    });
    assert.equal(sidecar.status, 400);
    assert.match((await sidecar.json()).error, /\.mp4/);

    const linked = await fetch(`${url}/api/video/edit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "edit", videoUrl: "linked.mp4" }),
    });
    assert.equal(linked.status, 400);
    assert.match((await linked.json()).error, /invalid file path|MP4/);
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
    await rm(join(tmpdir(), "ima2-outside-secret.mp4"), { force: true });
  }
});

test("/api/video/extend/native validates duration/model and rejects moderation-blocked result", async () => {
  const proxy = makeProxy({ operation: "extend", blocked: true });
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-extend-"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const badDuration = await fetch(`${url}/api/video/extend/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "continue", videoUrl: "https://vidgen.example/input.mp4", duration: "abc" }),
    });
    assert.equal(badDuration.status, 400);
    assert.match((await badDuration.json()).error, /duration must be an integer/);

    const badModel = await fetch(`${url}/api/video/extend/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "continue", videoUrl: "https://vidgen.example/input.mp4", duration: 5, model: "grok-imagine-video-1.5-preview" }),
    });
    assert.equal(badModel.status, 400);
    assert.match((await badModel.json()).error, /only supports grok-imagine-video/);

    const blocked = await fetch(`${url}/api/video/extend/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "continue", videoUrl: "https://vidgen.example/input.mp4", duration: 5 }),
    });
    assert.equal(blocked.status, 502);
    assert.match((await blocked.json()).error, /moderation/i);
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/extend/native reports moderation block even when upstream omits url", async () => {
  const proxy = makeProxy({ operation: "extend", blocked: true, blockedWithoutUrl: true });
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-blocked-"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const blocked = await fetch(`${url}/api/video/extend/native`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "continue", videoUrl: "https://vidgen.example/input.mp4", duration: 5 }),
    });
    assert.equal(blocked.status, 502);
    assert.match((await blocked.json()).error, /moderation/i);
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/frame rejects unsafe, invalid, and undecodable generated inputs", async () => {
  const proxy = makeProxy();
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-frame-invalid-"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const traversal = await fetch(`${url}/api/video/frame?file=${encodeURIComponent("../clip.mp4")}`);
    assert.equal(traversal.status, 400);

    const notVideo = join(generatedDir, "not-video.mp4");
    await writeFile(notVideo, "not an mp4");
    const invalid = await fetch(`${url}/api/video/frame?file=${encodeURIComponent("not-video.mp4")}`);
    assert.equal(invalid.status, 400);

    await writeFile(join(generatedDir, "fake.mp4"), fakeMp4Bytes());
    const undecodable = await fetch(`${url}/api/video/frame?file=${encodeURIComponent("fake.mp4")}&position=0`);
    assert.equal(undecodable.status, 500);
    assert.match((await undecodable.json()).error, /ffmpeg failed/);
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/frame supports generated relative and absolute paths safely", async (t) => {
  if (!(await hasFfmpeg())) {
    t.skip("ffmpeg is not installed in this environment");
    return;
  }
  const proxy = makeProxy();
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-frame-"));
  const mp4 = join(generatedDir, "clip.mp4");
  try {
    await makeTinyMp4(mp4);
    const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
    try {
      for (const file of ["clip.mp4", mp4]) {
        const res = await fetch(`${url}/api/video/frame?file=${encodeURIComponent(file)}&position=0`);
        assert.equal(res.status, 200);
        assert.match(res.headers.get("content-type") || "", /image\/png/);
        assert.ok((await res.arrayBuffer()).byteLength > 100);
      }
    } finally {
      closeServer(server);
    }
  } finally {
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/analyze rejects remote URLs before frame extraction", async () => {
  const proxy = makeProxy();
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-analyze-remote-"));
  const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port));
  try {
    const remote = await fetch(`${url}/api/video/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: "https://vidgen.example/clip.mp4" }),
    });
    assert.equal(remote.status, 400);
    assert.match((await remote.json()).error, /generated .mp4/);
  } finally {
    closeServer(server);
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});

test("/api/video/analyze extracts first/last frames and sends input_image payload", async (t) => {
  if (!(await hasFfmpeg())) {
    t.skip("ffmpeg is not installed in this environment");
    return;
  }
  let responseBody: any = null;
  const proxy = makeProxy({ responseText: "first and last frame analysis", capture: (url, body) => { if (url.includes("/v1/responses")) responseBody = body; } });
  const proxyUrl = await listen(proxy);
  const generatedDir = await mkdtemp(join(tmpdir(), "ima2-video-ext-analyze-"));
  const mp4 = join(generatedDir, "clip.mp4");
  try {
    await makeTinyMp4(mp4);
    const { server, url } = await videoApp(generatedDir, Number(new URL(proxyUrl).port), "grok-4.3");
    try {
    const res = await fetch(`${url}/api/video/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoUrl: "clip.mp4" }),
    });
    const data: any = await res.json();
    assert.equal(res.status, 200);
    assert.equal(data.analysis, "first and last frame analysis");
    assert.equal(data.method, "first-last-frame");
    assert.equal(data.model, "grok-4.3");
    assert.equal(responseBody.model, "grok-4.3");
    const content = responseBody.input[0].content;
    assert.equal(content.filter((item: any) => item.type === "input_image").length, 2);
    assert.ok(content.every((item: any) => item.type !== "input_file"));
    } finally {
      closeServer(server);
    }
  } finally {
    closeServer(proxy);
    await rm(generatedDir, { recursive: true, force: true });
  }
});
