import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createFrameExtractionService } from "../ui/src/lib/frameExtraction";

// WP6 / issue #88 (devlog/_plan/260726_zero-backlog-frontend-qa/060_frame_extraction_service.md).
//
// The fallback is a conditional path, so "the suite is green" proves nothing on its own.
// Every test below drives a specific branch and asserts which implementation actually ran
// via the `via` field.

const OK_SERVER = "data:image/png;base64,SERVER";
const OK_BROWSER = "data:image/jpeg;base64,BROWSER";

function serviceWith(overrides: {
  fetchGeneratedFrame?: () => Promise<string>;
  extractFromElement?: () => Promise<string>;
} = {}) {
  let serverCalls = 0;
  let browserCalls = 0;
  const service = createFrameExtractionService({
    fetchGeneratedFrame: async () => {
      serverCalls += 1;
      if (overrides.fetchGeneratedFrame) return overrides.fetchGeneratedFrame();
      return OK_SERVER;
    },
    extractFromElement: async () => {
      browserCalls += 1;
      if (overrides.extractFromElement) return overrides.extractFromElement();
      return OK_BROWSER;
    },
  });
  return { service, counts: () => ({ serverCalls, browserCalls }) };
}

function serverError(status: number, code?: string) {
  return Object.assign(new Error(`server ${status}`), { status, code });
}

test("generated files take the server ffmpeg path", async () => {
  const { service, counts } = serviceWith();
  const result = await service.extractFrame({ kind: "generated", filename: "a.mp4" }, "last");
  assert.equal(result.via, "server-ffmpeg");
  assert.deepEqual(counts(), { serverCalls: 1, browserCalls: 0 });
});

test("a remote URL never hits the server route", async () => {
  // The route only accepts files inside the generated dir; sending a URL would be an
  // SSRF invitation and would fail anyway.
  const { service, counts } = serviceWith();
  const result = await service.extractFrame({ kind: "url", url: "https://cdn/x.mp4" }, "last");
  assert.equal(result.via, "browser-canvas");
  assert.equal(counts().serverCalls, 0);
});

test("FFMPEG_UNAVAILABLE falls back to the browser", async () => {
  const { service, counts } = serviceWith({
    fetchGeneratedFrame: () => Promise.reject(serverError(503, "FFMPEG_UNAVAILABLE")),
  });
  const result = await service.extractFrame({ kind: "generated", filename: "a.mp4" }, "last");
  assert.equal(result.via, "browser-canvas", "the fallback branch must actually fire");
  assert.deepEqual(counts(), { serverCalls: 1, browserCalls: 1 });
});

test("a timeout falls back to the browser", async () => {
  const { service } = serviceWith({
    fetchGeneratedFrame: () => Promise.reject(serverError(504, "VIDEO_FRAME_EXTRACT_TIMEOUT")),
  });
  assert.equal((await service.extractFrame({ kind: "generated", filename: "a.mp4" }, "last")).via, "browser-canvas");
});

test("a user abort is not retried elsewhere", async () => {
  const { service, counts } = serviceWith({
    fetchGeneratedFrame: () => Promise.reject(serverError(499, "VIDEO_FRAME_EXTRACT_ABORTED")),
  });
  await assert.rejects(
    () => service.extractFrame({ kind: "generated", filename: "a.mp4" }, "last"),
    /server 499/,
  );
  assert.equal(counts().browserCalls, 0, "cancelling must cancel, not reroute");
});

test("a 4xx input error is not retried in the browser", async () => {
  const { service, counts } = serviceWith({
    fetchGeneratedFrame: () => Promise.reject(serverError(400)),
  });
  await assert.rejects(() => service.extractFrame({ kind: "generated", filename: "bad.txt" }, "last"));
  assert.equal(counts().browserCalls, 0, "the browser would fail on the same input");
});

test("first and mid positions stay on the browser path", async () => {
  // The server route understands "last" or an absolute second offset; converting
  // first/mid needs a duration the client does not have.
  for (const position of ["first", "mid"] as const) {
    const { service, counts } = serviceWith();
    const result = await service.extractFrame({ kind: "generated", filename: "a.mp4" }, position);
    assert.equal(result.via, "browser-canvas");
    assert.equal(counts().serverCalls, 0, `${position} must not call the server`);
  }
});

test("the browser module does not depend on the orchestrator", () => {
  // One-way dependency: frameExtraction -> videoMedia. The reverse would be a cycle.
  const videoMedia = readFileSync("ui/src/lib/videoMedia.ts", "utf8");
  assert.doesNotMatch(videoMedia, /frameExtraction/);
});

test("the browser extractor cannot hang on an unusable duration", () => {
  const src = readFileSync("ui/src/lib/videoMedia.ts", "utf8");
  // Assigning NaN to currentTime is silently ignored, so onseeked never fires.
  assert.match(src, /Number\.isFinite\(duration\)/);
  assert.match(src, /frame extraction timed out/);
  assert.match(src, /VIDEO_FRAME_EXTRACT_ABORTED/);
});

test("the video node path uses the service with a real filename", () => {
  const store = readFileSync("ui/src/store/storeVideoImpl.ts", "utf8");
  assert.match(store, /frameExtraction\.extractFrame\(\s*\{ kind: "generated", filename: parentFilename \}/);
});
