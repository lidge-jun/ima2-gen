import { describe, it } from "node:test";
import assert from "node:assert";
import { parseArgs } from "../bin/lib/args.js";
import { normalizeGenerate } from "../bin/lib/client.js";
import { dataUriToFile, fileToDataUri, defaultOutName } from "../bin/lib/files.js";
import { exitCodeForError } from "../bin/lib/output.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("args parser", () => {
  const spec = {
    flags: {
      quality: { short: "q", type: "string", default: "low" },
      ref: { type: "string", repeatable: true },
      count: { short: "n", type: "string" },
      json: { type: "boolean" },
    },
  };

  it("parses long + short + positional + repeatable", () => {
    const out = parseArgs(["gen", "a", "shiba", "-q", "high", "--ref", "x.png", "--ref", "y.png", "-n", "2", "--json"], spec);
    assert.deepStrictEqual(out.positional, ["gen", "a", "shiba"]);
    assert.strictEqual(out.quality, "high");
    assert.deepStrictEqual(out.ref, ["x.png", "y.png"]);
    assert.strictEqual(out.count, "2");
    assert.strictEqual(out.json, true);
  });

  it("parses --key=val form", () => {
    const out = parseArgs(["--quality=medium"], spec);
    assert.strictEqual(out.quality, "medium");
  });

  it("honors defaults", () => {
    const out = parseArgs([], spec);
    assert.strictEqual(out.quality, "low");
    assert.deepStrictEqual(out.ref, []);
  });

  it("supports -- terminator", () => {
    const out = parseArgs(["gen", "--", "--ref", "literal"], spec);
    assert.deepStrictEqual(out.positional, ["gen", "--ref", "literal"]);
    assert.deepStrictEqual(out.ref, []);
  });

  it("buckets unknown flags into _unknown", () => {
    const out = parseArgs(["--zzz"], spec);
    assert.deepStrictEqual(out._unknown, ["--zzz"]);
  });
});

describe("normalizeGenerate", () => {
  it("handles n=1 shape", () => {
    const norm = normalizeGenerate({ image: "data:image/png;base64,AAAA", filename: "a.png", elapsed: "1.2", requestId: "r1" });
    assert.strictEqual(norm.images.length, 1);
    assert.strictEqual(norm.images[0].filename, "a.png");
    assert.strictEqual(norm.requestId, "r1");
  });
  it("handles n>1 shape", () => {
    const norm = normalizeGenerate({ images: [{ image: "x", filename: "a.png" }, { image: "y", filename: "b.png" }], count: 2 });
    assert.strictEqual(norm.images.length, 2);
    assert.strictEqual(norm.images[1].filename, "b.png");
  });
  it("handles empty shape", () => {
    const norm = normalizeGenerate({});
    assert.deepStrictEqual(norm.images, []);
  });
});

describe("files", () => {
  it("fileToDataUri + dataUriToFile round-trip", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ima2-files-"));
    try {
      const inPath = join(dir, "in.png");
      const outPath = join(dir, "out.png");
      const { writeFileSync } = await import("node:fs");
      const buf = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 1, 2, 3]);
      writeFileSync(inPath, buf);
      const uri = await fileToDataUri(inPath);
      assert.ok(uri.startsWith("data:image/png;base64,"));
      await dataUriToFile(uri, outPath);
      assert.ok(existsSync(outPath));
      assert.deepStrictEqual(readFileSync(outPath), buf);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("defaultOutName uses timestamp", () => {
    const n = defaultOutName(0, 1);
    assert.match(n, /^ima2-\d{8}-\d{6}\.png$/);
  });

  it("defaultOutName indexes multi-image", () => {
    const n = defaultOutName(2, 4);
    assert.match(n, /^ima2-\d{8}-\d{6}-2\.png$/);
  });
});

describe("exitCodeForError", () => {
  it("maps known codes", () => {
    assert.strictEqual(exitCodeForError({ code: "SERVER_UNREACHABLE" }), 3);
    assert.strictEqual(exitCodeForError({ code: "APIKEY_DISABLED", status: 403 }), 4);
    assert.strictEqual(exitCodeForError({ code: "SAFETY_REFUSAL", status: 422 }), 7);
    assert.strictEqual(exitCodeForError({ status: 422 }), 5);
    assert.strictEqual(exitCodeForError({ status: 500 }), 6);
    assert.strictEqual(exitCodeForError({ name: "TimeoutError" }), 8);
    assert.strictEqual(exitCodeForError({}), 1);
  });
});
